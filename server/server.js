const express = require('express');
const app = express();

require('dotenv').config();
app.use(express.json());

app.use('/', express.static('../client'));


const courses = require('./courses');
const members = require('./members');
const signups = require('./signups');
const slots = require('./slots');
const grades = require('./grades');
const auth = require('./auth');
const { verifyToken, requireRole } = require('./authMiddleware');


app.use('/api/courses', courses);
app.use('/api/courses', members);
app.use('/api/signups', signups);
app.use('/api/slots', slots);
app.use('/api/grades', grades);
app.use('/api/auth', auth);


const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on port ${port}...`));