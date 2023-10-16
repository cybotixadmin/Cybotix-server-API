
const Ajv = require('ajv');
const crypto = require('crypto');

module.exports = function (app, connection) {

  

    // JSON Schema

      
    
    const plugin_user_add_data_agreement_json_schema = {
        type: "object",
        properties: {
          counterparty_id: { type: 'string',
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
          required: ['counterparty_id'],
      };
      
      const plugin_user_validate_data_agreement_json_schema = {
        type: "object",
        properties: {
          counterparty_id: { type: 'string',
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
          required: ['counterparty_id'],
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
      

      /**
       * {
 "createtime":"2023-08-28T20:49:41.725Z",
"lastmodifiedtime":"2023-08-29T20:49:41.725Z",
"principal_name" : "2342",
"principal_id":"2342",
"counterparty_name" :"Web Shop Inc.",
 "counterparty_id":"65232",
"data_grants" : [
{"one": "two"} ,
{"one":"two"}
]
}
       * 
       */

      app.post('/plugin_user_add_data_agreement', (req, res) => {
        // Validate JSON against schema
       const valid = ajv.validate(plugin_user_add_data_agreement_json_schema, req.body);
       //const valid = true;
       if (!valid) {
         return res.status(400).json({ error: 'Invalid data format' });
       }
       var installationUniqueId = "";
       try {
     
         const regExpObj = new RegExp(/^[a-zA-Z0-9_\.\-]{10,60}$/);
     
           if (regExpObj.test(req.header("installationUniqueId"))) {
             installationUniqueId = req.header("installationUniqueId");
             console.log("a valid installationUniqueId found in header (" +installationUniqueId+")");
         } else {
               console.log("an invalid installationUniqueId found in header");
     
           }
     
       } catch (err) {
           console.log(err);
     
       }
       console.log("adding agreement");
       console.log(JSON.stringify(req.body.agreement_json));
       
       // generate agreement id
       
         const uuid = crypto.randomUUID()
       
         var data_grants = req.body.data_grants;
         console.debug(data_grants)
         console.debug(JSON.stringify(data_grants))

         //json.uuid = uuid;
         
const json = '{"data_grants":'+JSON.stringify(data_grants) + '}';
console.debug(json);
//       const sql = 'INSERT INTO Cybotix.data_agreements_tb ( browser_id, uuid, createtime, lastmodifiedtime, json ) VALUES (?,?,?,?,?)';
       const utc = new Date().toISOString();
       //const values = [req.body.browser_id ,uuid , req.body.agreement_json.createtime , utc  , JSON.stringify(json)];
       //console.log(values);
  
       const sql = 'INSERT INTO CybotixDB.data_agreements_tb ( browserid, uuid, createtime, lastmodifiedtime, data_grants ) VALUES("'+installationUniqueId+'","'+uuid+'", now(), now(), '+ "'"+json+ "'"+')';
       

       console.log("SQL 2");
       console.log(sql);
     
       connection.query(sql, function (err, result) {
         //db.all(sql, values, (err, rows) => {
             if (err) {
               console.debug(err);
                 return res.status(500).json({
                     error: 'Database error'
                 });
             }
             console.log(result);
             console.log(result.affectedRows);
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
  
   // delete from database
   const sql = 'DELETE FROM CybotixDB.data_agreements WHERE browser_id="'+installationUniqueId+'" AND uuid="'+req.body.uuid+'"';

  
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