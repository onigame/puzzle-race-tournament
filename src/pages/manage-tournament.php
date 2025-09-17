<?php
$tournamentId = $_GET['tournament_id'] ?? null;
if (!$tournamentId) {
    die('Tournament ID not specified.');
}

$pdo = $request->getAttribute('pdo');

// Fetch tournament details
$tournStmt = $pdo->prepare("SELECT display_name FROM gp_playoffs_tournaments WHERE id = ?");
$tournStmt->execute([$tournamentId]);
$tournamentName = $tournStmt->fetchColumn();

?>
<!DOCTYPE html>
<html>
<head>
    <title>Manage Tournament</title>
    <link rel="stylesheet" href="/playoffs/public/css/admin.css">
</head>
<body>
    <?php
    // Breadcrumbs for navigation
        $breadcrumbs = [
            ['label' => 'Home', 'url' => '/playoffs/'],
            ['label' => 'All Tournaments', 'url' => '/playoffs/manage-all'],
            ['label' => 'Manage Tournament', 'url' => '/playoffs/manage-tournament?tournament_id=' . $tournamentId]
        ];
        echo generateBreadcrumbs($breadcrumbs);
    ?>

    <h1><?php echo htmlspecialchars($tournamentName); ?> <small>(ID: <?php echo htmlspecialchars($tournamentId); ?>)</small></h1>
    <p>Tournament Status: <strong id="tournament-status">Loading...</strong> <span id="manage-timer-display" style="font-weight: bold; margin-left: 10px;"></span></p>
    <hr>
    
    <div id="controls">
        <h2>Live Controls & Quick Links</h2>
        <button id="start-unpause-button" data-id="<?php echo htmlspecialchars($tournamentId); ?>">Start Tournament</button>
        <button id="pause-button" data-id="<?php echo htmlspecialchars($tournamentId); ?>">Pause Tournament</button>
        <button id="reset-button" data-id="<?php echo htmlspecialchars($tournamentId); ?>">Reset Tournament</button>
        <div class="judge-links">
            <a href="/playoffs/display?tournament_id=<?php echo htmlspecialchars($tournamentId); ?>" target="_blank" class="button">
                View Public Display
            </a>
            <strong>Judge Pages:</strong>
            <a href="/playoffs/judge/1?tournament_id=<?php echo htmlspecialchars($tournamentId); ?>" target="_blank">Judge 1</a> |
            <a href="/playoffs/judge/2?tournament_id=<?php echo htmlspecialchars($tournamentId); ?>" target="_blank">Judge 2</a> |
            <a href="/playoffs/judge/3?tournament_id=<?php echo htmlspecialchars($tournamentId); ?>" target="_blank">Judge 3</a> |
            <a href="/playoffs/judge/4?tournament_id=<?php echo htmlspecialchars($tournamentId); ?>" target="_blank">Judge 4</a>
        </div>
    </div>
    <hr>

    <div id="setup-section">
        <h2>Tournament Setup <span id="save-status" style="font-size: 0.6em; color: #7f8c8d;"></span></h2>
        <form id="tournament-setup-form">
            
            <h3>Event</h3>
            <div id="event-container">
                <select id="event-select" name="event_id">
                    <option value="">-- Select an Event --</option>
                    </select>
            </div>

            <h3>Puzzles</h3>
            <div class="puzzle-selection-grid">
                <div id="available-puzzles-container">
                    <h4>Available Puzzles for Event</h4>
                    <ul id="available-puzzles-list" class="puzzle-list-box">
                        </ul>
                </div>
                <div id="selected-puzzles-container">
                    <h4>Selected Puzzles for Tournament</h4>
                    <ul id="selected-puzzles-list" class="puzzle-list-box">
                        </ul>
                </div>
            </div>
            <p><small>Select an event, then add puzzles from the "Available" list to the "Selected" list. The order of puzzles in the "Selected" list is the order they will be solved.</small></p>

            <h3>Competitors</h3>
            <div class="competitor-headers competitor-grid">
                <strong>Competitor</strong>
                <strong>Display Name</strong>
                <strong>Handicap (seconds)</strong>
                <strong>&nbsp;</strong>
            </div>

            <div id="competitors-container">
            </div>

            <button type="button" id="add-competitor-btn">Add Competitor Slot</button>
            <p><small>Add 4 competitors from the master roster and set their time handicap.</small></p>
    </div>

    <template id="competitor-row-template">
        <div class="competitor-row competitor-grid">
            <select name="competitor_id[]" class="competitor-select">
                <option value="">-- Select Competitor --</option>
            </select>
            <input type="text" name="display_name[]" class="display-name-input" placeholder="Display Name">
            <input type="number" name="handicap_seconds[]" class="handicap-input" placeholder="Handicap (s)" value="0" min="0">
            <button type="button" class="remove-row-btn">Remove</button>
        </div>
    </template>

    <script src="/playoffs/public/js/manage-tournament.js"></script>
</body>
</html>