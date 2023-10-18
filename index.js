const express = require('express');
const Ajv = require('ajv');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const { v4: uuidv4 } = require('uuid');

const njwt = require("njwt");
const jsonwebtoken = require('jsonwebtoken');

const secureRandom = require("secure-random");
const formidable = require("formidable");
//const multer = require('multer');
//const storage = multer.memoryStorage();  // Store the file in memory
//const upload = multer({ storage: storage });

// Initialize express app
const app = express();
var cors = require('cors')
const crypto = require('crypto');
app.use(cors())
try{
app.use(express.json());
app.use(express.bodyParser());
}catch(e){
  console.log(e);
}


app.options('/products/:id', cors(), function (req, res, next) {
    console.log(req.method);
    console.log(req.rawHeaders);
 });

app.delete('/products/:id', cors(), function (req, res, next) {
    console.log(req.method);
    console.log(req.rawHeaders);
 
  res.json({msg: 'This is CORS-enabled for all origins!'})
});

var connection = mysql.createConnection({
  host: "myrdsinstance.c4fxi8hjddcq.eu-west-1.rds.amazonaws.com",
  port: "3306",
  user: "sqluser",
  password: "password"
});


require('./routes/plugin/click_data')(app,connection);
require('./routes/plugin/data_agreements')(app,connection);
require('./routes/plugin/tokens')(app,connection);


// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));


// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
