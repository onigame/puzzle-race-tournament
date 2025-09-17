/**
 * Dynamically adjusts the font size of an element to fit its container.
 * @param {HTMLElement} element The text element to resize.
 * @param {HTMLElement} container The container element that defines the max width.
 */
function fitText(element, container) {
    if (!element || !container) return;
    
    element.style.fontSize = ''; 

    // Measure against the element's own calculated width, which respects the CSS margins.
    const containerWidth = element.clientWidth;
    
    let fontSize = 100; // Start with a large font size in pixels
    element.style.fontSize = fontSize + 'px';

    // Shrink the font size until the text fits
    while (element.scrollWidth > containerWidth && fontSize > 8) {
        fontSize--;
        element.style.fontSize = fontSize + 'px';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENT REFERENCES ---
    const urlPath = window.location.pathname.split('/').filter(p => p);
    const competitorPosition = urlPath[urlPath.length - 1]; 
    const tournamentId = new URLSearchParams(window.location.search).get('tournament_id');
    const statusDisplayElement = document.getElementById('status-display');
    const judgeTitleEl = document.getElementById('judge-title');
    const submitBtn = document.getElementById('submit-answer-btn');
    const correctBtn = document.getElementById('correct-btn');
    const incorrectBtn = document.getElementById('incorrect-btn');
    
    // --- HELPER FUNCTIONS ---
    function getEffectiveSeconds(absoluteTimestamp, tournament) {
        if (!absoluteTimestamp || !tournament.start_time) return 0;
        const tournamentStartTimeMs = Date.parse(tournament.start_time);
        const rawDuration = absoluteTimestamp - (tournamentStartTimeMs / 1000);
        const effectiveDuration = rawDuration - tournament.total_paused_seconds;
        return effectiveDuration;
    }
    
    function fitText(element, container) {
        if (!element || !container) return;
        element.style.whiteSpace = 'nowrap';
        element.style.fontSize = ''; 
        const containerWidth = element.clientWidth;
        let fontSize = 100;
        element.style.fontSize = fontSize + 'px';
        while (element.scrollWidth > containerWidth && fontSize > 8) {
            fontSize--;
            element.style.fontSize = fontSize + 'px';
        }
    }

    // --- API COMMUNICATION ---
    async function sendAction(action) {
        if (!competitorPosition) {
            console.error("Cannot send action: Competitor position is not known.");
            return;
        }
        try {
            await fetch('/playoffs/api/judge-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: action,
                    tournament_id: tournamentId,
                    position: competitorPosition
                }),
            });
            fetchState();
        } catch (error) {
            console.error(`sendAction failed for action "${action}":`, error);
        }
    }

    // --- UI STATE MANAGEMENT ---
    async function fetchState() {
        if (!tournamentId) {
            document.body.innerHTML = "<h1>Error: Missing Tournament ID</h1>";
            return;
        }
        try {
            const response = await fetch(`/playoffs/api/status/${tournamentId}`);
            const data = await response.json();
            if (!data || !data.tournament || !Array.isArray(data.competitors)) {
                console.error('Invalid data received from status API', data);
                setTimeout(fetchState, 2000);
                return;
            }

            const competitor = data.competitors.find(c => Number(c.position) === Number(competitorPosition));
            if (!competitor) {
                judgeTitleEl.textContent = `Error: Competitor Not Found`;
                judgeTitleEl.style.color = 'red';
                document.getElementById('judge-container').style.display = 'none';
                console.error(`Could not find competitor with POSITION "${competitorPosition}" in the data.`);
                setTimeout(fetchState, 2000);
                return;
            }
            
            judgeTitleEl.textContent = `Judge for: ${competitor.display_name}`;
            fitText(judgeTitleEl, document.getElementById('judge-container'));
            
            const puzzleNames = JSON.parse(data.tournament.puzzle_names || '[]');
            
            let currentTournamentTime;
            if (data.tournament.is_paused && data.tournament.last_pause_time) {
                const lastPauseTimestamp = Date.parse(data.tournament.last_pause_time) / 1000;
                currentTournamentTime = getEffectiveSeconds(lastPauseTimestamp, data.tournament);
            } else {
                const nowSeconds = Date.now() / 1000;
                currentTournamentTime = getEffectiveSeconds(nowSeconds, data.tournament);
            }

            if (statusDisplayElement) {
                // Default all buttons to hidden, then show the correct one(s).
                submitBtn.style.display = 'none';
                correctBtn.style.display = 'none';
                incorrectBtn.style.display = 'none';

                switch (competitor.status) {
                    case 'waiting':
                        submitBtn.style.display = 'block';
                        submitBtn.disabled = true;
                        if (!data.tournament.start_time) {
                            statusDisplayElement.textContent = `Waiting for ${data.tournament.display_name} to start.`;
                        } else {
                            const timeToStart = Math.ceil(competitor.handicap_seconds - currentTournamentTime);
                            const firstPuzzleName = puzzleNames[0] || 'the first puzzle';
                            if (timeToStart > 0) {
                                statusDisplayElement.textContent = `Give ${firstPuzzleName} to competitor after ${timeToStart}s.`;
                            } else {
                                statusDisplayElement.textContent = `Ready to start solving ${firstPuzzleName}.`;
                            }
                        }
                        break;
                    
                    case 'solving':
                        const isLastPuzzle = competitor.current_puzzle === data.tournament.puzzles_count - 1;
                        const submissions = competitor.submission_times ? JSON.parse(competitor.submission_times) : [];
                        const submissionsForCurrent = submissions[competitor.current_puzzle] || [];
                        const isFirstSubmission = submissionsForCurrent.length === 0;

                        if (isLastPuzzle) {
                            const lastPuzzleName = puzzleNames[data.tournament.puzzles_count - 1];
                            submitBtn.textContent = `Answer to ${lastPuzzleName} submitted`;
                        } else if (isFirstSubmission) {
                            const nextPuzzleName = puzzleNames[competitor.current_puzzle + 1] || 'the next puzzle';
                            submitBtn.textContent = `Answer submitted and I have given them ${nextPuzzleName}`;
                        } else {
                            submitBtn.textContent = "Fixed answer submitted";
                        }
                        submitBtn.style.display = 'block';
                        submitBtn.disabled = false;
                        const currentPuzzle = puzzleNames[competitor.current_puzzle];
                        statusDisplayElement.textContent = `Competitor is solving: ${currentPuzzle}`;
                        break;

                    case 'judging':
                        console.log('DEBUG: Competitor state in JUDGING case:', competitor);
                        const puzzleJudgedIndex = competitor.current_puzzle - 1;
                        const isLastPuzzleJudged = puzzleJudgedIndex === data.tournament.puzzles_count - 1;

                        if (isLastPuzzleJudged) {
                            const submissions = competitor.submission_times ? JSON.parse(competitor.submission_times) : [];
                            const lastPuzzleSubmissions = submissions[puzzleJudgedIndex] || [];
                            const lastSubmissionTimestamp = lastPuzzleSubmissions[lastPuzzleSubmissions.length - 1];

                            if (lastSubmissionTimestamp) {
                                const effectiveSubmissionTime = getEffectiveSeconds(lastSubmissionTimestamp, data.tournament);
                                const elapsed = currentTournamentTime - effectiveSubmissionTime;
                                const remaining = Math.max(0, Math.ceil(60 - elapsed));
                                incorrectBtn.textContent = `Incorrect; I will hold on to the puzzle for a waiting period of ${remaining}s`;
                            } else {
                                incorrectBtn.textContent = "Incorrect; I will hold on to the puzzle for a waiting period of 60s";
                            }
                        } else {
                            incorrectBtn.textContent = "Incorrect; I will immediately hand them back the puzzle";
                        }
                        correctBtn.style.display = 'block';
                        incorrectBtn.style.display = 'block';
                        const judgedPuzzle = puzzleNames[puzzleJudgedIndex];
                        statusDisplayElement.textContent = `Awaiting your judgment for: ${judgedPuzzle}`;
                        break;

                    case 'pending_penalty':
                        const lastPuzzleName = puzzleNames[data.tournament.puzzles_count - 1];
                        const remainingSeconds = competitor.status_text;
                        statusDisplayElement.innerHTML = `Return <strong>${lastPuzzleName}</strong> in exactly <strong>${remainingSeconds}</strong> more seconds.`;
                        break;

                    case 'finished':
                        statusDisplayElement.textContent = "Finished!";
                        break;
                }
            }

            let nextPollDelay = 2000;
            const isJudgingLastPuzzle = competitor.status === 'judging' && (competitor.current_puzzle - 1) === data.tournament.puzzles_count - 1;
            const isWaitingDuringHandicap = competitor.status === 'waiting' && data.tournament.start_time;
            if (isWaitingDuringHandicap || isJudgingLastPuzzle || competitor.status === 'pending_penalty') {
                nextPollDelay = 250;
            }
            setTimeout(fetchState, nextPollDelay);
        } catch (error) {
            console.error("Error in fetchState:", error);
            setTimeout(fetchState, 2000);
        }
    }

    // --- EVENT LISTENERS ---
    submitBtn.addEventListener('click', () => sendAction('submit_answer'));
    correctBtn.addEventListener('click', () => sendAction('correct'));
    incorrectBtn.addEventListener('click', () => sendAction('incorrect'));

    // --- INITIALIZATION ---
    fetchState();
});