<?php
$pdo = $request->getAttribute('pdo');
$stmt = $pdo->prepare("SELECT * FROM gp_playoffs_tournaments ORDER BY id DESC");
$stmt->execute();
$tournaments = $stmt->fetchAll(PDO::FETCH_ASSOC);
?>
<!DOCTYPE html>
<html>
<head>
    <title>Manage All Tournaments</title>
    <link rel="stylesheet" href="/playoffs/public/css/admin.css">
</head>
<body>
    <?php
    $breadcrumbs = [
        ['label' => 'Home', 'url' => '/playoffs/'],
        ['label' => 'All Tournaments', 'url' => '/playoffs/manage-all']
    ];
    echo generateBreadcrumbs($breadcrumbs);
    ?>
    <h1>Manage All Tournaments</h1>

    <h2>Create a New Tournament</h2>
    <form id="create-tournament-form">
        <label for="display-name">Tournament Display Name:</label><br>
        <input type="text" id="display-name" name="display-name" required><br><br>

        <button type="submit">Create Tournament</button>
    </form>

    <hr>

    <h2>Existing Tournaments</h2>
    <table border="1">
        <thead>
            <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Status</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
            <?php foreach ($tournaments as $t): ?>
            <tr>
                <td><?php echo htmlspecialchars($t['id']); ?></td>
                <td><?php echo htmlspecialchars($t['display_name']); ?></td>
                <td>
                    <?php if ($t['start_time']): ?>
                        <?php echo $t['is_paused'] ? 'Paused' : 'Running'; ?>
                    <?php else: ?>
                        Not Started
                    <?php endif; ?>
                </td>
                <td>
                    <a href="/playoffs/manage-tournament?tournament_id=<?php echo htmlspecialchars($t['id']); ?>">Manage</a> |
                    <button class="delete-tournament-btn" data-id="<?php echo htmlspecialchars($t['id']); ?>">Delete</button>
                </td>
            </tr>
            <?php endforeach; ?>
        </tbody>
    </table>

    <script src="/playoffs/public/js/all-tournaments.js"></script>
</body>
</html>