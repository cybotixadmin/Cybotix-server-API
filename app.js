const express = require('express');
const Ajv = require('ajv');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const mysql = require('mysql');

const { 
  v1: uuidv1,
  v4: uuidv4,
} = require('uuid');

const bunyan = require('bunyan');
var RotatingFileStream = require('bunyan-rotating-file-stream');
// Create a logger instance
const log = bunyan.createLogger({
  name: 'apiapp',                    // Name of the application
  streams: [
  {
    stream: new RotatingFileStream({
        type: 'rotating-file',
        path: 'logs/server-index-%Y%m%d.log',
        period: '1d',          // daily rotation 
        totalFiles: 10,        // keep up to 10 back copies 
        rotateExisting: true,  // Give ourselves a clean file when we start up, based on period 
        threshold: '10m',      // Rotate log files larger than 10 megabytes 
        totalSize: '20m',      // Don't keep more than 20mb of archived log files 
        gzip: true,             // Compress the archive log files to save space 
        template: 'server-%Y%m%d.log' //you can add. - _ before datestamp.
    })
}]
});


log.info('Cybotix API App');

const njwt = require("njwt");
const jsonwebtoken = require('jsonwebtoken');

const secureRandom = require("secure-random");
const formidable = require("formidable");


// Read the configuration file once and store the data in memory
const configFile = fs.readFileSync('./config.json');
const config = JSON.parse(configFile);


//const multer = require('multer');
//const storage = multer.memoryStorage();  // Store the file in memory
//const upload = multer({ storage: storage });

// Initialize express app
const app = express();
// Set the view engine to ejs
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

var cors = require('cors')
const crypto = require('crypto');
app.use(cors())
try{
app.use(express.json());
app.use(express.bodyParser());
}catch(e){
  log.error(e);
}


app.options('/products/:id', cors(), function (req, res, next) {
    log.info(req.method);
    log.info(req.rawHeaders);
 });

app.delete('/products/:id', cors(), function (req, res, next) {
    log.info(req.method);
    log.info(req.rawHeaders);
 
  res.json({msg: 'This is CORS-enabled for all origins!'})
});


var connection = mysql.createConnection({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
});


require('./routes/plugin/click_data')(app,connection);
require('./routes/plugin/data_agreements')(app,connection);
require('./routes/plugin/tokens')(app,connection);
require('./routes/data/click_history')(app,connection);


// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));


// Start the server
const PORT = process.env.PORT || config.port ;
app.listen(PORT, () => {
  log.info(`Server is running on port ${PORT}`);
});


function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
