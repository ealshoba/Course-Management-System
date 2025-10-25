const API_URL = '/api/courses';

const addForm = document.getElementById('member-add-form');
const deleteForm = document.getElementById('member-delete-form');
const getForm = document.getElementById('member-get-form');
const addResult = document.getElementById('memberAddResult');
const deleteResult = document.getElementById('memberDeleteResult');
const getResult = document.getElementById('memberGetResult');

// Add Members
addForm.onsubmit = function (e) {
    e.preventDefault();

    const termCode = document.getElementById('memberAddTermCode').value.trim();
    const section = document.getElementById('memberAddSection').value.trim();
    const rawInput = document.getElementById('memberAddList').value.trim();

    if (!rawInput) {
        addResult.textContent = 'Please enter at least one member.';
        return;
    }

    const lines = rawInput.split('\n');
    const members = [];

    for (let i = 0; i < lines.length; i++) {
        const parts = lines[i].split(',').map(s => s.trim());
        if (parts.length !== 4) continue;

        members.push({
            memberId: parts[0],
            firstName: parts[1],
            lastName: parts[2],
            role: parts[3]
        });
    }

    fetch(API_URL + '/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            termCode: termCode,
            section: section,
            members: members
        })
    })
        .then(res => res.json())
        .then(data => {
            if (data.errors && Array.isArray(data.errors)) {
                addResult.textContent = 'Validation Errors:\n' + data.errors.join('\n');
            } else if (data.error) {
                addResult.textContent = 'Error: ' + data.error;
            } else {
                addResult.textContent = 'Added: ' + data.addedCount + ' | Ignored: ' + (data.ignored.join(', ') || 'None');
                addForm.reset();
            }
        })
        .catch(() => {
            addResult.textContent = 'Error connecting to server.';
        });
};

// Delete Members
deleteForm.onsubmit = function (e) {
    e.preventDefault();

    const termCode = document.getElementById('memberDeleteTermCode').value.trim();
    const section = document.getElementById('memberDeleteSection').value.trim();
    const rawIds = document.getElementById('memberDeleteList').value.trim();

    if (!rawIds) {
        deleteResult.textContent = 'Please enter member IDs to delete.';
        return;
    }

    const memberIds = rawIds.split(',').map(id => id.trim()).filter(id => id.length > 0);

    if (!confirm(`Delete ${memberIds.length} member(s) from Term: ${termCode}, Section: ${section}?`)) {
        return;
    }

    fetch(API_URL + '/deleteMembers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            termCode: termCode,
            section: section,
            memberIds: memberIds
        })
    })
        .then(res => res.json())
        .then(data => {
            if (data.errors && Array.isArray(data.errors)) {
                deleteResult.textContent = 'Validation Errors:\n' + data.errors.join('\n');
            } else if (data.error) {
                deleteResult.textContent = 'Error: ' + data.error;
            } else {
                deleteResult.textContent = 'Deleted: ' + data.deletedCount + ' | Not Found: ' + (data.notFound.join(', ') || 'None');
                deleteForm.reset();
            }
        })
        .catch(() => {
            deleteResult.textContent = 'Error connecting to server.';
        });
};

// Get Members
getForm.onsubmit = function (e) {
    e.preventDefault();
    const termCode = document.getElementById('memberGetTermCode').value.trim();
    const section = document.getElementById('memberGetSection').value.trim();
    const role = document.getElementById('memberGetRole').value.trim();
    getMembers(termCode, section, role);
};


// Get Members
function getMembers(termCode, section = 1, role = '') {
    const membersList = document.getElementById('memberGetResult');
    membersList.innerHTML = '';

    let url = API_URL + `/${termCode}`;
    if (section) url += `/${section}`;
    if (role) url += `?role=${encodeURIComponent(role)}`;

    fetch(url)
        .then(function (res) { return res.json(); })
        .then(function (members) {
            if (!Array.isArray(members) || members.length === 0) {
                membersList.textContent = 'No members found.';
                return;
            }
            members.forEach(function (m) {
                let li = document.createElement('li');
                li.textContent = `ID: ${m.memberId}, First Name: ${m.firstName}, Last Name: ${m.lastName}, Role: ${m.role}`;
                membersList.appendChild(li);
            });
        })
        .catch(function () {
            membersList.textContent = 'Error connecting to server.';
        });
}