const API_URL = '/api/slots';

const slotForm = document.getElementById('slot-form');
const modifyForm = document.getElementById('modify-form');
const viewForm = document.getElementById('view-form');
const slotsList = document.getElementById('slots');

function formatDateTime(input) {
    return input ? input.replace('T', ' ') : null;
}

// Load slots
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
                slotsList.innerHTML = `<li>No slots found for this signup ID.</li>`;
                return;
            }
            data.forEach(slot => {
                const li = document.createElement('li');
                li.textContent = `Slot ID: ${slot.slotId}, Start: ${slot.start}, Duration: ${slot.duration} min, Max Members: ${slot.maxMembers}, Signed Members: ${slot.members.length}`;
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Delete';
                deleteBtn.onclick = () => deleteSlot(slot.slotId, signupId);
                li.appendChild(deleteBtn);
                slotsList.appendChild(li);
            });
        })
        .catch(err => {
            slotsList.innerHTML = `<li>Error loading slots: ${err.message}</li>`;
        });
}

// Add slot
slotForm.onsubmit = function (e) {
    e.preventDefault();
    const signupId = parseInt(document.getElementById('signupId').value);
    const start = formatDateTime(document.getElementById('start').value);
    const slotDuration = parseInt(document.getElementById('slotDuration').value);
    const numSlots = parseInt(document.getElementById('numSlots').value);
    const maxMembers = parseInt(document.getElementById('maxMembers').value);

    fetch(`${API_URL}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signupId, start, slotDuration, numSlots, maxMembers })
    })
        .then(res => res.json())
        .then(data => {
            if (data.errors) {
                const messages = data.errors.map(e => e.msg).join('\n');
                alert('Error: ' + messages);
            } else if (data.error) {
                alert('Error: ' + data.error);
            } else {
                alert(`Added ${data.added.length} slot(s) successfully.`);
                slotForm.reset();
                loadSlots(signupId);
            }
        })
        .catch(err => alert('Error: ' + err.message));
};

// Modify slot
modifyForm.onsubmit = function (e) {
    e.preventDefault();
    const slotId = parseInt(document.getElementById('modSlotId').value);
    const startVal = document.getElementById('modStart').value;
    const durationVal = document.getElementById('modDuration').value;
    const maxMembersVal = document.getElementById('modMaxMembers').value;

    const start = startVal ? startVal.replace('T', ' ') : undefined;
    const duration = durationVal ? parseInt(durationVal) : undefined;
    const maxMembers = maxMembersVal ? parseInt(maxMembersVal) : undefined;

    const payload = { slotId };
    if (start !== undefined) payload.start = start;
    if (duration !== undefined) payload.duration = duration;
    if (maxMembers !== undefined) payload.maxMembers = maxMembers;

    fetch(`${API_URL}/modify`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
        .then(res => res.json())
        .then(data => {
            if (data.errors) {
                const messages = data.errors.map(e => e.msg).join('\n');
                alert('Error: ' + messages);
            } else if (data.error) {
                alert('Error: ' + data.error);
            } else {
                alert(data.message);
                modifyForm.reset();
            }
        })
        .catch(err => alert('Error: ' + err.message));
};

// Delete slot
function deleteSlot(slotId, signupId) {
    if (!confirm(`Delete slot ID ${slotId}?`)) return;
    fetch(`${API_URL}/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId })
    })
        .then(res => res.json())
        .then(data => {
            if (data.errors) {
                const messages = data.errors.map(e => e.msg).join('\n');
                alert('Error: ' + messages);
            } else if (data.error) {
                alert('Error: ' + data.error);
            } else {
                loadSlots(signupId);
            }
        })
        .catch(err => alert('Error: ' + err.message));
}

viewForm.onsubmit = function (e) {
    e.preventDefault();
    const signupId = parseInt(document.getElementById('viewSignupId').value);
    loadSlots(signupId);
};