document.addEventListener('DOMContentLoaded', () => {
    const eventsContainer = document.getElementById('events-container');
    const createEventForm = document.getElementById('create-event-form');
    const newEventNameInput = document.getElementById('new-event-name');

    // --- API HELPER FUNCTIONS ---

    async function createEvent(name) {
        try {
            const response = await fetch('/playoffs/api/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name })
            });
            if (!response.ok) throw new Error('Server responded with an error.');
            loadEventsAndPuzzles();
        } catch (error) {
            console.error('Failed to create event:', error);
            alert('Error: Could not create event.');
        }
    }

    async function createPuzzle(title, eventId) {
        try {
            const response = await fetch('/playoffs/api/puzzles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: title, event_id: eventId })
            });
            if (!response.ok) throw new Error('Server responded with an error.');
            loadEventsAndPuzzles();
        } catch (error) {
            console.error('Failed to create puzzle:', error);
            alert('Error: Could not create puzzle.');
        }
    }

    async function deletePuzzle(puzzleId) {
        try {
            const response = await fetch(`/playoffs/api/puzzles/${puzzleId}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Server responded with an error.');
            loadEventsAndPuzzles();
        } catch (error) {
            console.error('Failed to delete puzzle:', error);
            alert('Error: Could not delete puzzle.');
        }
    }

    // NEW: Function to update an event name
    async function updateEventName(eventId, name) {
        try {
            await fetch(`/playoffs/api/events/${eventId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name })
            });
            // No need to reload here, the blur/enter handler will do it.
        } catch (error) {
            console.error('Failed to update event:', error);
            alert('Error: Could not update event name.');
        }
    }

    // NEW: Function to update a puzzle title
    async function updatePuzzleTitle(puzzleId, title) {
        try {
            await fetch(`/playoffs/api/puzzles/${puzzleId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: title })
            });
        } catch (error) {
            console.error('Failed to update puzzle:', error);
            alert('Error: Could not update puzzle title.');
        }
    }

    // --- UI RENDERING ---

    async function loadEventsAndPuzzles() {
        try {
            const response = await fetch('/playoffs/api/events-with-puzzles');
            const events = await response.json();
            eventsContainer.innerHTML = '';

            if (events.length === 0) {
                eventsContainer.innerHTML = '<p>No events found. Create one to begin.</p>';
                return;
            }

            events.forEach(event => {
                const eventCard = document.createElement('div');
                eventCard.className = 'event-card';

                let puzzlesHTML = '';
                event.puzzles.forEach(puzzle => {
                    puzzlesHTML += `
                        <li data-puzzle-id="${puzzle.id}">
                            <span class="editable puzzle-title">${puzzle.title}</span>
                            <button class="delete-btn" data-puzzle-id="${puzzle.id}">Delete</button>
                        </li>
                    `;
                });

                eventCard.innerHTML = `
                    <h3 class="editable event-title" data-event-id="${event.id}">${event.name}</h3>
                    <ul class="puzzle-list">${puzzlesHTML}</ul>
                    <form class="inline-form add-puzzle-form" data-event-id="${event.id}">
                        <input type="text" class="new-puzzle-title" placeholder="New Puzzle Title" required>
                        <button type="submit">Add Puzzle</button>
                    </form>
                `;
                eventsContainer.appendChild(eventCard);
            });
        } catch (error) {
            console.error('Failed to load events and puzzles:', error);
            eventsContainer.innerHTML = '<p style="color: red;">Error loading data.</p>';
        }
    }

    // --- EVENT LISTENERS ---

    createEventForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (newEventNameInput.value) {
            createEvent(newEventNameInput.value.trim());
            newEventNameInput.value = '';
        }
    });

    // Use Event Delegation for all dynamic content
    eventsContainer.addEventListener('click', (e) => {
        // Handle delete button clicks
        if (e.target.classList.contains('delete-btn')) {
            const puzzleId = e.target.dataset.puzzleId;
            if (confirm('Are you sure you want to delete this puzzle?')) {
                deletePuzzle(puzzleId);
            }
        }
        
        // NEW: Handle clicks on editable text
        if (e.target.classList.contains('editable')) {
            makeEditable(e.target);
        }
    });

    eventsContainer.addEventListener('submit', (e) => {
        if (e.target.classList.contains('add-puzzle-form')) {
            e.preventDefault();
            const eventId = e.target.dataset.eventId;
            const titleInput = e.target.querySelector('.new-puzzle-title');
            if (titleInput.value) {
                createPuzzle(titleInput.value.trim(), eventId);
                titleInput.value = '';
            }
        }
    });

    // NEW: In-place editing handler
    function makeEditable(element) {
        const isEvent = element.classList.contains('event-title');
        const id = isEvent ? element.dataset.eventId : element.closest('li').dataset.puzzleId;
        const originalText = element.textContent;

        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalText;
        input.className = 'edit-in-place';
        
        element.replaceWith(input);
        input.focus();

        const saveChanges = async () => {
            const newText = input.value.trim();
            if (newText && newText !== originalText) {
                if (isEvent) {
                    await updateEventName(id, newText);
                } else {
                    await updatePuzzleTitle(id, newText);
                }
            }
            loadEventsAndPuzzles(); // Always reload to restore original text display
        };

        input.addEventListener('blur', saveChanges);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                input.blur(); // Trigger the blur event to save
            } else if (e.key === 'Escape') {
                loadEventsAndPuzzles(); // Cancel editing by reloading
            }
        });
    }

    // Initial Load
    loadEventsAndPuzzles();
});