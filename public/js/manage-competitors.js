document.addEventListener('DOMContentLoaded', () => {
    const addCompetitorForm = document.getElementById('add-competitor-form');
    const competitorTableBody = document.getElementById('competitor-table-body');
    const saveStatus = document.getElementById('save-status');
    let saveTimeout;

    // Handles auto-saving the event checkbox changes
    async function updateAssignment(rosterId, eventId, isAssigned) {
        if (saveStatus) {
            clearTimeout(saveTimeout);
            saveStatus.textContent = 'Saving...';
            saveStatus.style.color = ''; // Reset color
        }

        try {
            const response = await fetch('/playoffs/api/competitor-event-assignment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roster_id: rosterId,
                    event_id: eventId,
                    is_assigned: isAssigned
                })
            });

            if (!response.ok) {
                throw new Error('Server responded with an error.');
            }

            if (saveStatus) {
                saveStatus.textContent = 'Saved!';
                saveTimeout = setTimeout(() => { saveStatus.textContent = ''; }, 2000);
            }

        } catch (error) {
            console.error('Failed to update assignment', error);
            if (saveStatus) {
                saveStatus.textContent = 'Error!';
                saveStatus.style.color = 'red';
            }
            alert('Error saving assignment. Please try again.');
        }
    }

    // Listens for clicks on any of the event assignment checkboxes
    if (competitorTableBody) {
        competitorTableBody.addEventListener('change', e => {
            if (e.target.classList.contains('event-assign-cb')) {
                const checkbox = e.target;
                const rosterId = checkbox.closest('tr').dataset.competitorId;
                const eventId = checkbox.dataset.eventId;
                const isAssigned = checkbox.checked;
                
                updateAssignment(rosterId, eventId, isAssigned);
            }
        });
    }

    // Handles adding a new competitor from the form
    if (addCompetitorForm) {
        addCompetitorForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(addCompetitorForm);
            const competitorData = {
                name: formData.get('name'),
                country: formData.get('country')
            };

            try {
                const response = await fetch('/playoffs/api/competitors', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(competitorData)
                });
                const result = await response.json();

                if (result.status === 'success') {
                    // On success, just reload the page. No more alert!
                    window.location.reload();
                } else {
                    // Show an alert only if there's an error.
                    alert(result.message);
                }
            } catch (error) {
                console.error("Failed to add competitor:", error);
                alert("An error occurred. Could not add competitor.");
            }
        });
    }

    // Handles editing and deleting competitors using event delegation
    document.addEventListener('click', async (e) => {
        if (e.target.classList.contains('edit-competitor-btn')) {
            const id = e.target.dataset.id;
            const name = e.target.dataset.name;
            const country = e.target.dataset.country;

            const newName = prompt(`Enter new name for ${name}:`, name);
            if (newName !== null) {
                const newCountry = prompt(`Enter new country for ${newName}:`, country);
                if (newCountry !== null) {
                    const response = await fetch(`/playoffs/api/competitors/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: newName, country: newCountry })
                    });
                    const result = await response.json();
                    alert(result.message);
                    if (result.status === 'success') {
                        window.location.reload();
                    }
                }
            }
        }
        
        if (e.target.classList.contains('delete-competitor-btn')) {
            if (confirm('Are you sure you want to delete this competitor? This cannot be undone.')) {
                const competitorId = e.target.dataset.id;

                const response = await fetch(`/playoffs/api/competitors/${competitorId}`, {
                    method: 'DELETE'
                });
                const result = await response.json();

                alert(result.message);
                if (result.status === 'success') {
                    window.location.reload();
                }
            }
        }
    });
});