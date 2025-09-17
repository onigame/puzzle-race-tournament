<?php
// We assume that the $competitors variable is being passed from the route
// which fetches all records from the gp_playoffs_competitors_roster table.
if (!isset($competitors)) {
    die("Competitors data not found. Please check your route configuration.");
}
?>
<!DOCTYPE html>
<html>
<head>
    <title>Manage Competitors</title>
    <link rel="stylesheet" href="/playoffs/public/css/admin.css">
</head>
<body>
    <?php
    $breadcrumbs = [
        ['label' => 'Home', 'url' => '/playoffs/'],
        ['label' => 'Manage Competitors', 'url' => '/playoffs/manage-competitors']
    ];
    echo generateBreadcrumbs($breadcrumbs);
    ?>
    <h1>Competitor Management <span id="save-status" class="save-status"></span></h1>
    <p>Use this page to add, edit, or delete competitors from the master list.</p>

    <h2>Add New Competitor</h2>
    <form id="add-competitor-form">
        <label for="competitor-name">Name:</label>
        <input type="text" id="competitor-name" name="name" required>
        
        <label for="competitor-country">Country:</label>
        <input type="text" id="competitor-country" name="country">
        
        <button type="submit">Add Competitor</button>
    </form>

    <hr>

    <h2>Existing Competitors</h2>
    <table border="1" style="width:100%;">
        <thead>
            <tr>
                <th>Name</th>
                <th>Country</th>
                <th>Assigned Events</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody id="competitor-table-body">
            <?php foreach ($competitors as $c): ?>
            <tr data-competitor-id="<?php echo htmlspecialchars($c['id']); ?>">
                <td><?php echo htmlspecialchars($c['name']); ?></td>
                <td><?php echo htmlspecialchars($c['country']); ?></td>
                <td>
                    <div class="event-checkboxes">
                        <?php foreach ($events as $event): ?>
                            <?php 
                                $competitorEvents = $assignments[$c['id']] ?? [];
                                $isChecked = in_array($event['id'], $competitorEvents);
                            ?>
                            <label>
                                <input type="checkbox" class="event-assign-cb" 
                                       data-event-id="<?php echo htmlspecialchars($event['id']); ?>"
                                       <?php echo $isChecked ? 'checked' : ''; ?>>
                                <?php echo htmlspecialchars($event['name']); ?>
                            </label>
                        <?php endforeach; ?>
                    </div>
                </td>
                <td>
                    <button class="edit-competitor-btn"
                            data-id="<?php echo htmlspecialchars($c['id']); ?>"
                            data-name="<?php echo htmlspecialchars($c['name']); ?>"
                            data-country="<?php echo htmlspecialchars($c['country']); ?>">Edit</button>
                    <button class="delete-competitor-btn" data-id="<?php echo htmlspecialchars($c['id']); ?>">Delete</button>
                </td>
            </tr>
            <?php endforeach; ?>
        </tbody>
    </table>

    <script src="/playoffs/public/js/manage-competitors.js"></script>
</body>
</html>