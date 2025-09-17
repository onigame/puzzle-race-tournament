<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\RequestHandlerInterface;
use Slim\Factory\AppFactory;
use Slim\Psr7\Factory\ResponseFactory;
use Selective\BasePath\BasePathMiddleware;

require __DIR__ . '/../vendor/autoload.php';
require __DIR__ . '/../helpers.php';

$settings = require __DIR__ . '/../settings.php';

try {
    $pdo = new PDO(
        "mysql:host={$settings['db']['host']};dbname={$settings['db']['dbname']}",
        $settings['db']['user'],
        $settings['db']['pass']
    );
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    die("Database connection failed: " . $e->getMessage());
}

AppFactory::setResponseFactory(new ResponseFactory());

$app = AppFactory::create();

// Add the BasePathMiddleware to the middleware stack
$app->add(new BasePathMiddleware($app));

// This middleware will parse the JSON data sent from the browser
$app->addBodyParsingMiddleware();

// Add a middleware to make the PDO object available to all routes
$app->add(
    function (Request $request, RequestHandlerInterface $handler) use ($pdo) {
        $request = $request->withAttribute('pdo', $pdo);
        return $handler->handle($request);
    }
);

// Define a route for the root of your app. This will load your index page.
$app->get('/', function (Request $request, Response $response, $args) {
    $pdo = $request->getAttribute('pdo');
    $stmt = $pdo->prepare("SELECT id, display_name FROM gp_playoffs_tournaments ORDER BY id DESC");
    $stmt->execute();
    $tournaments = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $competitorStmt = $pdo->prepare("SELECT position FROM gp_playoffs_competitors WHERE tournament_id = ? ORDER BY position ASC");
    
    foreach ($tournaments as &$t) { // Note the '&' to modify the array directly
        $competitorStmt->execute([$t['id']]);
        $t['competitors'] = $competitorStmt->fetchAll(PDO::FETCH_ASSOC);
    }
    unset($t); // Unset the reference

    ob_start();
    include __DIR__ . '/../src/pages/index.php';
    $output = ob_get_clean();
    $response->getBody()->write($output);
    return $response;
});

// Define a route for the Display page
$app->get('/display', function (Request $request, Response $response, $args) {
    ob_start();
    require __DIR__ . '/../src/pages/display.php';
    $output = ob_get_clean();
    $response->getBody()->write($output);
    return $response;
});

