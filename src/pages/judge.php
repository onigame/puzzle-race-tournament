<!DOCTYPE html>
<html>
<head>
    <title>Judge Page</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <link rel="stylesheet" href="/playoffs/css/judge.css">
</head>
<body>
    <div id="judge-container">
        <h1 id="judge-title">[Judge for Competitor]</h1>

        <button id="correct-btn" class="btn" style="display: none;">Correct Answer</button>

        <h2 id="status-display">Loading Status...</h2>

        <div id="action-container">
            <button id="submit-answer-btn" class="btn" style="display: none;"></button>
            <button id="incorrect-btn" class="btn" style="display: none;"></button>
        </div>
        
    </div>

    <script src="/playoffs/public/js/judge.js"></script>

</body>
</html>