<!DOCTYPE html>
<html>
<head>
    <title>Puzzle Tournaments</title>
    <link rel="stylesheet" href="/playoffs/public/css/admin.css">
</head>
<body>
    <h1>World Puzzle Federation Grand Prix Playoffs Hub</h1>
    
    <h2>Administration</h2>
    <p>
        <a href="/playoffs/manage-all">Tournament Management</a> |
        <a href="/playoffs/manage-competitors">Competitor Management</a> |
        <a href="/playoffs/puzzle-manager">Puzzle & Event Manager</a> |
        <a href="https://docs.google.com/spreadsheets/d/1VaW1FT3fEYmHMH200JIQokfFhCcvAcCui0_JcNe3f3g/edit?usp=sharing">Playoff Rules</a>
    </p>

    <hr>
    
    <h2>Available Tournaments</h2>

    <?php if (empty($tournaments)): ?>
        <p>No tournaments found. Please go to the <a href="/playoffs/manage-all">Tournament Management Page</a> to create one.</p>
    <?php else: ?>
        <table border="1" style="width:100%; text-align:left;">
            <thead>
                <tr>
                    <th>Tournament ID</th>
                    <th>Display Name</th>
                    <th>Links</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($tournaments as $t): ?>
                <tr>
                    <td><?php echo htmlspecialchars($t['id']); ?></td>
                    <td><?php echo htmlspecialchars($t['display_name']); ?></td>
                    <td>
                        <a href="/playoffs/display?tournament_id=<?php echo htmlspecialchars($t['id']); ?>">Display</a> |
                        <a href="/playoffs/manage-tournament?tournament_id=<?php echo htmlspecialchars($t['id']); ?>">Manage</a>
                        
                        <?php if (!empty($t['competitors'])): ?>
                            |
                            <?php foreach ($t['competitors'] as $index => $comp): ?>
                                <a href="/playoffs/judge/<?php echo htmlspecialchars($comp['position']); ?>?tournament_id=<?php echo htmlspecialchars($t['id']); ?>">
                                    Judge <?php echo htmlspecialchars($comp['position']); ?>
                                </a>
                                <?php if ($index < count($t['competitors']) - 1): ?>
                                    | <?php endif; ?>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    <?php endif; ?>

    <h2>Tournament Drafts</h2>
    <ul>
        <li><a href="/sudoku2025draft/">2025 Sudoku</a></li>
        <li><a href="/puzzle2025draft/">2025 Puzzle</a></li>
    </ul>
</body>
</html>