// Define a route for the Competitors Roster Management page
// Find the existing route for /manage-competitors and replace it
$app->get('/manage-competitors', function (Request $request, Response $response) {
    $pdo = $request->getAttribute('pdo');

    // 1. Fetch all competitors from the roster
    $competitors = $pdo->query("SELECT * FROM gp_playoffs_competitors_roster ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC);
    
    // 2. Fetch all events
    $events = $pdo->query("SELECT * FROM gp_playoffs_events ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC);

    // 3. Fetch all existing assignments from the linking table
    $assignmentsRaw = $pdo->query("SELECT event_id, roster_id FROM gp_playoffs_event_competitors")->fetchAll(PDO::FETCH_ASSOC);
    
    // 4. Reorganize assignments into an array keyed by roster_id for easy lookup
    $assignments = [];
    foreach ($assignmentsRaw as $assignment) {
        $assignments[$assignment['roster_id']][] = $assignment['event_id'];
    }

    // 5. Pass all the necessary data to the PHP template
    $viewData = [
        'competitors' => $competitors,
        'events' => $events,
        'assignments' => $assignments
    ];

    $file = __DIR__ . '/../src/pages/manage-competitors.php';
    ob_start();
    // Make variables ($competitors, $events, $assignments) available to the included file
    extract($viewData);
    include $file;
    $output = ob_get_clean();
    $response->getBody()->write($output);
    return $response;
});

// Define a route for the Puzzle & Event Manager page
$app->get('/puzzle-manager', function (Request $request, Response $response) {
    $file = __DIR__ . '/../src/pages/puzzle-manager.php';

    // Start an output buffer
    ob_start();
    // Include the file, which will be "printed" to the buffer
    include $file;
    // Get the contents of the buffer
    $output = ob_get_clean();

    // Write the contents to the response body
    $response->getBody()->write($output);
    return $response;
});

// Define a route for the All Tournaments page
$app->get('/manage-all', function (Request $request, Response $response) {
    $pdo = $request->getAttribute('pdo');
    $stmt = $pdo->prepare("SELECT * FROM gp_playoffs_tournaments ORDER BY id DESC");
    $stmt->execute();
    $tournaments = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $rosterStmt = $pdo->prepare("SELECT id, name, country FROM gp_playoffs_competitors_roster ORDER BY name ASC");
    $rosterStmt->execute();
    $roster = $rosterStmt->fetchAll(PDO::FETCH_ASSOC);

    ob_start();
    include __DIR__ . '/../src/pages/all-tournaments.php';
    $output = ob_get_clean();
    $response->getBody()->write($output);
    return $response;
});

// Define a route for the Management page
$app->get('/manage-tournament', function (Request $request, Response $response, $args) {
    ob_start();
    require __DIR__ . '/../src/pages/manage-tournament.php';
    $output = ob_get_clean();
    $response->getBody()->write($output);
    return $response;
});

// Define a route for the Judge pages
$app->get('/judge/{position}', function (Request $request, Response $response, $args) {
    $pdo = $request->getAttribute('pdo');
    $competitorPosition = $args['position'];
    
    // Get the tournament_id from the URL's query string (e.g., ?tournament_id=1)
    $queryParams = $request->getQueryParams();
    $tournamentId = $queryParams['tournament_id'] ?? null;

    $competitorDisplayName = 'Competitor Not Found';
    $competitorId = null;

    if ($tournamentId) {
        // Find the competitor using their position AND the tournament ID
        $stmt = $pdo->prepare(
            "SELECT id, display_name FROM gp_playoffs_competitors WHERE position = ? AND tournament_id = ?"
        );
        $stmt->execute([$competitorPosition, $tournamentId]);
        $competitorData = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($competitorData) {
            $competitorId = $competitorData['id'];
            $competitorDisplayName = $competitorData['display_name'];
        }
    }

    // These variables will now be available to the included judge.php file
    ob_start();
    require __DIR__ . '/../src/pages/judge.php';
    $output = ob_get_clean();
    $response->getBody()->write($output);
    return $response;
});

// API Endpoints -- Competitor Management

$app->post('/api/competitors', function (Request $request, Response $response) {
    $pdo = $request->getAttribute('pdo');
    $data = $request->getParsedBody();
    
    $name = $data['name'] ?? '';
    $country = $data['country'] ?? '';

    // Simple validation
    if (empty($name)) {
        $response->getBody()->write(json_encode(['status' => 'error', 'message' => 'Competitor name cannot be empty.']));
        return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
    }

    try {
        $stmt = $pdo->prepare("INSERT INTO gp_playoffs_competitors_roster (name, country) VALUES (?, ?)");
        $stmt->execute([$name, $country]);
        $response->getBody()->write(json_encode(['status' => 'success', 'message' => 'Competitor added successfully.']));
    } catch (PDOException $e) {
        $response->getBody()->write(json_encode(['status' => 'error', 'message' => $e->getMessage()]));
        return $response->withStatus(500)->withHeader('Content-Type', 'application/json');
    }

    return $response->withHeader('Content-Type', 'application/json');
});

$app->put('/api/competitors/{id}', function (Request $request, Response $response, $args) {
    $pdo = $request->getAttribute('pdo');
    $competitorId = $args['id'];
    $data = $request->getParsedBody();
    
    $name = $data['name'] ?? '';
    $country = $data['country'] ?? '';

    // Simple validation
    if (empty($name)) {
        $response->getBody()->write(json_encode(['status' => 'error', 'message' => 'Competitor name cannot be empty.']));
        return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
    }

    try {
        $stmt = $pdo->prepare("UPDATE gp_playoffs_competitors_roster SET name = ?, country = ? WHERE id = ?");
        $stmt->execute([$name, $country, $competitorId]);
        
        $response->getBody()->write(json_encode(['status' => 'success', 'message' => 'Competitor updated.']));
    } catch (PDOException $e) {
        $response->getBody()->write(json_encode(['status' => 'error', 'message' => $e->getMessage()]));
        return $response->withStatus(500)->withHeader('Content-Type', 'application/json');
    }

    return $response->withHeader('Content-Type', 'application/json');
});

$app->delete('/api/competitors/{id}', function (Request $request, Response $response, $args) {
    $pdo = $request->getAttribute('pdo');
    $competitorId = $args['id'];
    
    try {
        $stmt = $pdo->prepare("DELETE FROM gp_playoffs_competitors_roster WHERE id = ?");
        $stmt->execute([$competitorId]);
        
        $response->getBody()->write(json_encode(['status' => 'success', 'message' => 'Competitor deleted.']));
    } catch (PDOException $e) {
        $response->getBody()->write(json_encode(['status' => 'error', 'message' => $e->getMessage()]));
        return $response->withStatus(500)->withHeader('Content-Type', 'application/json');
    }

    return $response->withHeader('Content-Type', 'application/json');
});

$app->post('/api/competitor-event-assignment', function (Request $request, Response $response) {
    $pdo = $request->getAttribute('pdo');
    $data = $request->getParsedBody();

    $rosterId = $data['roster_id'];
    $eventId = $data['event_id'];
    $isAssigned = $data['is_assigned'];

    if ($isAssigned) {
        $stmt = $pdo->prepare("INSERT IGNORE INTO gp_playoffs_event_competitors (roster_id, event_id) VALUES (?, ?)");
        $stmt->execute([$rosterId, $eventId]);
    } else {
        $stmt = $pdo->prepare("DELETE FROM gp_playoffs_event_competitors WHERE roster_id = ? AND event_id = ?");
        $stmt->execute([$rosterId, $eventId]);
    }

    $response->getBody()->write(json_encode(['status' => 'success']));
    return $response->withHeader('Content-Type', 'application/json');
});

// API Endpoints -- Events and Puzzles

$app->get('/api/events-with-puzzles', function (Request $request, Response $response) {
    $pdo = $request->getAttribute('pdo');
    $events = [];

    try {
        // 1. Fetch all events, ordered by name
        $eventStmt = $pdo->query("SELECT id, name FROM gp_playoffs_events ORDER BY name ASC");
        $events = $eventStmt->fetchAll(PDO::FETCH_ASSOC);

        // 2. For each event, fetch its associated puzzles
        $puzzleStmt = $pdo->prepare("SELECT id, title FROM gp_playoffs_puzzles WHERE event_id = ? ORDER BY title ASC");
        
        foreach ($events as &$event) { // Use a reference to modify the array in place
            $puzzleStmt->execute([$event['id']]);
            $puzzles = $puzzleStmt->fetchAll(PDO::FETCH_ASSOC);
            $event['puzzles'] = $puzzles; // Attach the list of puzzles to the event object
        }
        unset($event); // Unset the reference

    } catch (Exception $e) {
        $response->getBody()->write(json_encode(['status' => 'error', 'message' => $e->getMessage()]));
        return $response->withStatus(500)->withHeader('Content-Type', 'application/json');
    }

    $response->getBody()->write(json_encode($events));
    return $response->withHeader('Content-Type', 'application/json');
});

$app->put('/api/events/{id}', function (Request $request, Response $response, $args) {
    $pdo = $request->getAttribute('pdo');
    $data = $request->getParsedBody();
    $eventId = $args['id'];
    $name = $data['name'] ?? null;

    if (empty($name)) {
        $response->getBody()->write(json_encode(['status' => 'error', 'message' => 'Event name is required.']));
        return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
    }

    $stmt = $pdo->prepare("UPDATE gp_playoffs_events SET name = ? WHERE id = ?");
    $stmt->execute([$name, $eventId]);

    $response->getBody()->write(json_encode(['status' => 'success', 'message' => 'Event updated.']));
    return $response->withHeader('Content-Type', 'application/json');
});

$app->put('/api/puzzles/{id}', function (Request $request, Response $response, $args) {
    $pdo = $request->getAttribute('pdo');
    $data = $request->getParsedBody();
    $puzzleId = $args['id'];
    $title = $data['title'] ?? null;

    if (empty($title)) {
        $response->getBody()->write(json_encode(['status' => 'error', 'message' => 'Puzzle title is required.']));
        return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
    }

    $stmt = $pdo->prepare("UPDATE gp_playoffs_puzzles SET title = ? WHERE id = ?");
    $stmt->execute([$title, $puzzleId]);

    $response->getBody()->write(json_encode(['status' => 'success', 'message' => 'Puzzle updated.']));
    return $response->withHeader('Content-Type', 'application/json');
});

$app->post('/api/events', function (Request $request, Response $response) {
    $pdo = $request->getAttribute('pdo');
    $data = $request->getParsedBody();
    $name = $data['name'] ?? null;

    if (empty($name)) {
        $response->getBody()->write(json_encode(['status' => 'error', 'message' => 'Event name is required.']));
        return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
    }

    $stmt = $pdo->prepare("INSERT INTO gp_playoffs_events (name) VALUES (?)");
    $stmt->execute([$name]);

    $response->getBody()->write(json_encode(['status' => 'success', 'message' => 'Event created.']));
    return $response->withHeader('Content-Type', 'application/json');
});

$app->post('/api/puzzles', function (Request $request, Response $response) {
    $pdo = $request->getAttribute('pdo');
    $data = $request->getParsedBody();
    $title = $data['title'] ?? null;
    $eventId = $data['event_id'] ?? null;

    if (empty($title) || empty($eventId)) {
        $response->getBody()->write(json_encode(['status' => 'error', 'message' => 'Title and event ID are required.']));
        return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
    }

    $stmt = $pdo->prepare("INSERT INTO gp_playoffs_puzzles (title, event_id) VALUES (?, ?)");
    $stmt->execute([$title, $eventId]);

    $response->getBody()->write(json_encode(['status' => 'success', 'message' => 'Puzzle created.']));
    return $response->withHeader('Content-Type', 'application/json');
});

$app->delete('/api/puzzles/{id}', function (Request $request, Response $response, $args) {
    $pdo = $request->getAttribute('pdo');
    $puzzleId = $args['id'];

    $stmt = $pdo->prepare("DELETE FROM gp_playoffs_puzzles WHERE id = ?");
    $stmt->execute([$puzzleId]);

    $response->getBody()->write(json_encode(['status' => 'success', 'message' => 'Puzzle deleted.']));
    return $response->withHeader('Content-Type', 'application/json');
});

// API Endpoints -- Tournaments Management

$app->post('/api/create-empty-tournament', function (Request $request, Response $response) {
    $pdo = $request->getAttribute('pdo');
    $data = $request->getParsedBody();
    $displayName = $data['displayName'] ?? '';

    if (empty($displayName)) {
        $response->getBody()->write(json_encode(['status' => 'error', 'message' => 'Tournament name cannot be empty.']));
        return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
    }

    try {
        $stmt = $pdo->prepare("INSERT INTO gp_playoffs_tournaments (name, display_name) VALUES (?, ?)");
        $stmt->execute([$displayName, $displayName]);
        $tournamentId = $pdo->lastInsertId();

        $response->getBody()->write(json_encode(['status' => 'success', 'message' => 'Tournament created!', 'tournamentId' => $tournamentId]));
    } catch (PDOException $e) {
        $response->getBody()->write(json_encode(['status' => 'error', 'message' => $e->getMessage()]));
        return $response->withStatus(500)->withHeader('Content-Type', 'application/json');
    }
    return $response->withHeader('Content-Type', 'application/json');
});

$app->post('/api/configure-tournament/{id}', function (Request $request, Response $response, $args) {
    $tournamentId = $args['id'];
    $pdo = $request->getAttribute('pdo');
    $data = $request->getParsedBody();

    // Correctly get the new event and puzzle ID data
    $eventId = $data['event_id'] ?? null;
    $puzzleIds = $data['puzzle_ids'] ?? [];
    $competitors = $data['competitors'] ?? [];

    $pdo->beginTransaction();
    try {
        // 1. Update the main tournament table with event_id and puzzle_ids
        $stmt = $pdo->prepare(
            "UPDATE gp_playoffs_tournaments SET event_id = ?, puzzle_ids = ?, puzzles_count = ? WHERE id = ?"
        );
        $stmt->execute([$eventId, json_encode($puzzleIds), count($puzzleIds), $tournamentId]);

        // 2. Delete existing competitors for this tournament to replace them
        $stmt = $pdo->prepare("DELETE FROM gp_playoffs_competitors WHERE tournament_id = ?");
        $stmt->execute([$tournamentId]);

        // 3. Insert the new list of competitors (this logic is unchanged)
        $rosterStmt = $pdo->prepare("SELECT name, country FROM gp_playoffs_competitors_roster WHERE id = ?");
        $insertStmt = $pdo->prepare(
            "INSERT INTO gp_playoffs_competitors (tournament_id, roster_id, name, display_name, handicap_seconds, position) VALUES (?, ?, ?, ?, ?, ?)"
        );
        $position = 1;

        $newCompetitorDbIds = []; // Keep track of the new IDs

        foreach ($competitors as $comp) {
            $rosterStmt->execute([$comp['roster_id']]);
            $rosterData = $rosterStmt->fetch(PDO::FETCH_ASSOC);
            $name = $rosterData['name'];
            $displayName = $comp['display_name'];

            if (empty($displayName)) {
                $displayName = $name;
                if (!empty($rosterData['country'])) {
                    $displayName .= ' [' . $rosterData['country'] . ']';
                }
            }

            $insertStmt->execute([
                $tournamentId,
                $comp['roster_id'],
                $name,
                $displayName,
                $comp['handicap_seconds'],
                $position
            ]);
            
            $position++;

            // After inserting, get the new ID and store it
            $newCompetitorDbIds[] = $pdo->lastInsertId();
        }

        // Now, create a default state record for each new competitor.
        if (!empty($newCompetitorDbIds)) {
            $initStateStmt = $pdo->prepare(
                "INSERT IGNORE INTO gp_playoffs_competitor_tournament_state (competitor_id, status, status_text) VALUES (?, 'waiting', 'Waiting to start')"
            );
            foreach ($newCompetitorDbIds as $competitorId) {
                $initStateStmt->execute([$competitorId]);
            }
        }

        $pdo->commit();
        $response->getBody()->write(json_encode(['status' => 'success', 'message' => 'Tournament configuration saved!']));

    } catch (PDOException $e) {
        $pdo->rollBack();
        $response->getBody()->write(json_encode(['status' => 'error', 'message' => $e->getMessage()]));
        return $response->withStatus(500);
    }
    return $response->withHeader('Content-Type', 'application/json');
});

$app->get('/api/tournament-management-data/{id}', function (Request $request, Response $response, $args) {
    $pdo = $request->getAttribute('pdo');
    $tournamentId = $args['id'];
    $data = [];

    try {
        // 1. Fetch the specific tournament
        $tournamentStmt = $pdo->prepare("SELECT * FROM gp_playoffs_tournaments WHERE id = ?");
        $tournamentStmt->execute([$tournamentId]);
        $data['tournament'] = $tournamentStmt->fetch(PDO::FETCH_ASSOC);

        // 2. Fetch competitors in this tournament
        $stmt = $pdo->prepare("SELECT c.* FROM gp_playoffs_competitors c WHERE c.tournament_id = ? ORDER BY c.position ASC");
        $stmt->execute([$tournamentId]);
        $data['competitors'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // 3. Fetch all events and their puzzles
        $eventStmt = $pdo->query("SELECT id, name FROM gp_playoffs_events ORDER BY name ASC");
        $all_events = $eventStmt->fetchAll(PDO::FETCH_ASSOC);
        $puzzleStmt = $pdo->prepare("SELECT id, title FROM gp_playoffs_puzzles WHERE event_id = ? ORDER BY title ASC");
        foreach ($all_events as &$event) {
            $puzzleStmt->execute([$event['id']]);
            $event['puzzles'] = $puzzleStmt->fetchAll(PDO::FETCH_ASSOC);
        }
        unset($event);
        $data['all_events'] = $all_events;

        // 4. Fetch the full competitor roster with their event assignments
        $rosterStmt = $pdo->query("SELECT * FROM gp_playoffs_competitors_roster ORDER BY name ASC");
        $competitor_roster = $rosterStmt->fetchAll(PDO::FETCH_ASSOC);
        $assignmentsRaw = $pdo->query("SELECT event_id, roster_id FROM gp_playoffs_event_competitors")->fetchAll(PDO::FETCH_ASSOC);
        $assignments = [];
        foreach ($assignmentsRaw as $a) { $assignments[$a['roster_id']][] = $a['event_id']; }
        foreach ($competitor_roster as &$c) { $c['assigned_events'] = $assignments[$c['id']] ?? []; }
        unset($c);
        $data['competitor_roster'] = $competitor_roster;

    } catch (Exception $e) { /* ... error handling ... */ }

    $response->getBody()->write(json_encode($data));
    return $response->withHeader('Content-Type', 'application/json');
});

// API Endpoints -- Tournament Control

$app->post('/api/judge-action', function (Request $request, Response $response) {
    $pdo = $request->getAttribute('pdo');
    $data = $request->getParsedBody();
    
    $action = $data['action'] ?? null;
    $tournamentId = $data['tournament_id'] ?? null;
    $position = $data['position'] ?? null;

    if (!$action || !$tournamentId || !$position) {
        throw new Exception("Missing required action, tournamentId, or position.");
    }

    $pdo->beginTransaction();
    try {
        $idStmt = $pdo->prepare("SELECT id FROM gp_playoffs_competitors WHERE tournament_id = ? AND position = ?");
        $idStmt->execute([$tournamentId, $position]);
        $competitorId = $idStmt->fetchColumn();
        if (!$competitorId) {
            throw new Exception("Could not find a competitor at position {$position} for this tournament.");
        }

        $tournStmt = $pdo->prepare("SELECT * FROM gp_playoffs_tournaments WHERE id = ?");
        $tournStmt->execute([$tournamentId]);
        $tournament = $tournStmt->fetch(PDO::FETCH_ASSOC);
        
        $puzzleIds = json_decode($tournament['puzzle_ids'] ?? '[]', true);
        $puzzles = [];
        if (!empty($puzzleIds)) {
            $placeholders = implode(',', array_fill(0, count($puzzleIds), '?'));
            $puzzleStmt = $pdo->prepare("SELECT id, title FROM gp_playoffs_puzzles WHERE id IN ($placeholders)");
            $puzzleStmt->execute($puzzleIds);
            $puzzlesFromDb = $puzzleStmt->fetchAll(PDO::FETCH_ASSOC);
            $puzzleMap = [];
            foreach ($puzzlesFromDb as $p) { $puzzleMap[$p['id']] = $p['title']; }
            foreach ($puzzleIds as $id) { if (isset($puzzleMap[$id])) { $puzzles[] = $puzzleMap[$id]; } }
        }

        $stmt = $pdo->prepare("SELECT * FROM gp_playoffs_competitor_tournament_state WHERE competitor_id = ?");
        $stmt->execute([$competitorId]);
        $state = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$state) { throw new Exception("Competitor state not found."); }

        $puzzleTimes = json_decode($state['puzzle_times'] ?? '[]', true);
        $incorrectAnswers = json_decode($state['incorrect_answers'] ?? '[]', true);
        $submissionTimes = json_decode($state['submission_times'] ?? '[]', true);
        $incorrectJudgmentTimes = json_decode($state['incorrect_judgment_times'] ?? '[]', true);

        switch ($action) {
            case 'submit_answer':
                $puzzleSubmittedIndex = $state['current_puzzle'];
                if (!isset($submissionTimes[$puzzleSubmittedIndex])) { $submissionTimes[$puzzleSubmittedIndex] = []; }
                array_push($submissionTimes[$puzzleSubmittedIndex], time());
                $state['current_puzzle']++;
                $state['status'] = 'judging';
                $state['status_text'] = 'Awaiting judgment for ' . ($puzzles[$puzzleSubmittedIndex] ?? 'puzzle');
                break;
            case 'correct':
                $puzzleJudgedIndex = $state['current_puzzle'] - 1;
                $puzzleTimes[$puzzleJudgedIndex] = time();
                if ($state['current_puzzle'] >= count($puzzles)) {
                    $state['status'] = 'finished';
                    $state['finish_time_stamp'] = date('Y-m-d H:i:s');
                    $state['status_text'] = 'Finished';
                } else {
                    $state['status'] = 'solving';
                    $state['status_text'] = 'Solving: ' . ($puzzles[$state['current_puzzle']] ?? 'next puzzle');
                }
                break;
            case 'incorrect':
                $puzzleJudgedIndex = $state['current_puzzle'] - 1;
                $isLastPuzzle = ($puzzleJudgedIndex === count($puzzles) - 1);
                if (!isset($incorrectJudgmentTimes[$puzzleJudgedIndex])) { $incorrectJudgmentTimes[$puzzleJudgedIndex] = []; }
                array_push($incorrectJudgmentTimes[$puzzleJudgedIndex], time());
                if (!isset($incorrectAnswers[$puzzleJudgedIndex])) { $incorrectAnswers[$puzzleJudgedIndex] = 0; }
                $incorrectAnswers[$puzzleJudgedIndex]++;
                if ($isLastPuzzle) {
                    $state['status'] = 'pending_penalty';
                    $state['status_text'] = 'Waiting for puzzle return';
                } else {
                    $state['current_puzzle']--; 
                    $state['status'] = 'solving';
                    $state['status_text'] = 'Incorrect. Re-solving ' . ($puzzles[$state['current_puzzle']] ?? 'puzzle');
                }
                break;
        }

        $updateStmt = $pdo->prepare(
            "UPDATE gp_playoffs_competitor_tournament_state SET current_puzzle = ?, status = ?, status_text = ?, 
            puzzle_times = ?, incorrect_answers = ?, finish_time_stamp = ?, submission_times = ?, incorrect_judgment_times = ?
            WHERE competitor_id = ?"
        );
        $updateStmt->execute([
            $state['current_puzzle'], $state['status'], $state['status_text'],
            json_encode($puzzleTimes), json_encode($incorrectAnswers), $state['finish_time_stamp'] ?? null,
            json_encode($submissionTimes), json_encode($incorrectJudgmentTimes),
            $competitorId
        ]);
        
        $pdo->commit();
        $response->getBody()->write(json_encode(['status' => 'success', 'message' => 'Action recorded.']));
    } catch (Exception $e) {
        $pdo->rollBack();
        $response->getBody()->write(json_encode(['status' => 'error', 'message' => $e->getMessage()]));
        return $response->withStatus(500);
    }
    return $response->withHeader('Content-Type', 'application/json');
});

// This is the "SOFT RESET" for the button on the manage-tournament page
$app->post('/api/reset-tournament-progress/{id}', function (Request $request, Response $response, $args) {
    $tournamentId = $args['id'];
    $pdo = $request->getAttribute('pdo');

    $pdo->beginTransaction();
    try {
        // Step 1: Reset tournament clock state
        $stmt = $pdo->prepare(
            "UPDATE gp_playoffs_tournaments 
             SET start_time = NULL, is_paused = 1, total_paused_seconds = 0, last_pause_time = NULL 
             WHERE id = ?"
        );
        $stmt->execute([$tournamentId]);

        // Step 2: Delete all competitor progress
        $stmt = $pdo->prepare(
            "DELETE s FROM gp_playoffs_competitor_tournament_state s
             JOIN gp_playoffs_competitors c ON s.competitor_id = c.id
             WHERE c.tournament_id = ?"
        );
        $stmt->execute([$tournamentId]);

        // Step 3: Re-initialize the 'waiting' state for every competitor
        $compStmt = $pdo->prepare("SELECT id FROM gp_playoffs_competitors WHERE tournament_id = ?");
        $compStmt->execute([$tournamentId]);
        $competitorIds = $compStmt->fetchAll(PDO::FETCH_COLUMN);
        
        $stateInsertStmt = $pdo->prepare(
            "INSERT INTO gp_playoffs_competitor_tournament_state (competitor_id, status) VALUES (?, 'waiting')"
        );
        foreach ($competitorIds as $competitorId) {
            $stateInsertStmt->execute([$competitorId]);
        }

        $pdo->commit();
        $response->getBody()->write(json_encode(['status' => 'success', 'message' => 'Tournament has been reset.']));
    } catch (PDOException $e) {
        $pdo->rollBack();
        $response->getBody()->write(json_encode(['status' => 'error', 'message' => $e->getMessage()]));
        return $response->withStatus(500);
    }
    return $response->withHeader('Content-Type', 'application/json');
});

$app->post('/api/start-unpause-tournament/{id}', function (Request $request, Response $response, $args) {
    $tournamentId = $args['id'];
    $pdo = $request->getAttribute('pdo');

    $tournStmt = $pdo->prepare("SELECT start_time, last_pause_time, total_paused_seconds FROM gp_playoffs_tournaments WHERE id = ?");
    $tournStmt->execute([$tournamentId]);
    $tournament = $tournStmt->fetch(PDO::FETCH_ASSOC);

    if ($tournament['start_time'] === null) {
        // This is the FIRST start. Its ONLY job is to set the clock running.
        // The initial 'waiting' states are now correctly handled by the Reset/Configure functions.
        $stmt = $pdo->prepare("UPDATE gp_playoffs_tournaments SET start_time = DATE_ADD(NOW(), INTERVAL 5 SECOND), is_paused = 0 WHERE id = ?");
        $stmt->execute([$tournamentId]);
        $message = 'Tournament started!';
    } else {
        // This is an UNPAUSE
        $pausedDuration = time() - strtotime($tournament['last_pause_time']);
        $totalPaused = $tournament['total_paused_seconds'] + $pausedDuration;
        
        $stmt = $pdo->prepare("UPDATE gp_playoffs_tournaments SET is_paused = 0, total_paused_seconds = ?, last_pause_time = NULL WHERE id = ?");
        $stmt->execute([$totalPaused, $tournamentId]);
        $message = 'Tournament unpaused.';
    }

    $response->getBody()->write(json_encode(['status' => 'success', 'message' => $message]));
    return $response->withHeader('Content-Type', 'application/json');
});

$app->post('/api/pause-tournament/{id}', function (Request $request, Response $response, $args) {
    $tournamentId = $args['id'];
    $pdo = $request->getAttribute('pdo');
    $stmt = $pdo->prepare("UPDATE gp_playoffs_tournaments SET is_paused = 1, last_pause_time = NOW() WHERE id = ?");
    $stmt->execute([$tournamentId]);
    $response->getBody()->write(json_encode(['status' => 'success', 'message' => 'Tournament paused.']));
    return $response->withHeader('Content-Type', 'application/json');
});

// This is the "HARD DELETE" for the button on the all-tournaments page
$app->post('/api/delete-tournament/{tournament_id}', function (Request $request, Response $response, $args) {
    $pdo = $request->getAttribute('pdo');
    $tournamentId = $args['tournament_id'];

    $pdo->beginTransaction();
    try {
        // This query deletes the progress
        $stmt = $pdo->prepare("DELETE FROM gp_playoffs_competitor_tournament_state WHERE competitor_id IN (SELECT id FROM gp_playoffs_competitors WHERE tournament_id = ?)");
        $stmt->execute([$tournamentId]);
        
        // This query deletes the competitor ASSIGNMENTS
        $stmt = $pdo->prepare("DELETE FROM gp_playoffs_competitors WHERE tournament_id = ?");
        $stmt->execute([$tournamentId]);
        
        // This query deletes the tournament itself
        $stmt = $pdo->prepare("DELETE FROM gp_playoffs_tournaments WHERE id = ?");
        $stmt->execute([$tournamentId]);
        
        $pdo->commit();
        $response->getBody()->write(json_encode(['status' => 'success', 'message' => 'Tournament deleted.']));
    } catch (PDOException $e) {
        $pdo->rollBack();
        $response->getBody()->write(json_encode(['status' => 'error', 'message' => $e->getMessage()]));
        return $response->withStatus(500);
    }
    return $response->withHeader('Content-Type', 'application/json');
});

$app->get('/api/status/{tournament_id}', function (Request $request, Response $response, $args) {
    $pdo = $request->getAttribute('pdo');
    $tournamentId = $args['tournament_id'];

    // 1. Fetch tournament state
    $stmt = $pdo->prepare("SELECT * FROM gp_playoffs_tournaments WHERE id = ?");
    $stmt->execute([$tournamentId]);
    $tournament = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$tournament) {
        $response->getBody()->write(json_encode(['status' => 'error', 'message' => 'Tournament not found.']));
        return $response->withStatus(404)->withHeader('Content-Type', 'application/json');
    }

    // Read the puzzle IDs from the tournament, then fetch the actual puzzle names.
    $puzzleIds = json_decode($tournament['puzzle_ids'] ?? '[]', true);
    $puzzles = [];
    if (!empty($puzzleIds)) {
        $placeholders = implode(',', array_fill(0, count($puzzleIds), '?'));
        $puzzleStmt = $pdo->prepare("SELECT id, title FROM gp_playoffs_puzzles WHERE id IN ($placeholders)");
        $puzzleStmt->execute($puzzleIds);
        $puzzlesFromDb = $puzzleStmt->fetchAll(PDO::FETCH_ASSOC);

        // Re-order the fetched puzzles to match the order in puzzle_ids
        $puzzleMap = [];
        foreach ($puzzlesFromDb as $p) {
            $puzzleMap[$p['id']] = $p['title'];
        }
        foreach ($puzzleIds as $id) {
            if (isset($puzzleMap[$id])) {
                $puzzles[] = $puzzleMap[$id];
            }
        }
    }
    // Add the re-constructed array of names back to the tournament object for the frontend.
    // The frontend expects a JSON string in a field called `puzzle_names`.
    $tournament['puzzle_names'] = json_encode($puzzles);

    $firstPuzzleName = $puzzles[0] ?? 'Puzzle 1';

    // 2. STATE ENGINE: Update any competitors who should be starting
    if ($tournament['start_time'] && !$tournament['is_paused']) {
        // The time calculation is now moved into the SQL query for accuracy
        $competitorsToUpdateStmt = $pdo->prepare(
            "SELECT c.id FROM gp_playoffs_competitors c
             LEFT JOIN gp_playoffs_competitor_tournament_state cts ON c.id = cts.competitor_id
             WHERE c.tournament_id = :tournament_id 
             AND IFNULL(cts.status, 'waiting') = 'waiting' 
             AND (UNIX_TIMESTAMP(NOW()) - UNIX_TIMESTAMP(:start_time)) - :paused_seconds >= c.handicap_seconds + 2"
        );
        $competitorsToUpdateStmt->execute([
            ':tournament_id' => $tournamentId,
            ':start_time' => $tournament['start_time'],
            ':paused_seconds' => $tournament['total_paused_seconds']
        ]);
        $competitorIdsToStart = $competitorsToUpdateStmt->fetchAll(PDO::FETCH_COLUMN);

        if (!empty($competitorIdsToStart)) {
            $newStatusText = "Solving: " . $firstPuzzleName;
            $updateStmt = $pdo->prepare(
                "UPDATE gp_playoffs_competitor_tournament_state SET status = 'solving', status_text = ? 
                 WHERE competitor_id IN (" . implode(',', array_fill(0, count($competitorIdsToStart), '?')) . ")"
            );
            $updateStmt->execute(array_merge([$newStatusText], $competitorIdsToStart));
        }
    }

    // 3. Fetch the (now updated) full competitor list
    $stmt = $pdo->prepare("
        SELECT
            c.id, c.display_name, c.roster_id, c.position, c.handicap_seconds, 
            cts.id as state_id, cts.current_puzzle, cts.status, cts.status_text, 
            cts.puzzle_times, cts.incorrect_answers, cts.submission_times, cts.incorrect_judgment_times
        FROM gp_playoffs_competitors c
        LEFT JOIN gp_playoffs_competitor_tournament_state cts ON c.id = cts.competitor_id
        WHERE c.tournament_id = ? ORDER BY c.position ASC
    ");
    $stmt->execute([$tournamentId]);
    $competitors = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 4. DYNAMIC TEXT FORMATTING & PENALTY STATE ENGINE
    if ($tournament['start_time']) {
        $startTime = strtotime($tournament['start_time']);
        $now = time();
        $elapsedTime = ($now - $startTime) - $tournament['total_paused_seconds'];

        foreach ($competitors as &$competitor) {
            if (empty($competitor['state_id'])) {
                $competitor['status'] = 'waiting';
            }
            if ($competitor['status'] === 'waiting') {
                $timeToStart = $competitor['handicap_seconds'] - $elapsedTime;
                if ($timeToStart > 0) {
                    $minutes = floor($timeToStart / 60);
                    $seconds = $timeToStart % 60;
                    $competitor['status_text'] = sprintf("Waiting to start %02d:%02d", $minutes, $seconds);
                }
            } else if ($competitor['status'] === 'pending_penalty') {
                $lastPuzzleIndex = count($puzzles) - 1; // This now works because $puzzles is defined
                $submissions = json_decode($competitor['submission_times'], true);
                $lastSubmissionTimestamp = null;
                if (isset($submissions[$lastPuzzleIndex]) && !empty($submissions[$lastPuzzleIndex])) {
                    $lastSubmissionTimestamp = end($submissions[$lastPuzzleIndex]);
                }

                if ($lastSubmissionTimestamp) {
                    $elapsed = time() - $lastSubmissionTimestamp;
                    $waitPeriod = 60;
                    $remaining = $waitPeriod - $elapsed;

                    if ($remaining > 0) {
                        $competitor['status_text'] = ceil($remaining);
                    } else {

                        $lastPuzzleName = $puzzles[$lastPuzzleIndex] ?? 'Final Puzzle'; // This also now works
                        $newStatusText = "Incorrect. Re-solving " . $lastPuzzleName;
                        $updateStmt = $pdo->prepare(
                            "UPDATE gp_playoffs_competitor_tournament_state SET status = 'solving', current_puzzle = ?, status_text = ? WHERE competitor_id = ?"
                        );
                        $updateStmt->execute([$lastPuzzleIndex, $newStatusText, $competitor['id']]);

                        $competitor['status'] = 'solving';
                        $competitor['current_puzzle'] = $lastPuzzleIndex;
                        $competitor['status_text'] = $newStatusText;
                    }
                }
            }
        }
        unset($competitor);
    }
    
    // 5. Format dates for JavaScript
    if ($tournament['start_time']) {
        $tournament['start_time'] = gmdate('Y-m-d\TH:i:s\Z', strtotime($tournament['start_time']));
    }
    if ($tournament['last_pause_time']) {
        $tournament['last_pause_time'] = gmdate('Y-m-d\TH:i:s\Z', strtotime($tournament['last_pause_time']));
    }

    $data = [
        'tournament' => $tournament,
        'competitors' => $competitors,
    ];

    $response->getBody()->write(json_encode($data));
    return $response->withHeader('Content-Type', 'application/json');
});

$app->run();