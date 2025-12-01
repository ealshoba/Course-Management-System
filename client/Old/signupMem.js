const API_URL = '/api/slots';

const viewForm = document.getElementById('view-form');
const signupForm = document.getElementById('signup-form');
const removeForm = document.getElementById('remove-form');
const slotsList = document.getElementById('slots');

// Load all slots for a given signup sheet
function loadSlots(signupId) {
    slotsList.innerHTML = '';

    fetch(`${API_URL}/${signupId}`)
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                slotsList.innerHTML = `<li>${data.error}</li>`;
                return;
            }

            if (data.length === 0) {
                slotsList.innerHTML = `<li>No slots available for this signup ID.</li>`;
                return;
            }

            data.forEach(slot => {
                const li = document.createElement('li');
                const members = slot.members.length
                    ? slot.members.join(', ')
                    : 'No members yet';

                li.innerHTML = `
          <strong>Slot ID:</strong> ${slot.slotId}<br>
          <strong>Start:</strong> ${slot.start}<br>
          <strong>Duration:</strong> ${slot.duration} min<br>
          <strong>Max Members:</strong> ${slot.maxMembers}<br>
          <strong>Current Members:</strong> ${members}
        `;

                slotsList.appendChild(li);
            });
        })
        .catch(err => {
            slotsList.innerHTML = `<li>Error loading slots: ${err.message}</li>`;
        });
}

// Sign up for a slot
signupForm.onsubmit = function (e) {
    e.preventDefault();

    const signupId = parseInt(document.getElementById('signupId').value);
    const slotId = parseInt(document.getElementById('slotId').value);
    const memberId = document.getElementById('memberId').value.trim();

    fetch(`${API_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signupId, slotId, memberId })
    })
        .then(res => res.json())
        .then(data => {
            if (data.errors) {
                const messages = data.errors.map(e => e.msg).join('\n');
                alert('Error: ' + messages);
            } else if (data.error) {
                alert('Error: ' + data.error);
            } else {
                alert('Signed up successfully!');
                signupForm.reset();
                loadSlots(signupId);
            }
        })
        .catch(err => alert('Error: ' + err.message));
};

// Remove sign-up
removeForm.onsubmit = function (e) {
    e.preventDefault();

    const signupId = parseInt(document.getElementById('removeSignupId').value);
    const memberId = document.getElementById('removeMemberId').value.trim();

    fetch(`${API_URL}/deleteSignup`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signupId, memberId })
    })
        .then(res => res.json())
        .then(data => {
            if (data.errors) {
                const messages = data.errors.map(e => e.msg).join('\n');
                alert('Error: ' + messages);
            } else if (data.error) {
                alert('Error: ' + data.error);
            } else {
                alert('Sign-up removed successfully.');
                removeForm.reset();
                loadSlots(signupId);
            }
        })
        .catch(err => alert('Error: ' + err.message));
};


viewForm.onsubmit = function (e) {
    e.preventDefault();
    const signupId = parseInt(document.getElementById('viewSignupId').value);
    loadSlots(signupId);
};