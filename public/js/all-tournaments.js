document.addEventListener('DOMContentLoaded', () => {
    // Handle the submission for creating a new tournament
    const createForm = document.getElementById('create-tournament-form');
    if (createForm) {
        createForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const displayNameInput = document.getElementById('display-name');
            if (!displayNameInput.value.trim()) {
                alert('Tournament name cannot be empty.');
                return;
            }

            const response = await fetch('/playoffs/api/create-empty-tournament', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ displayName: displayNameInput.value.trim() })
            });

            const result = await response.json();
            
            if (result.status === 'success') {
                alert('Tournament created successfully!');
                window.location.reload();
            } else {
                alert('Error: ' + result.message);
            }
        });
    }

    // Handle the delete buttons for existing tournaments
    document.querySelectorAll('.delete-tournament-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const tournamentId = e.target.dataset.id;
            if (confirm(`Are you sure you want to permanently delete tournament #${tournamentId}? This cannot be undone.`)) {
                
                const response = await fetch(`/playoffs/api/delete-tournament/${tournamentId}`, {
                    method: 'POST'
                });

                const result = await response.json();

                if (result.status === 'success') {
                    alert('Tournament deleted.');
                    window.location.reload();
                } else {
                    alert('Error: ' + result.message);
                }
            }
        });
    });
});