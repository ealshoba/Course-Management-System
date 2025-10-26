const signupForm = document.getElementById('signup-form');
const signupsList = document.getElementById('signups');
const filterForm = document.getElementById('filter-form');

const API_URL = '/api/signups';

// Load signup sheets
function loadSignups(termCode, section = 1) {
    signupsList.innerHTML = '';
    fetch(`${API_URL}/${termCode}?section=${section}`)
        .then(res => res.json())
        .then(signups => {
            if (signups.errors && Array.isArray(signups.errors)) {
                signupsList.innerHTML = '<li>Validation Errors:<br>' + signups.errors.join('<br>') + '</li>';
                return;
            }
            if (!signups.length) {
                signupsList.innerHTML = '<li>No signup sheets found.</li>';
                return;
            }
            signups.forEach(signup => {
                const li = document.createElement('li');
                li.textContent = `#${signup.signupId}: ${signup.assignmentName} (${signup.notBefore} → ${signup.notAfter})`;

                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Delete';
                deleteBtn.onclick = () => deleteSignup(signup.signupId, termCode, section);

                li.appendChild(deleteBtn);
                signupsList.appendChild(li);
            });
        });
}

// Create signup sheet
signupForm.onsubmit = function (e) {
    e.preventDefault();

    const termCode = parseInt(document.getElementById('termCode').value);
    const section = parseInt(document.getElementById('section').value);
    const assignmentName = document.getElementById('assignmentName').value;
    const notBefore = document.getElementById('notBefore').value.replace('T', ' ');
    const notAfter = document.getElementById('notAfter').value.replace('T', ' ');

    fetch(`${API_URL}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ termCode, section, assignmentName, notBefore, notAfter })
    })
        .then(res => res.json())
        .then(data => {
            if (data.errors && Array.isArray(data.errors)) {
                alert('Validation Errors:\n' + data.errors.join('\n'));
            } else if (data.error) {
                alert('Error: ' + data.error);
            } else {
                signupForm.reset();
                loadSignups(termCode, section);
            }
        })
        .catch(() => {
            alert('Error connecting to server.');
        });
};

// Delete signup sheet
function deleteSignup(signupId, termCode, section) {
    if (!confirm(`Delete signup sheet ID ${signupId}?`)) return;

    fetch(`${API_URL}/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signupId })
    })
        .then(res => res.json())
        .then(data => {
            if (data.errors && Array.isArray(data.errors)) {
                alert('Validation Errors:\n' + data.errors.join('\n'));
            } else if (data.error) {
                alert('Error: ' + data.error);
            } else {
                loadSignups(termCode, section);
            }
        })
        .catch(() => {
            alert('Error connecting to server.');
        });
}

// Handle filter form
filterForm.onsubmit = function (e) {
    e.preventDefault();

    const termCode = parseInt(document.getElementById('filterTermCode').value);
    const section = parseInt(document.getElementById('filterSection').value) || 1;

    loadSignups(termCode, section);
};