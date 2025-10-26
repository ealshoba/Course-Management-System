const API_URL = '/api/grades';
const slotMembersList = document.getElementById('slot-members');
const gradesList = document.getElementById('grades-list');

const viewForm = document.getElementById('view-form');
const gradeForm = document.getElementById('grade-form');

// Get members by slot id
viewForm.onsubmit = function (e) {
    e.preventDefault();
    const slotId = document.getElementById('slotId').value;

    fetch(`${API_URL}/${slotId}`)
        .then(res => res.json())
        .then(data => {
            slotMembersList.innerHTML = '';

            if (data.errors && Array.isArray(data.errors)) {
                const messages = data.errors.map(e => e.msg).join('\n');
                alert('Error: ' + messages);
                return;
            } else if (data.error) {
                alert('Error: ' + data.error);
                return;
            }

            if (!data.members || data.members.length === 0) {
                const li = document.createElement('li');
                li.textContent = 'No members signed up for this slot.';
                slotMembersList.appendChild(li);
                return;
            }

            data.members.forEach(memberId => {
                const li = document.createElement('li');
                li.textContent = `Member ID: ${memberId}`;
                slotMembersList.appendChild(li);
            });
        })
        .catch(err => alert('Error: ' + err.message));
};

// Enter (or modify if exists) a grade
gradeForm.onsubmit = function (e) {
    e.preventDefault();

    const memberId = document.getElementById('memberId').value.trim();
    const signupId = parseInt(document.getElementById('signupId').value);
    const grade = parseInt(document.getElementById('grade').value);
    const comment = document.getElementById('comment').value.trim();

    fetch(`${API_URL}/enter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, signupId, grade, comment })
    })
        .then(res => res.json())
        .then(data => {
            if (data.errors && Array.isArray(data.errors)) {
                const messages = data.errors.map(e => e.msg).join('\n');
                alert('Error: ' + messages);
                return;
            } else if (data.error) {
                alert('Error: ' + data.error);
                return;
            }

            const li = document.createElement('li');

            if (data.updated) {
                li.innerHTML = `<span>${memberId}</span>Grade updated: ${data.oldGrade} → ${data.updated.grade}, Comment: "${data.updated.comment || ''}"`;
            } else {
                li.innerHTML = `<span>${memberId}</span>Grade: ${data.grade.grade}, Comment: "${data.grade.comment || ''}"`;
            }

            gradesList.appendChild(li);
            gradeForm.reset();
        })
        .catch(err => alert('Error: ' + err.message));
};