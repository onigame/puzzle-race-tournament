document.addEventListener('DOMContentLoaded', () => {
    // Global variables
    let tournamentState = null;
    let uiTimerInterval = null;
    let lastSecond = null;
    let repeatCount = 0; // This is our "RC" for the countdown animation

    /**
     * Interpolates a color for the countdown text.
     * @param {number} value The "CV" (Countdown Value).
     * @returns {string} The calculated RGB color string.
     */
    function interpolateColor(value) {
        const val = Math.max(0, Math.min(50, value));
        let r, g;
        if (val > 25) { // Red to Yellow
            const a = (val - 25) / 25;
            r = 255;
            g = 255 * (1 - a);
        } else { // Yellow to Green
            const a = val / 25;
            r = 255 * a;
            g = 220;
        }
        return `rgb(${Math.round(r)}, ${Math.round(g)}, 0)`;
    }

    /**
     * Formats seconds into a signed MM:SS display.
     * @param {number} totalSeconds The number of seconds to format.
     * @returns {string} The formatted time string.
     */
    function formatTime(totalSeconds) {
        if (isNaN(totalSeconds)) return "-00:05";
        const sign = totalSeconds < 0 ? "-" : "";
        const absSeconds = Math.abs(totalSeconds);
        const minutes = Math.floor(absSeconds / 60);
        const seconds = Math.floor(absSeconds % 60);
        return `${sign}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    /**
     * This function ONLY updates the visual timer display. It runs every 100ms.
     */
    function updateTimerDisplay() {
        const timerElement = document.getElementById('timer-display');
        const overlayElement = document.getElementById('paused-overlay');
        if (!timerElement || !overlayElement) return;

        if (tournamentState && tournamentState.is_paused && tournamentState.start_time) {
            overlayElement.style.display = 'flex';
        } else {
            overlayElement.style.display = 'none';
        }

        if (!tournamentState || !tournamentState.start_time) {
            timerElement.className = 'timer-waiting';
            timerElement.innerHTML = `<div>Waiting</div><div>to start</div>`;
            return;
        }

        const startTime = Date.parse(tournamentState.start_time);
        let totalSeconds;

        if (tournamentState.is_paused && tournamentState.last_pause_time) {
            const lastPause = Date.parse(tournamentState.last_pause_time);
            totalSeconds = (lastPause - startTime) / 1000 - tournamentState.total_paused_seconds;
        } else {
            const now = Date.now();
            totalSeconds = (now - startTime) / 1000 - tournamentState.total_paused_seconds;
        }
        
        if (totalSeconds >= 0) {
            timerElement.className = 'timer-positive';
            timerElement.innerHTML = formatTime(totalSeconds);
        } else {
            timerElement.className = 'timer-countdown';
            const seconds = Math.ceil(totalSeconds);
            if (seconds === lastSecond) {
                repeatCount = (repeatCount + 1) % 10;
            } else {
                repeatCount = 0;
                lastSecond = seconds;
            }
            const RC = repeatCount;
            const DD = Math.abs(seconds) + 1;
            const CV = DD * 10 - RC;
            const color = interpolateColor(CV);
            const maxFontSize = 40;
            const scale = (10 - RC) / 10;
            const fontSize = maxFontSize * scale;
            timerElement.innerHTML = `<div class="countdown-text" style="color: ${color};">Starting in</div><div class="countdown-digit" style="font-size: ${fontSize}vh;">${DD}</div>`;
        }
    }

    /**
     * Converts an absolute UNIX timestamp into effective tournament seconds.
     * @param {number} absoluteTimestamp The UNIX timestamp in seconds.
     * @param {object} tournament The tournament state object.
     * @returns {number} The elapsed seconds within the tournament, accounting for pauses.
     */
    function getEffectiveSeconds(absoluteTimestamp, tournament) {
        if (!absoluteTimestamp || !tournament.start_time) {
            return 0;
        }
        const tournamentStartTimeMs = Date.parse(tournament.start_time);
        const rawDuration = absoluteTimestamp - (tournamentStartTimeMs / 1000);
        // Subtract the total accumulated pause time to get the effective duration
        const effectiveDuration = rawDuration - tournament.total_paused_seconds;
        return effectiveDuration;
    }

    /**
     * Dynamically adjusts the font size of an element to fit its container.
     * @param {HTMLElement} element The text element to resize.
     * @param {HTMLElement} container The container element that defines the max width.
     */
    function fitText(element, container) {
        if (!element || !container) return;

        // Force the text onto a single line to get an accurate width measurement.
        element.style.whiteSpace = 'nowrap';

        // Reset font size to default to get accurate measurements
        element.style.fontSize = ''; 
        
        const containerWidth = container.clientWidth;
        let fontSize = 100; // Start with a large font size in pixels
        element.style.fontSize = fontSize + 'px';

        // Shrink the font size until the text fits
        while (element.scrollWidth > containerWidth && fontSize > 8) {
            fontSize--;
            element.style.fontSize = fontSize + 'px';
        }
    }
    /**
     * Generates the HTML string for the red 'X' penalty markers.
     * @param {number} count The number of markers to generate.
     * @returns {string} The HTML string of styled spans.
     */
    function generateIncorrectMarkers(count) {
        let markers = '';
        for (let i = 0; i < count; i++) {
            markers += ' <span style="color: red;">X</span>';
        }
        return markers;
    }

    /**
     * Creates and configures a puzzle status span element.
     * @param {string} html The innerHTML content for the span.
     * @param {string} color The CSS color for the span's text.
     * @returns {HTMLElement} The configured span element.
     */
    function createStatusSpan(html, color) {
        const span = document.createElement('span');
        span.innerHTML = html;
        span.style.color = color;
        return span;
    }

    /**
     * Safely gets and formats the timestamp of the last submission for a given puzzle.
     * @param {Array} submissionTimes The competitor's full submission_times array.
     * @param {number} index The index of the puzzle.
     * @param {object} tournament The tournament state object.
     * @returns {string} The formatted time string (e.g., "01:23") or "??:??".
     */
    function getFormattedLastSubmissionTime(submissionTimes, index, tournament) {
        const puzzleSubmissions = submissionTimes[index] || [];
        if (puzzleSubmissions.length > 0) {
            const lastSubmissionTime = puzzleSubmissions[puzzleSubmissions.length - 1];
            const effectiveSeconds = getEffectiveSeconds(lastSubmissionTime, tournament);
            return formatTime(effectiveSeconds);
        }
        return '??:??';
    }

    /**
     * Checks if any competitor has submitted an answer for the final puzzle.
     * @param {object} data The full data object from the API.
     * @returns {boolean} True if the final puzzle stage has been reached.
     */
    function isFinalPuzzleActive(data) {
        const tournament = data.tournament;
        if (!tournament || !tournament.puzzles_count) {
            return false;
        }

        const finalPuzzleIndex = tournament.puzzles_count - 1;

        // The 'some' method efficiently checks if AT LEAST ONE competitor meets the condition.
        return data.competitors.some(competitor => {
            const submissionTimes = JSON.parse(competitor.submission_times || '[]');
            // Check if there is an array for the final puzzle and if it has any entries.
            return Array.isArray(submissionTimes[finalPuzzleIndex]) && submissionTimes[finalPuzzleIndex].length > 0;
        });
    }

    /**
     * Creates and returns a formatted puzzle line item (<li>).
     * @param {string} name The puzzle's title.
     * @param {string} html The inner HTML for the time/status details.
     * @param {string} [color] The CSS color for the time/status details.
     * @returns {HTMLLIElement} The fully constructed <li> element.
     */
    function buildPuzzleLine(name, html, color) {
        const listItem = document.createElement('li');
        listItem.className = 'puzzle-line';

        const titleSpan = document.createElement('span');
        titleSpan.className = 'puzzle-title';
        titleSpan.textContent = name;

        const timeSpan = document.createElement('span');
        timeSpan.className = 'puzzle-time';
        timeSpan.innerHTML = html;
        if (color) {
            timeSpan.style.color = color;
        }
        
        listItem.appendChild(titleSpan);
        listItem.appendChild(timeSpan);
        
        return listItem;
    }

    /**
     * Updates the display for all competitors.
     * @param {object} data The full data object from the API.
     */
    function updateCompetitorDisplay(data) {
        const isFinalStage = isFinalPuzzleActive(data);
        document.body.classList.toggle('final-puzzle-active', isFinalStage);

        const container = document.getElementById('competitors-container');
        if (!container) return;

        container.innerHTML = '';
        const tournament = data.tournament;
        const puzzleNames = tournament.puzzle_names ? JSON.parse(tournament.puzzle_names) : [];
        const elementsToResize = [];

        data.competitors.forEach(competitor => {
            const competitorDiv = document.createElement('div');
            competitorDiv.className = 'competitor-card';
            const h2 = document.createElement('h2');
            h2.textContent = competitor.display_name;
            const puzzleList = document.createElement('ul');

            let currentTournamentTime;
            if (tournament.is_paused && tournament.last_pause_time) {
                const lastPauseTimestamp = Date.parse(tournament.last_pause_time) / 1000;
                currentTournamentTime = getEffectiveSeconds(lastPauseTimestamp, tournament);
            } else {
                const nowSeconds = Date.now() / 1000;
                currentTournamentTime = getEffectiveSeconds(nowSeconds, tournament);
            }

            // --- 1. GLOBAL STATUS: WAITING ---
            // This state replaces the entire puzzle list, so we handle it first.
            if (competitor.status === 'waiting') {
                const statusLi = document.createElement('li');
                const statusSpan = document.createElement('span');

                const timeToStart = Math.max(0, Math.ceil(competitor.handicap_seconds - currentTournamentTime));

                if (tournament.start_time) {
                    const focusSpan = document.createElement('span');
                    focusSpan.className = 'focus';
                    focusSpan.textContent = `${timeToStart}s`;
                    statusSpan.innerHTML = 'Starting in<br/>';
                    statusSpan.appendChild(focusSpan);
                    elementsToResize.push({ element: focusSpan, container: statusLi });
                } else {
                    let readyText = 'Get Ready';
                    if (competitor.handicap_seconds > 0) {
                        readyText += ` [+${competitor.handicap_seconds}s]`;
                    }
                    statusSpan.textContent = readyText;
                    statusSpan.className = 'focus';
                    statusSpan.style.color = 'yellow';
                    elementsToResize.push({ element: statusSpan, container: statusLi });
                }
                
                statusLi.appendChild(statusSpan);
                puzzleList.appendChild(statusLi);
            } else {
                /* / --- 2. PUZZLE LIST RENDERING ---
                puzzleNames.forEach((puzzleName, index) => {
                    const listItem = document.createElement('li');
                    
                    const incorrectCount = (JSON.parse(competitor.incorrect_answers || '[]'))[index] || 0;
                    const puzzleTimes = JSON.parse(competitor.puzzle_times || '[]');
                    const submissionTimes = JSON.parse(competitor.submission_times || '[]');
                    const incorrectJudgmentTimes = JSON.parse(competitor.incorrect_judgment_times || '[]');

                    let startTimeDisplay = '00:00';
                    if (index === 0) {
                        startTimeDisplay = formatTime(competitor.handicap_seconds);
                    } else {
                        const prevPuzzleSubmissions = submissionTimes[index - 1] || [];
                        if (prevPuzzleSubmissions.length > 0) {
                            const effectiveStartSeconds = getEffectiveSeconds(prevPuzzleSubmissions[0], tournament);
                            startTimeDisplay = formatTime(effectiveStartSeconds);
                        }
                    }
                    
                    const isCorrect = puzzleTimes[index] !== undefined && puzzleTimes[index] !== null;
                    const isCurrentPuzzle = competitor.current_puzzle === index;
                    const isFinalPuzzle = index === tournament.puzzles_count - 1;
                    // NEW: Explicitly identify the puzzle being judged.
                    const isBeingJudged = competitor.status === 'judging' && index === competitor.current_puzzle - 1;

                    // STATE: PUZZLE IS ACTIVELY BEING JUDGED
                    if (isBeingJudged) {
                        listItem.textContent = `${puzzleName}: `; 
                        const submissionTimeDisplay = getFormattedLastSubmissionTime(submissionTimes, index, tournament);
                        const incorrectMarkers = generateIncorrectMarkers(incorrectCount);
                        // Per your spec, show [JUDGING] in cyan.
                        const html = `${startTimeDisplay} ~ ${submissionTimeDisplay}${incorrectMarkers} [JUDGING]`;
                        listItem.appendChild(createStatusSpan(html, 'cyan'));

                    // STATE: CURRENTLY SOLVING
                    } else if (isCurrentPuzzle) { // This now correctly handles the competitor's active puzzle
                        const nameSpan = document.createElement('span');
                        nameSpan.className = 'focus';
                        nameSpan.textContent = puzzleName;
                        
                        const timeSpan = document.createElement('span');
                        // Status text is now ONLY '[FIXING]' if needed, never '[JUDGING]'.
                        const statusText = (incorrectCount > 0) ? '[FIXING]' : '';
                        const incorrectMarkers = generateIncorrectMarkers(incorrectCount);
                        timeSpan.innerHTML = `${startTimeDisplay} ~ ${formatTime(currentTournamentTime)}${incorrectMarkers} ${statusText}`;
                        timeSpan.style.color = 'yellow';

                        listItem.appendChild(nameSpan);
                        listItem.appendChild(document.createElement('br'));
                        listItem.appendChild(timeSpan);
                        elementsToResize.push({ element: nameSpan, container: listItem });

                    // STATE: CORRECTLY SOLVED
                    } else if (isCorrect) {
                        listItem.textContent = `${puzzleName}: `; 
                        const submissionTimeDisplay = getFormattedLastSubmissionTime(submissionTimes, index, tournament);
                        const incorrectMarkers = generateIncorrectMarkers(incorrectCount);
                        const html = `${startTimeDisplay} ~ ${submissionTimeDisplay}${incorrectMarkers} [CORRECT]`;
                        listItem.appendChild(createStatusSpan(html, 'lime'));

                    // STATE: FINAL PUZZLE, SUBMITTED BUT NOW IN PENALTY
                    } else if (isFinalPuzzle && competitor.status === 'pending_penalty') {
                        // 1. Ensure puzzle name is present.
                        listItem.textContent = `${puzzleName}: `;
                        
                        const submissionTimeDisplay = getFormattedLastSubmissionTime(submissionTimes, index, tournament);
                        // 2. Generate one fewer 'X' marker (already correct).
                        const incorrectMarkers = generateIncorrectMarkers(incorrectCount - 1); 
                        
                        // 4. Remove bracketed text from the HTML string.
                        const html = `${startTimeDisplay} ~ ${submissionTimeDisplay}${incorrectMarkers}`; 
                        
                        // 3. Change the status span color to yellow.
                        listItem.appendChild(createStatusSpan(html, 'yellow'));

                    // STATE: FUTURE PUZZLE (ON HOLD WHILE FIXING A PREVIOUS ONE)
                    } else if (competitor.current_puzzle < index && (submissionTimes[index - 1] || []).length > 0) {
                        listItem.textContent = `${puzzleName}: `;
                        let onHoldTimeDisplay = '??:??';
                        // The puzzle being fixed is at index `competitor.current_puzzle`.
                        const judgmentsForFixedPuzzle = incorrectJudgmentTimes[competitor.current_puzzle] || [];

                        if (judgmentsForFixedPuzzle.length > 0) {
                            // Get the timestamp of the MOST RECENT incorrect judgment.
                            const lastIncorrectJudgmentTime = judgmentsForFixedPuzzle[judgmentsForFixedPuzzle.length - 1];
                            const effectiveOnHoldTime = getEffectiveSeconds(lastIncorrectJudgmentTime, tournament);
                            onHoldTimeDisplay = formatTime(effectiveOnHoldTime);
                        }
                        
                        const incorrectMarkers = generateIncorrectMarkers(incorrectCount);
                        const html = `${startTimeDisplay} ~ ${onHoldTimeDisplay}${incorrectMarkers} [ON HOLD]`;
                        listItem.appendChild(createStatusSpan(html, 'pink'));

                    // STATE: NOT STARTED YET
                    } else {
                        listItem.textContent = `${puzzleName}: `;
                        listItem.appendChild(createStatusSpan(`not started`, 'gray'));
                    }
                    puzzleList.appendChild(listItem);
                }); */
                // --- 2. PUZZLE LIST RENDERING ---
                puzzleNames.forEach((puzzleName, index) => {
                    const listItem = document.createElement('li');

                    const incorrectCount = (JSON.parse(competitor.incorrect_answers || '[]'))[index] || 0;
                    const puzzleTimes = JSON.parse(competitor.puzzle_times || '[]');
                    const submissionTimes = JSON.parse(competitor.submission_times || '[]');
                    const incorrectJudgmentTimes = JSON.parse(competitor.incorrect_judgment_times || '[]');

                    let startTimeDisplay = '00:00';
                    if (index === 0) {
                        startTimeDisplay = formatTime(competitor.handicap_seconds);
                    } else {
                        const prevPuzzleSubmissions = submissionTimes[index - 1] || [];
                        if (prevPuzzleSubmissions.length > 0) {
                            const effectiveStartSeconds = getEffectiveSeconds(prevPuzzleSubmissions[0], tournament);
                            startTimeDisplay = formatTime(effectiveStartSeconds);
                        }
                    }
                    
                    const isCorrect = puzzleTimes[index] !== undefined && puzzleTimes[index] !== null;
                    const isCurrentPuzzle = competitor.current_puzzle === index;
                    const isFinalPuzzle = index === tournament.puzzles_count - 1;
                    const isBeingJudged = competitor.status === 'judging' && index === competitor.current_puzzle - 1;

                    // STATE: PUZZLE IS ACTIVELY BEING JUDGED
                    if (isBeingJudged) {
                        const submissionTimeDisplay = getFormattedLastSubmissionTime(submissionTimes, index, tournament);
                        const incorrectMarkers = generateIncorrectMarkers(incorrectCount);
                        const html = `${startTimeDisplay} ~ ${submissionTimeDisplay}${incorrectMarkers} [JUDGING]`;
                        const listItem = buildPuzzleLine(puzzleName, html, 'cyan');
                        puzzleList.appendChild(listItem);

                    // STATE: CURRENTLY SOLVING (This has a special layout, so we don't change it)
                    } else if (isCurrentPuzzle) { 
                        const nameSpan = document.createElement('span');
                        nameSpan.className = 'focus';
                        nameSpan.textContent = puzzleName;
                        
                        const timeSpan = document.createElement('span');
                        const statusText = (incorrectCount > 0) ? '[FIXING]' : '';
                        const incorrectMarkers = generateIncorrectMarkers(incorrectCount);
                        timeSpan.innerHTML = `${startTimeDisplay} ~ ${formatTime(currentTournamentTime)}${incorrectMarkers} ${statusText}`;
                        timeSpan.style.color = 'yellow';

                        listItem.appendChild(nameSpan);
                        listItem.appendChild(document.createElement('br'));
                        listItem.appendChild(timeSpan);
                        elementsToResize.push({ element: nameSpan, container: listItem });
                        puzzleList.appendChild(listItem);

                    // STATE: CORRECTLY SOLVED
                    } else if (isCorrect) {
                        const submissionTimeDisplay = getFormattedLastSubmissionTime(submissionTimes, index, tournament);
                        const incorrectMarkers = generateIncorrectMarkers(incorrectCount);
                        const html = `${startTimeDisplay} ~ ${submissionTimeDisplay}${incorrectMarkers} [CORRECT]`;
                        const listItem = buildPuzzleLine(puzzleName, html, 'lime');
                        puzzleList.appendChild(listItem);

                    // STATE: FINAL PUZZLE, SUBMITTED BUT NOW IN PENALTY
                    } else if (isFinalPuzzle && competitor.status === 'pending_penalty') {
                        const submissionTimeDisplay = getFormattedLastSubmissionTime(submissionTimes, index, tournament);
                        const incorrectMarkers = generateIncorrectMarkers(incorrectCount - 1); 
                        const html = `${startTimeDisplay} ~ ${submissionTimeDisplay}${incorrectMarkers}`; 
                        const listItem = buildPuzzleLine(puzzleName, html, 'yellow');
                        puzzleList.appendChild(listItem);

                    // STATE: FUTURE PUZZLE (ON HOLD WHILE FIXING A PREVIOUS ONE)
                    } else if (competitor.current_puzzle < index && (submissionTimes[index - 1] || []).length > 0) {
                        let onHoldTimeDisplay = '??:??';
                        const judgmentsForFixedPuzzle = incorrectJudgmentTimes[competitor.current_puzzle] || [];

                        if (judgmentsForFixedPuzzle.length > 0) {
                            const lastIncorrectJudgmentTime = judgmentsForFixedPuzzle[judgmentsForFixedPuzzle.length - 1];
                            const effectiveOnHoldTime = getEffectiveSeconds(lastIncorrectJudgmentTime, tournament);
                            onHoldTimeDisplay = formatTime(effectiveOnHoldTime);
                        }
                        
                        const incorrectMarkers = generateIncorrectMarkers(incorrectCount);
                        const html = `${startTimeDisplay} ~ ${onHoldTimeDisplay}${incorrectMarkers} [ON HOLD]`;
                        const listItem = buildPuzzleLine(puzzleName, html, 'pink');
                        puzzleList.appendChild(listItem);

                    // STATE: NOT STARTED YET
                    } else {
                        const listItem = buildPuzzleLine(puzzleName, `not started`, 'gray');
                        puzzleList.appendChild(listItem);
                    }
                });
            }
            competitorDiv.appendChild(h2);
            competitorDiv.appendChild(puzzleList);

            // --- 3. GLOBAL STATUS: EXTRA LINE (FINISHED, PENALTY, OR FINAL JUDGMENT) ---
            const extraLine = document.createElement('p');
            extraLine.className = 'extra-display-line';
            let showExtraLine = false;

            if (competitor.status === 'pending_penalty') {
                const focusSpan = document.createElement('span');
                focusSpan.className = 'focus';
                focusSpan.textContent = `${competitor.status_text}s`;
                // Prepend the final 'X' to this line.
                extraLine.innerHTML = '<span style="color: red;">X</span> [INCORRECT], Waiting for<br/>';
                extraLine.appendChild(focusSpan);
                elementsToResize.push({ element: focusSpan, container: extraLine });
                showExtraLine = true;
            } else if (competitor.status === 'finished') {
                const incorrectsObj = JSON.parse(competitor.incorrect_answers || '{}');
                const submissions = JSON.parse(competitor.submission_times || '[]');
                
                // Use the authoritative puzzles_count from the tournament object
                const lastPuzzleIndex = tournament.puzzles_count - 1;
                
                // Calculate total incorrects, excluding any on the final puzzle
                const totalIncorrects = Object.values(incorrectsObj).reduce((sum, count) => sum + count, 0);
                const lastPuzzleIncorrects = incorrectsObj[lastPuzzleIndex] || 0;
                const penaltyMinutes = totalIncorrects - lastPuzzleIncorrects;

                const lastPuzzleSubmissions = submissions[lastPuzzleIndex] || [];
                const finalSubmissionTime = lastPuzzleSubmissions[lastPuzzleSubmissions.length - 1];
                const effectiveFinalSeconds = getEffectiveSeconds(finalSubmissionTime, tournament);

                const focusSpan = document.createElement('span');
                focusSpan.className = 'focus';
                focusSpan.style.color = 'lime';

                if (penaltyMinutes > 0) {
                    const finalTimeWithPenalty = effectiveFinalSeconds + (penaltyMinutes * 60);
                    // Create a styled span for the penalty text
                    const penaltyText = `<span style="color: #ff8b8b;">(with ${penaltyMinutes}m penalty)</span>`;
                    extraLine.innerHTML = `Finished ${penaltyText} at<br/>`;
                    focusSpan.textContent = formatTime(finalTimeWithPenalty);
                } else {
                    extraLine.innerHTML = `Finished at<br/>`;
                    focusSpan.textContent = formatTime(effectiveFinalSeconds);
                }
                extraLine.appendChild(focusSpan);
                elementsToResize.push({ element: focusSpan, container: extraLine });
                showExtraLine = true;
            } else if (competitor.status === 'judging' && competitor.current_puzzle === tournament.puzzles_count) {
                // NEW: Handle the final puzzle being judged.
                const focusSpan = document.createElement('span');
                focusSpan.className = 'focus';
                focusSpan.textContent = 'Finished?';
                focusSpan.style.color = 'yellow';
                
                extraLine.appendChild(focusSpan);
                elementsToResize.push({ element: focusSpan, container: extraLine });
                showExtraLine = true;
            }

            if (showExtraLine) {
                competitorDiv.appendChild(extraLine);
            }
            
            container.appendChild(competitorDiv);
        });

        // --- 4. RESIZE ALL FOCUSED ELEMENTS ---
        elementsToResize.forEach(({ element, container }) => {
            fitText(element, container);
        });
    }

    async function fetchLatestData() {
        const url = new URL(window.location.href);
        const tournamentId = url.searchParams.get('tournament_id');
        if (!tournamentId) {
            document.body.innerHTML = '<h1>Error: No tournament ID provided.</h1>';
            return;
        }

        try {
            const response = await fetch(`/playoffs/api/status/${tournamentId}`);
            const data = await response.json();

            console.log("Full state received from server:", JSON.stringify(data, null, 2));

            if (data.status === 'error') {
                console.error(data.message);
                setTimeout(fetchLatestData, 1000);
                return;
            }

            const tournament = data.tournament;
            const puzzleNames = tournament.puzzle_names ? JSON.parse(tournament.puzzle_names) : [];
            tournamentState = tournament;
            
            updateCompetitorDisplay(data);
            clearInterval(uiTimerInterval);
            updateTimerDisplay();

            if (tournamentState && tournamentState.start_time && !tournamentState.is_paused) {
                uiTimerInterval = setInterval(updateTimerDisplay, 100);
            }

            // --- CORRECTED: Adaptive Polling Logic ---
            let nextPollDelay = 1000;

            // Define each condition separately for clarity
            const effectiveTime = getEffectiveSeconds(Date.now() / 1000, tournament);
            const isAnyoneWaitingInHandicap = data.competitors.some(c => c.status === 'waiting') && effectiveTime >= 0;
            const isPenaltyActive = data.competitors.some(c => c.status === 'pending_penalty');
            const isJudgingLastPuzzle = data.competitors.some(c => 
                c.status === 'judging' && (c.current_puzzle - 1) === (tournament.puzzles_count - 1)
            );
            const isEarlyGame = effectiveTime < 30;

            // Check if any condition is true
            if (tournament.start_time && !tournament.is_paused) {
                if (isEarlyGame || isAnyoneWaitingInHandicap || isPenaltyActive || isJudgingLastPuzzle) {
                    nextPollDelay = 250;
                }
            }

            // DEBUG LOG: See the final outcome
            //console.log(`Next poll delay set to: ${nextPollDelay}ms`);   
                    
            setTimeout(fetchLatestData, nextPollDelay);

        } catch (error) {
            console.error('Failed to fetch data:', error);
            setTimeout(fetchLatestData, 1000);
        }
    }

    // Start the whole process
    fetchLatestData();
});