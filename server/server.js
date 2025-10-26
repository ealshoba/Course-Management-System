const express = require('express');
const app = express();

app.use(express.json());

app.use('/', express.static('../client'));




const courses = require('./courses');
const members = require('./members');
const signups = require('./signups');


app.use('/api/courses', courses);
app.use('/api/courses', members);
app.use('/api/signups', signups);




const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on port ${port}...`));