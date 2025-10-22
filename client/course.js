const courseForm = document.getElementById('course-form');
const modifyForm = document.getElementById('modify-form');
const coursesList = document.getElementById('courses');

const API_URL = '/api/courses';

// Load courses
function loadCourses() {
    coursesList.innerHTML = '';
    fetch(API_URL)
        .then(function (res) { return res.json(); })
        .then(function (courses) {
            courses.forEach(function (course) {
                let li = document.createElement('li');
                li.textContent = 'Term: ' + course.termCode + ', Name: ' + course.courseName + ', Section: ' + course.section;

                let deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Delete';
                deleteBtn.onclick = function () { deleteCourse(course.termCode, course.section); };

                li.appendChild(deleteBtn);
                coursesList.appendChild(li);
            });
        });
}


// Create course
courseForm.onsubmit = function (e) {
    e.preventDefault();

    var termCode = parseInt(document.getElementById('termCode').value);
    var courseName = document.getElementById('courseName').value;
    var section = parseInt(document.getElementById('section').value);

    fetch(API_URL + '/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ termCode: termCode, courseName: courseName, section: section })
    })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            if (data.error) {
                alert('Error: ' + data.error);
            } else if (data.errors) {
                alert('Errors:\n' + data.errors.join('\n'));
            } else {
                courseForm.reset();
                loadCourses();
            }
        });
};


// Modify course
modifyForm.onsubmit = function (e) {
    e.preventDefault();

    const termCode = parseInt(document.getElementById('modTermCode').value);
    const section = parseInt(document.getElementById('modSection').value);
    const courseName = document.getElementById('modCourseName').value;
    const newSection = document.getElementById('modNewSection').value;

    const body = {
        termCode,
        section
    };

    if (courseName.trim() !== '') body.courseName = courseName;
    if (newSection !== '') body.newSection = parseInt(newSection);

    fetch(API_URL + '/modify', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                alert('Error: ' + data.error);
            } else if (data.errors) {
                alert('Errors:\n' + data.errors.join('\n'));
            } else {
                modifyForm.reset();
                loadCourses();
            }
        });
};


// Delete course
function deleteCourse(termCode, section) {
    if (!confirm('Delete course Term: ' + termCode + ', Section: ' + section + '?')) return;

    fetch(API_URL + '/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ termCode: termCode, section: section })
    })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            if (data.error) {
                alert('Error: ' + data.error);
            } else if (data.errors) {
                alert('Errors:\n' + data.errors.join('\n'));
            } else {
                loadCourses();
            }
        });
}

// Initial load
loadCourses();