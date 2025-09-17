document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENT REFERENCES ---
    const tournamentId = document.getElementById('start-unpause-button').dataset.id;
    const eventSelect = document.getElementById('event-select');
    const availablePuzzlesList = document.getElementById('available-puzzles-list');
    const selectedPuzzlesList = document.getElementById('selected-puzzles-list');
    const competitorsContainer = document.getElementById('competitors-container');
    const addCompetitorBtn = document.getElementById('add-competitor-btn');
    const saveStatus = document.getElementById('save-status');
    const statusEl = document.getElementById('tournament-status');
    const timerDisplay = document.getElementById('manage-timer-display');
    const startUnpauseButton = document.getElementById('start-unpause-button');
    const pauseButton = document.getElementById('pause-button');
    const resetButton = document.getElementById('reset-button');
    const setupForm = document.getElementById('tournament-setup-form');

    // --- GLOBAL STATE VARIABLES ---
    let timerInterval = null;
    let tournamentData = null;
    let allEventsData = [];
    let competitorRosterData = [];
    let saveTimeout;

    // --- TIMER LOGIC ---
    function formatTime(totalSeconds) {
        if (isNaN(totalSeconds)) return "-00:05";
        const sign = totalSeconds < 0 ? "-" : "";
        const absSeconds = Math.abs(totalSeconds);
        const minutes = Math.floor(absSeconds / 60);
        const seconds = Math.floor(absSeconds % 60);
        return `${sign}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    function updateTimer() {
        if (!tournamentData || !tournamentData.start_time) {
            timerDisplay.textContent = "";
            return;
        }

        // startTime is a Date object based on a UTC string from the server
        const startTime = new Date(`${tournamentData.start_time}Z`);
        let effectiveTime;

        if (tournamentData.is_paused && tournamentData.last_pause_time) {
            // This logic was also susceptible, so we make it robust with .getTime()
            const lastPause = new Date(`${tournamentData.last_pause_time}Z`);
            effectiveTime = (lastPause.getTime() - startTime.getTime()) / 1000 - tournamentData.total_paused_seconds;
        } else {
            // --- THIS IS THE FIX ---
            // Get the current time as a pure UTC millisecond timestamp
            const now = Date.now(); 
            // Get the start time as a pure UTC millisecond timestamp and subtract
            effectiveTime = (now - startTime.getTime()) / 1000 - tournamentData.total_paused_seconds;
        }

        timerDisplay.textContent = formatTime(effectiveTime);
    }

    // --- UI STATE & RENDERING ---
    function updateUIState() {
        if (!tournamentData) return;
        if (tournamentData.is_paused) {
            pauseButton.style.display = 'none';
            startUnpauseButton.style.display = 'inline-block';
            if (!tournamentData.start_time) {
                startUnpauseButton.textContent = 'Start Tournament';
                statusEl.textContent = "Ready to Start";
            } else {
                startUnpauseButton.textContent = 'Unpause Tournament';
                statusEl.textContent = "Paused";
            }
        } else {
            pauseButton.style.display = 'inline-block';
            startUnpauseButton.style.display = 'none';
            statusEl.textContent = "Running";
        }
    }

    async function loadInitialData() {
        try {
            const response = await fetch(`/playoffs/api/tournament-management-data/${tournamentId}`);
            const data = await response.json();
            if (data.status === 'error') throw new Error(data.message);
            
            tournamentData = data.tournament;
            allEventsData = data.all_events;
            competitorRosterData = data.competitor_roster;

            updateUIState();
            updateTimer();
            populateEventDropdown();
            renderPuzzleSelectors();
            renderCompetitors(data.competitors);

            if (tournamentData.start_time && !tournamentData.is_paused) {
                clearInterval(timerInterval);
                timerInterval = setInterval(updateTimer, 100);
            }
        } catch (error) {
            console.error("Failed to fetch initial data:", error);
            document.getElementById('setup-section').innerHTML = '<p style="color:red;">Failed to load tournament data.</p>';
        }
    }

    function populateEventDropdown() {
        eventSelect.innerHTML = '<option value="">-- Select an Event --</option>';
        allEventsData.forEach(event => {
            const option = document.createElement('option');
            option.value = event.id;
            option.textContent = event.name;
            if (tournamentData.event_id == event.id) {
                option.selected = true;
            }
            eventSelect.appendChild(option);
        });
    }

    function renderPuzzleSelectors() {
        const selectedEventId = eventSelect.value;
        const selectedPuzzleIds = new Set(tournamentData.puzzle_ids ? JSON.parse(tournamentData.puzzle_ids) : []);
        const eventData = allEventsData.find(e => e.id == selectedEventId);

        availablePuzzlesList.innerHTML = '';
        selectedPuzzlesList.innerHTML = '';

        if (!eventData) return;

        const eventPuzzles = new Map(eventData.puzzles.map(p => [String(p.id), p]));
        selectedPuzzleIds.forEach(puzzleId => {
            const puzzle = eventPuzzles.get(String(puzzleId));
            if (puzzle) createPuzzleListItem(puzzle, false);
        });

        eventData.puzzles.forEach(puzzle => {
            if (!selectedPuzzleIds.has(String(puzzle.id))) {
                createPuzzleListItem(puzzle, true);
            }
        });
    }

    function createPuzzleListItem(puzzle, isAvailable) {
        const li = document.createElement('li');
        li.dataset.puzzleId = puzzle.id;
        li.innerHTML = `
            <span>${puzzle.title}</span>
            <div class="puzzle-controls">
                ${isAvailable ? '' : '<button type="button" class="order-btn up-btn">▲</button><button type="button" class="order-btn down-btn">▼</button>'}
                <button type="button" class="${isAvailable ? 'add-puzzle-btn' : 'remove-puzzle-btn'}">
                    ${isAvailable ? 'Add →' : '← Remove'}
                </button>
            </div>
        `;
        if (isAvailable) availablePuzzlesList.appendChild(li);
        else selectedPuzzlesList.appendChild(li);
    }

    function renderCompetitors(competitors) {
        competitorsContainer.innerHTML = '';
        competitors.forEach(c => addCompetitorRow(c.roster_id, c.display_name, c.handicap_seconds));
        updateCompetitorDropdowns();
    }

    function addCompetitorRow(rosterId = '', displayName = '', handicap = 0) {
        const template = document.getElementById('competitor-row-template');
        const clone = template.content.cloneNode(true);
        const selectEl = clone.querySelector('.competitor-select');
        populateCompetitorDropdown(selectEl, rosterId);
        clone.querySelector('.display-name-input').value = displayName;
        clone.querySelector('.handicap-input').value = handicap;
        competitorsContainer.appendChild(clone);
    }

    function populateCompetitorDropdown(selectElement, selectedRosterId) {
        const selectedEventId = eventSelect.value;
        selectElement.innerHTML = '<option value="">-- Select Competitor --</option>';
        if (!selectedEventId) {
            selectElement.disabled = true;
            return;
        }
        selectElement.disabled = false;
        const availableCompetitors = competitorRosterData.filter(c => 
            c.assigned_events.includes(Number(selectedEventId))
        );
        availableCompetitors.forEach(competitor => {
            const option = document.createElement('option');
            option.value = competitor.id;
            option.textContent = `${competitor.name} [${competitor.country}]`;
            selectElement.appendChild(option);
        });
        selectElement.value = selectedRosterId;
    }

    function updateAllCompetitorDropdowns() {
        const allSelects = competitorsContainer.querySelectorAll('.competitor-select');
        allSelects.forEach(select => {
            const currentSelection = select.value;
            populateCompetitorDropdown(select, currentSelection);
        });
        updateCompetitorDropdowns();
    }
    
    function updateCompetitorDropdowns() {
        const allSelects = competitorsContainer.querySelectorAll('.competitor-select');
        const selectedIds = new Set();
        allSelects.forEach(select => {
            if (select.value) selectedIds.add(select.value);
        });
        allSelects.forEach(select => {
            const currentSelection = select.value;
            select.querySelectorAll('option').forEach(option => {
                option.disabled = selectedIds.has(option.value) && option.value !== currentSelection;
            });
        });
    }

    function handleCompetitorChange(event) {
        const selectElement = event.target;
        const selectedRosterId = selectElement.value;
        const parentRow = selectElement.closest('.competitor-row');
        const displayNameInput = parentRow.querySelector('.display-name-input');
        if (!selectedRosterId) {
            displayNameInput.value = '';
            return;
        }
        const competitor = competitorRosterData.find(c => c.id == selectedRosterId);
        if (competitor) {
            let defaultDisplayName = competitor.name;
            if (competitor.country) {
                defaultDisplayName += ` [${competitor.country}]`;
            }
            displayNameInput.value = defaultDisplayName;
        }
    }

    // --- AUTO-SAVING ---
    async function saveConfiguration() {
        saveStatus.textContent = 'Saving...';
        const selectedPuzzleIds = Array.from(selectedPuzzlesList.children).map(li => li.dataset.puzzleId);
        const competitors = [];
        const competitorRows = competitorsContainer.querySelectorAll('.competitor-row');
        competitorRows.forEach(row => {
            const rosterId = row.querySelector('.competitor-select').value;
            if (rosterId) {
                competitors.push({
                    roster_id: rosterId,
                    display_name: row.querySelector('.display-name-input').value,
                    handicap_seconds: row.querySelector('.handicap-input').value || 0
                });
            }
        });
        const data = {
            event_id: eventSelect.value,
            puzzle_ids: selectedPuzzleIds,
            competitors: competitors
        };

        try {
            const response = await fetch(`/playoffs/api/configure-tournament/${tournamentId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (result.status === 'success') {
                saveStatus.textContent = 'Saved!';
                tournamentData.event_id = data.event_id;
                tournamentData.puzzle_ids = JSON.stringify(data.puzzle_ids);
            } else { throw new Error(result.message); }
        } catch (error) {
            console.error('Save request failed:', error);
            saveStatus.textContent = 'Error saving.';
        }
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => { saveStatus.textContent = ''; }, 3000);
    }

    // --- EVENT LISTENERS ---
    eventSelect.addEventListener('change', () => {
        tournamentData.event_id = eventSelect.value;
        tournamentData.puzzle_ids = '[]';
        renderPuzzleSelectors();
        updateAllCompetitorDropdowns();
        saveConfiguration();
    });

    const puzzleListsContainer = document.querySelector('.puzzle-selection-grid');
    if (puzzleListsContainer) {
        puzzleListsContainer.addEventListener('click', e => {
            const button = e.target;
            const li = button.closest('li');
            if (!li) return;

            const puzzleIdToMove = li.dataset.puzzleId;
            let selectedIds = tournamentData.puzzle_ids ? JSON.parse(tournamentData.puzzle_ids) : [];

            if (button.classList.contains('add-puzzle-btn')) {
                if (!selectedIds.includes(puzzleIdToMove)) selectedIds.push(puzzleIdToMove);
            } else if (button.classList.contains('remove-puzzle-btn')) {
                selectedIds = selectedIds.filter(id => id != puzzleIdToMove);
            } else if (button.classList.contains('up-btn')) {
                const index = selectedIds.indexOf(puzzleIdToMove);
                if (index > 0) [selectedIds[index], selectedIds[index - 1]] = [selectedIds[index - 1], selectedIds[index]];
            } else if (button.classList.contains('down-btn')) {
                const index = selectedIds.indexOf(puzzleIdToMove);
                if (index > -1 && index < selectedIds.length - 1) [selectedIds[index], selectedIds[index + 1]] = [selectedIds[index + 1], selectedIds[index]];
            } else {
                return;
            }

            tournamentData.puzzle_ids = JSON.stringify(selectedIds);
            renderPuzzleSelectors();
            saveConfiguration();
        });
    }

    addCompetitorBtn.addEventListener('click', () => {
        addCompetitorRow();
        updateCompetitorDropdowns();
    });

    competitorsContainer.addEventListener('click', e => {
        if (e.target.classList.contains('remove-row-btn')) {
            e.target.closest('.competitor-row').remove();
            updateCompetitorDropdowns();
            saveConfiguration();
        }
    });
    
    competitorsContainer.addEventListener('change', e => {
        if (e.target.classList.contains('competitor-select')) {
            handleCompetitorChange(e);
        }
        updateCompetitorDropdowns();
        saveConfiguration();
    });

    startUnpauseButton.addEventListener('click', async () => {
        await fetch(`/playoffs/api/start-unpause-tournament/${tournamentId}`, { method: 'POST' });
        loadInitialData();
    });

    pauseButton.addEventListener('click', async () => {
        await fetch(`/playoffs/api/pause-tournament/${tournamentId}`, { method: 'POST' });
        loadInitialData();
    });

    resetButton.addEventListener('click', async () => {
        if (confirm('Are you sure you want to reset this tournament? All progress will be lost.')) {
            const response = await fetch(`/playoffs/api/reset-tournament-progress/${tournamentId}`, { method: 'POST' });
            const result = await response.json();
            alert(result.message);
            loadInitialData();
        }
    });

    // --- INITIALIZATION ---
    loadInitialData();
});