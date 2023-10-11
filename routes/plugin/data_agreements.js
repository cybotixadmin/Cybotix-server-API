const sqlite3 = require('sqlite3').verbose();
const Ajv = require('ajv');


module.exports = function (app) {

    
// Initialize SQLite database
let all_data_agreements_db = new sqlite3.Database('./all_data_agreements.db', (err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Connected to the SQLite database.');
  });
  
// Create data_agreements table if it doesn't exist
const create_data_agreements_Table = `CREATE TABLE IF NOT EXISTS all_data_agreements (
    _id INTEGER PRIMARY KEY AUTOINCREMENT,
    userid TEXT, browser_id TEXT, createtime TEXT, lastmodifiedtime TEXT, uuid TEXT, expire_time TEXT, json BLOB );`;
  
    all_data_agreements_db.run(create_data_agreements_Table, [], (err) => {
  if (err) {
  console.error(err.message);
  }
  });

    // JSON Schema

      
    
    const plugin_user_add_data_agreement_json_schema = {
        type: "object",
        properties: {
          agreement_id: { type: 'string',
          "minLength": 0,
          "maxLength": 300 },
          userid: { type: 'string',
            "minLength": 0,
            "maxLength": 300 },
            browser_id: { type: 'string',
        "pattern": "^[A-Za-z0-9]{4,}$",
        "minLength": 4,
        "maxLength": 60  }
          },
          required: ['browser_id','userid'],
      };
      
      const plugin_user_validate_data_agreement_json_schema = {
        type: "object",
        properties: {
          agreement_id: { type: 'string',
          "minLength": 0,
          "maxLength": 300 },
          userid: { type: 'string',
            "minLength": 0,
            "maxLength": 300 },
            browser_id: { type: 'string',
        "pattern": "^[A-Za-z0-9]{4,}$",
        "minLength": 4,
        "maxLength": 60  }
          },
          required: ['browser_id','userid'],
      };
      
      
      const plugin_user_read_all_agreements_json_schema = {
        type: "object",
        properties: {
            userid: { type: 'string',
            "minLength": 0,
            "maxLength": 300 },
            browser_id: { type: 'string',
        "pattern": "^[A-Za-z0-9]{4,}$",
        "minLength": 4,
        "maxLength": 60  }
          },
          required: ['browser_id','userid'],
      };
      
      
        const plugin_user_delete_data_agreement_json_schema = {
          type: "object",
          properties: {
            uuid: { type: 'string',
            "minLength": 0,
            "maxLength": 300 },
              userid: { type: 'string',
              "minLength": 0,
              "maxLength": 300 },
              browser_id: { type: 'string',
          "pattern": "^[A-Za-z0-9]{4,}$",
          "minLength": 4,
          "maxLength": 60  }
            },
            required: ['browser_id','userid','uuid'],
        };
      
      
 
      
      const ajv = new Ajv();
      

      app.post('/plugin_user_add_data_agreement', (req, res) => {
        // Validate JSON against schema
       //const valid = ajv.validate(plugin_user_add_data_agreement_json_schema, req.body);
       const valid = true;
       if (!valid) {
         return res.status(400).json({ error: 'Invalid data format' });
       }
       
       // Insert into SQLite database
       console.log("adding agreement");
       console.log(JSON.stringify(req.body.agreement_json));
       
       // generate agreement id
       
         const uuid = crypto.randomUUID()
       
         var json = req.body.agreement_json;
         json.uuid = uuid;
         
       const sql = 'INSERT INTO all_data_agreements ( browser_id, uuid, createtime, lastmodifiedtime, json ) VALUES (?,?,?,?,?)';
       const utc = new Date().toISOString();
       const values = [req.body.browser_id ,uuid , req.body.agreement_json.createtime , utc  , JSON.stringify(json)];
       console.log(values);
       
       all_data_agreements_db.run(sql, values, function(err) {
         if (err) {
           console.log(err)
           return res.status(500).json({ error: 'Database error' });
         }
         res.status(201).json({ status: 0 });
       });
       });
    
      
    
    

app.post('/plugin_user_validate_data_agreement', (req, res) => {
    console.log(req.method);
    console.log(req.rawHeaders);
  // Validate JSON against schema
  const valid = ajv.validate(plugin_user_validate_data_agreement_json_schema, req.body);
  
  if (!valid) {
    return res.status(400).json({ error: 'Invalid data format' });
  }
  
  // delete from SQLite database
  const sql = 'SELECT status FROM data_agreements WHERE browser_id = ? ';
  
  //  const sql = "DELETE FROM messages WHERE browser_id='" +req.body.browser_id+ "' AND id=" +req.body.id+ "";
  
  const values = [req.body.browser_id ,req.body.id];
  console.log(sql);
  console.log(values);
  
  db.run(sql, values, function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.status(201).json({ status: 0 });
  });
  });
  
  
  
  
  app.post('/plugin_user_delete_data_agreement', (req, res) => {
    console.log(req.method);
    console.log(req.rawHeaders);
  // Validate JSON against schema
  const valid = ajv.validate(plugin_user_delete_data_agreement_json_schema, req.body);
  
  if (!valid) {
    return res.status(400).json({ error: 'Invalid data format' });
  }
  
  // delete from SQLite database
  const sql = 'DELETE FROM all_data_agreements WHERE browser_id=? AND uuid=? ';
  
  
  const values = [req.body.browser_id ,req.body.uuid];
  console.log(sql);
  console.log(values);
  
  all_data_agreements_db.run(sql, values, function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.status(201).json({ status: 0 });
  });
  });
  
  

app.post('/plugin_user_read_all_data_agreements', (req, res) => {
    //  console.log(req.method);
    //  console.log(req.rawHeaders);
    //  console.log(req.body);
      // Validate JSON against schema
     const valid = ajv.validate(plugin_user_read_all_agreements_json_schema, req.body);
    
     
      if (!valid) {
        return res.status(400).json({ error: 'Invalid data format' });
      }
    
      // Read from SQLite database
      const browser_id = [req.body.browser_id];
      const sql = 'SELECT * FROM all_data_agreements WHERE browser_id = ? ';
      all_data_agreements_db.all(sql, browser_id, (err, rows) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
     // console.log(rows);
      if (rows.length > 0)  {
          console.log(rows)
            res.status(200).json(rows);
          } else {
            res.status(404).json({ error: 'Message not found' });
          }
        });
    });
    
    
       
    }