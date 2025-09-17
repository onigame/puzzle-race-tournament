<?php
require_once __DIR__ . '/../../helpers.php';

// Define the breadcrumb path
$breadcrumbs = [
    [
        'url' => '/playoffs/',
        'label' => 'Playoffs Home'
    ],
    [
        'url' => '#',
        'label' => 'Puzzle & Event Manager'
    ]
];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-g">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Puzzle & Event Manager</title>
    <link rel="stylesheet" href="/playoffs/css/admin.css"> <link rel="stylesheet" href="/playoffs/css/puzzle-manager.css"> </head>
<body class="admin-page">
    <div class="container">
        <?php echo generateBreadcrumbs($breadcrumbs); ?>
        <h1>Puzzle & Event Manager</h1>

        <div class="manager-section">
            <h2>Create New Event</h2>
            <form id="create-event-form" class="inline-form">
                <input type="text" id="new-event-name" placeholder="New Event Name" required>
                <button type="submit">Create Event</button>
            </form>
        </div>

        <hr>

        <div id="events-container">
            <p>Loading events...</p>
        </div>
    </div>

    <script src="/playoffs/js/puzzle-manager.js"></script>
</body>
</html>