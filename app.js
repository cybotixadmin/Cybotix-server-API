
const express = require('express');
const fileUpload = require('express-fileupload');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const path = require('path');

const app = express();

var routes = require('./routes');
var frontPage = require('./routes/user2.js');
var newPage = require('./routes/user.js');

console.log(frontPage);
//const playerRoutes = require('./routes/player.routes');
const homeRoutes = require('./routes/index.routes');
const port = 2001;


// create connection to database
// the mysql.createConnection function takes in a configuration object which contains host, user, password and the database name.
//const db = mysql.createConnection ({
//   host     : 'database-1.cw8f6epdqxi2.us-east-2.rds.amazonaws.com',
//  user     : 'admin',
//  password : 'ibmaix01',
//  port     : '3306',
//database: 'socka'
//});


// connect to database
db.connect((err) => {
    if (err) {
        throw err;
    }
    console.log('Connected to database');
});
global.db = db;

// configure middleware
app.set('port', process.env.port || port); // set express to use this port
app.set('views', __dirname + '/views'); // set express to look in this folder to render our view
app.set('view engine', 'ejs'); // configure template engine
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json()); // parse form data client
app.use(express.static(path.join(__dirname, 'public'))); // configure express to use public folder
app.use(fileUpload()); // configure fileupload

// routes for the app
console.log("1");
app.get('/', newPage.frontpage);
//app.use('/player', playerRoutes);
console.log("2");

app.use('/admin', frontPage.frontpage);
console.log("3");



//app.get('/create_key_page', newPage.create_key_page);
app.get('/create_key', newPage.create_key);
console.log("33");

app.get('*', function(req, res, next){
console.log("4");
    res.status(404);

    res.render('404.ejs', {
        title: "Page Not Found",
    });
});

// set the app to listen on the port
app.listen(port, () => {
    console.log(`Server running on port: ${port}`);
});
