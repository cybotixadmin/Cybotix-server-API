const Ajv = require('ajv');
const crypto = require('crypto');
var mysql = require('mysql'); 
const express = require('express');
const fs = require('fs');
const jwt = require('jsonwebtoken');

// Read the configuration file once and store the data in memory
const configFile = fs.readFileSync('./config.json');
const config = JSON.parse(configFile);

accepted_audiences = config.accepted_audiences;
accepted_issuers = config.accepted_issuers;

const defaultdb = config.database.database_name;




const bunyan = require('bunyan');
var RotatingFileStream = require('bunyan-rotating-file-stream');
// Create a logger instance
const log = bunyan.createLogger({
  name: 'apiapp',                    // Name of the application
  streams: [{
    stream: new RotatingFileStream({
        type: 'rotating-file',
        path: './logs/server-click_data-%Y%m%d.log',
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
module.exports = function (app, connection) {

    
  const regExpValidInstallationUniqueId = new RegExp(/^[a-zA-Z0-9_\.\-]{10,60}$/);

  
  

// JSON Schema
const plugin_user_post_click_json_schema = {
    type: 'object',
    properties: {
      content: { type: 'string',
      "minLength": 2,
      "maxLength": 30 },
      localtime: { type: 'string',
      "minLength": 2,
      "maxLength": 30 },
      url: { type: 'string',
      "minLength": 1,
      "maxLength": 1000 },
      browser_id: { type: 'string',
      "pattern": "^[A-Za-z0-9\-_\.]{4,100}$",
      "minLength": 4,
      "maxLength": 100 }
    },
    required: ['browser_id','url','localtime'],
  };

  



  

  
  const plugin_user_get_all_clicks_json_schema = {
      type: "object",
      properties: {
          userid: { type: 'string',
          "minLength": 0,
          "maxLength": 300 },
          browser_id: { type: 'string',
          "pattern": "^[A-Za-z0-9\-\_\.]{4,100}$",
      "minLength": 4,
      "maxLength": 60  }
        },
        required: ['browser_id','userid'],
    };
  
  

  
  const plugin_user_delete_click_json_schema = {
      type: "object",
      properties: {
          userid: { type: 'string',
          "minLength": 0,
          "maxLength": 300 },
          browser_id: { type: 'string',
      "pattern": "^[A-Za-z0-9\-\_\.]{4,100}$",
      "minLength": 4,
      "maxLength": 60  },
      uuid: { type: 'string',
      "pattern": "^[A-Za-z0-9\-\_\.]{10,100}$",
  "minLength": 1,
  "maxLength": 100  }
        },
        required: ['browser_id','userid','uuid'],
    };
  
  const ajv = new Ajv();
  

  




app.post('/plugin_user_delete_click', (req, res) => {
    log.info('/plugin_user_delete_click');
   // log.info(req.rawHeaders);
  // Validate JSON against schema
  var installationUniqueId = "";
  try {

   
      if (regExpValidInstallationUniqueId.test(req.header("installationUniqueId"))) {
        installationUniqueId = req.header("installationUniqueId");
        log.info("a valid installationUniqueId found in header (" +installationUniqueId+")");
    } else {
          log.info("an invalid installationUniqueId found in header");

      }

  } catch (err) {
      log.info(err);

  }
  const valid = ajv.validate(plugin_user_delete_click_json_schema, req.body);

  if (!valid) {
    return res.status(400).json({ error: 'Invalid data format' });
  }

  // delete from database
  const sql = 'DELETE FROM '+defaultdb+'.clickdata_tb WHERE browser_id="'+installationUniqueId+'" AND uuid="'+req.body.uuid+'"';

  const values = [req.body.browser_id ,req.body.id];
  log.info(sql);
  log.info(values);
  connection.query(sql, function (err, result) {
  
        if (err) {
          log.debug(err);
            return res.status(500).json({
                error: 'Database error'
            });
        }

        if (result.affectedRows > 0) {
            log.info("affectedRows: " + result.affectedRows)
            res.status(200).json('{"added:"'+result.affectedRows+"}");
        } else {
            res.status(404).json({});
        }
    });
});


app.post('/plugin_user_post_click', (req, res) => {
  log.debug("/plugin_user_post_click");
    //log.info(req.method);
   //log.info(req.rawHeaders);
   log.debug(req.body);
  // Validate JSON against schema
  const valid = ajv.validate(plugin_user_post_click_json_schema, req.body);

  if (!valid) {
    return res.status(400).json({ error: 'Invalid data format' });
  }

   // generate unique note id
   const uuid = crypto.randomUUID()

   //const sql = 'INSERT INTO messages (url, browser_id, utc, localtime) VALUES (?,?,?,?)';
  const utc = new Date().toISOString();
  const values = [req.body.url, req.body.browser_id ,utc, req.body.localtime];
  const sql = 'INSERT INTO '+defaultdb+'.clickdata_tb (url, browser_id,uuid, utc, local_time) VALUES ("'+req.body.url + '", "' + req.body.browser_id + '", "' + uuid + '", now(), now() )';
  
  log.info("SQL 1");
  log.info(sql);

  connection.query(sql, function (err, result) {
    //db.all(sql, values, (err, rows) => {
        if (err) {
          log.debug(err);
            return res.status(500).json({
                error: 'Database error'
            });
        }
//        log.info(result);
 //       log.info(result.affectedRows);
//log.info("1---"+JSON.parse(result));
//log.info("2---"+JSON.stringify(result));


        if (result.affectedRows > 0) {
            log.info("affectedRows: " + result.affectedRows)
            res.status(200).json('{"added:"'+result.affectedRows+"}");
        } else {
            res.status(404).json({});
        }
    });
});


app.post('/plugin_user_get_all_clicks', (req, res) => {
    log.info(req.method);
    log.info(req.rawHeaders);
    log.info(req.body);
    // Validate JSON against schema
    const valid = ajv.validate(plugin_user_get_all_clicks_json_schema, req.body);
    
    
 
    var installationUniqueId = "";
    try {
        if (regExpValidInstallationUniqueId.test(req.header("installationUniqueId"))) {
          installationUniqueId = req.header("installationUniqueId");
          log.info("a valid installationUniqueId found in header (" +installationUniqueId+")");
      } else {
            log.info("an invalid installationUniqueId found in header");
        }
    } catch (err) {
        log.info(err);
    }

    if (!valid) {
      return res.status(400).json({ error: 'Invalid data format' });
    }

    // Read from database
    //const browser_id = [req.body.browser_id];
    //log.info(browser_id);
//    const sql = 'SELECT * FROM messages WHERE browser_id = ? ORDER BY url';
    const sql = 'SELECT uuid,utc, local_time, url FROM '+defaultdb+'.clickdata_tb WHERE browser_id = "'+installationUniqueId+'" ';
    log.info(sql);
    console.log(sql)
    connection.query(sql, installationUniqueId, (err, rows) => {
        if (err) {
          console.log(err);
          return res.status(500).json({ error: 'Database error' });
        }
    log.info(rows);
    if (rows.length > 0)  {
        log.info(rows)
          res.status(200).json(rows);
        } else {
          res.status(404).json({ error: 'Message not found' });
        }
      });
  });


}



function isPlatformTokenRawStructureValid(token) {
console.debug("isPlatformTokenStructureValid");
const regExpValidPlatformToken = new RegExp(/^[a-zA-Z0-9_\.\-_=]{100,2000}$/);
if (regExpValidPlatformToken.test(token)) {
  return true
} else {
  return false;
}
}


function isDataAccessTokenRawStructureValid(platform_token_payload, token) {
  console.debug("isDataAccessTokenStructureValid");
  const regExpValidDataAccessToken = new RegExp(/^[a-zA-Z0-9_\.\-_=]{100,2000}$/);
  if (regExpValidDataAccessToken.test(token)) {
    return true
  } else {
    return false;
  }
    }
  