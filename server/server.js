const express = require('express');
const app = express();

app.use(express.json());

app.use('/', express.static('../client'));




const courses = require('./courses');




app.use('/api/courses', courses);






const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on port ${port}...`));