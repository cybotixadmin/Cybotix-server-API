const Ajv = require('ajv');
const crypto = require('crypto');
var mysql = require('mysql'); 

module.exports = function (app, connection) {

    
  const regExpValidInstallationUniqueId = new RegExp(/^[a-zA-Z0-9_\.\-]{10,60}$/);

  
  
  
  
  // Create table if it doesn't exist
//  const createTable = `CREATE TABLE IF NOT EXISTS messages (
 //                       id INTEGER PRIMARY KEY AUTOINCREMENT,
 //                       userid TEXT, browser_id, localtime, utc ,url TEXT NOT NULL);`;
  
//  db.run(createTable, [], (err) => {
//    if (err) {
//      console.error(err.message);
//    }
//  });
  

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
    console.log('/plugin_user_delete_click');
   // console.log(req.rawHeaders);
  // Validate JSON against schema
  var installationUniqueId = "";
  try {

   
      if (regExpValidInstallationUniqueId.test(req.header("installationUniqueId"))) {
        installationUniqueId = req.header("installationUniqueId");
        console.log("a valid installationUniqueId found in header (" +installationUniqueId+")");
    } else {
          console.log("an invalid installationUniqueId found in header");

      }

  } catch (err) {
      console.log(err);

  }
  const valid = ajv.validate(plugin_user_delete_click_json_schema, req.body);

  if (!valid) {
    return res.status(400).json({ error: 'Invalid data format' });
  }

  // delete from database
  const sql = 'DELETE FROM CybotixDB.clickdata_tb WHERE browser_id="'+installationUniqueId+'" AND uuid="'+req.body.uuid+'"';

  const values = [req.body.browser_id ,req.body.id];
  console.log(sql);
  console.log(values);
  connection.query(sql, function (err, result) {
  
        if (err) {
          console.debug(err);
            return res.status(500).json({
                error: 'Database error'
            });
        }

        if (result.affectedRows > 0) {
            console.log("affectedRows: " + result.affectedRows)
            res.status(200).json('{"added:"'+result.affectedRows+"}");
        } else {
            res.status(404).json({});
        }
    });
});


app.post('/plugin_user_post_click', (req, res) => {
  console.debug("/plugin_user_post_click");
    //console.log(req.method);
   //console.log(req.rawHeaders);
   console.debug(req.body);
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
  const sql = 'INSERT INTO CybotixDB.clickdata_tb (url, browser_id,uuid, utc, local_time) VALUES ("'+req.body.url + '", "' + req.body.browser_id + '", "' + uuid + '", now(), now() )';
  
  console.log("SQL 1");
  console.log(sql);

  connection.query(sql, function (err, result) {
    //db.all(sql, values, (err, rows) => {
        if (err) {
          console.debug(err);
            return res.status(500).json({
                error: 'Database error'
            });
        }
//        console.log(result);
 //       console.log(result.affectedRows);
//console.log("1---"+JSON.parse(result));
//console.log("2---"+JSON.stringify(result));


        if (result.affectedRows > 0) {
            console.log("affectedRows: " + result.affectedRows)
            res.status(200).json('{"added:"'+result.affectedRows+"}");
        } else {
            res.status(404).json({});
        }
    });
});


app.post('/plugin_user_get_all_clicks', (req, res) => {
    console.log(req.method);
    console.log(req.rawHeaders);
    console.log(req.body);
    // Validate JSON against schema
    const valid = ajv.validate(plugin_user_get_all_clicks_json_schema, req.body);
    
    
 
    var installationUniqueId = "";
    try {
        if (regExpValidInstallationUniqueId.test(req.header("installationUniqueId"))) {
          installationUniqueId = req.header("installationUniqueId");
          console.log("a valid installationUniqueId found in header (" +installationUniqueId+")");
      } else {
            console.log("an invalid installationUniqueId found in header");
        }
    } catch (err) {
        console.log(err);
    }

    if (!valid) {
      return res.status(400).json({ error: 'Invalid data format' });
    }

    // Read from database
    //const browser_id = [req.body.browser_id];
    //console.log(browser_id);
//    const sql = 'SELECT * FROM messages WHERE browser_id = ? ORDER BY url';
    const sql = 'SELECT uuid,utc, local_time, url FROM CybotixDB.clickdata_tb WHERE browser_id = "'+installationUniqueId+'" ';
    console.log(sql);
    connection.query(sql, installationUniqueId, (err, rows) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
    console.log(rows);
    if (rows.length > 0)  {
        console.log(rows)
          res.status(200).json(rows);
        } else {
          res.status(404).json({ error: 'Message not found' });
        }
      });
  });


}