const sqlite3 = require('sqlite3').verbose();
const Ajv = require('ajv');
const fs = require('fs');
const jsonwebtoken = require('jsonwebtoken');
const jsonwebtoken2 = require('jsonwebtoken');
const crypto = require('crypto');


const bunyan = require('bunyan');
var RotatingFileStream = require('bunyan-rotating-file-stream');
// Create a logger instance
const log = bunyan.createLogger({
  name: 'apiapp',                    // Name of the application
  streams: [{
    stream: new RotatingFileStream({
        type: 'rotating-file',
        path: 'logs/server-tokens-%Y%m%d.log',
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

module.exports = function (app,connection) {

 /**
  * package of functions to generate and validate tokens for the Cybotix platform
  */   

 
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
      "maxLength": 300 },
      browser_id: { type: 'string',
      "pattern": "^[A-Za-z0-9]{4,}$",
      "minLength": 4,
      "maxLength": 60 }
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
      "pattern": "^[A-Za-z0-9]{4,}$",
      "minLength": 4,
      "maxLength": 60  }
        },
        required: ['browser_id','userid'],
    };
  
  

  
  const data_access_request_json_schema = {
    type: "object",
    properties: {
      clickhistory: {
        type: "object",
        properties: {
          filter: {
            type: "string",
            pattern: ".*"
          }
        },
        required: []
      },
      validity:{ type: 'string',
      "minLength": 0,
      "maxLength": 30 }
    },
    required: ['clickhistory']
  };
  
  const ajv = new Ajv();
  

  app.use((req, res, next) => {
    log.info(`Received a request on path: ${req.path}`);
    next(); // Continue to the next middleware/route handler
});


/* check if a token has been revoked

Returns {"status":"not_revoked"} for valid token and 
{"status":"revoked"} for a revoked token
If no information found, return "not_revoked"

*/
  app.get('/plugin_user_query_accesstoken_status', (req, res) => {
    log.info(req.method);
    log.info(req.path);
    // check the token against the database
    log.info(req.query);
    log.info(req.query.uuid);


var installationUniqueId = "";
try {
    if (regExpValidInstallationUniqueId.test(req.header("installationUniqueId"))) {
      installationUniqueId = req.header("installationUniqueId");
      log.info("a valid installationUniqueId found in header (" +installationUniqueId+")");
 


const regExpValidTokenUUID = new RegExp(/^[a-zA-Z0-9_\.\-]{10,60}$/);
//const uuid = req.query.uuid;
var uuid = "";
try {
    if (regExpValidTokenUUID.test(req.query.uuid)) {
      uuid = req.query.uuid;
      log.info("a valid uuid found in querystring (" +uuid+")");
 


const sql = 'SELECT activestatus FROM CybotixDB.data_accesstokens_tb WHERE uuid="'+uuid+'"';
       

log.info("SQL 2");
log.info(sql);
connection.query(sql, installationUniqueId ,(err, rows) => {
  if (err) {
    return res.status(500).json({ error: 'Database error' });
  }
log.info(rows);
if (rows.length > 0)  {
  
  if (rows[0].activestatus == "1"){
log.info("active");
res.status(200).json({ activestatus: 'not_revoked' });
  }else{
log.info("not active");
res.status(200).json({ activestatus: 'revoked' });
  }
  } else {
    log.info("not found");
    res.status(200).json({ activestatus: 'not_revoked' });
  }

});
} else {
  log.info("an invalid uuid found in querystring");
}
} catch (err) {
log.info(err);
}
} else {
  log.info("an invalid installationUniqueId found in header");
}
} catch (err) {
log.info(err);
}

  });


 
/**
 * This API is called from the plugin after the user has aither approved a request, or a request has been approved by the user in the past.
 * 
 * The access token is a JWT signed by the Cybotix platform. It contains the data access agreement between the user and the plugin.
 * 
 * The payload is the data access agreement. it is linked to the platform token by the "jti" field.
 * It is signed by Cybotix with the Cybotix private key.
 * 
 * 
 */

app.get('/plugin_user_create_access_token', (req, res) => {
  log.info('/plugin_user_create_access_token');

  var installationUniqueId = "";
  try {

      if (regExpValidInstallationUniqueId.test(req.header("installationUniqueId"))) {
          installationUniqueId = req.header("installationUniqueId");
          log.info("a valid installationUniqueId found in header (" + installationUniqueId + ")");

          //create the access token based on the request approved by the user (per past agreement)
          log.info(req.body);


          const rawPlatformToken = req.get('X_HTTP_CYBOTIX_PLATFORM_TOKEN');
log.info("rawPlatformToken");

const parts = rawPlatformToken.replace(/-/g, '+').replace(/_/g, '/').split('.');
if (parts.length !== 3) {
    //throw new Error('Invalid token format');
    log.info('Invalid token format');
}
log.info("parts: " + parts[1 ]);
const payload_raw = parts[1 ];
const payload = Buffer.from(payload_raw, 'base64').toString('utf8');
log.info(payload);




          const rawDataRequest = req.get('X_HTTP_CYBOTIX_DATA_REQUEST');



      } else {
          log.info("an invalid installationUniqueId found in header");
      }
  } catch (err) {
      log.info(err);
  }


});




app.get('/fordevelopmentonly_generate_a_platform_token', (req, res) => {
    log.info(req.method);
    log.info(req.rawHeaders);
  // Validate JSON against schema
  const njwt = require("njwt");
const secureRandom = require("secure-random");

// This is a "secret key" that the creator of the JWT must keep private.
var key = secureRandom(256, { type: "Buffer" });

log.info(key);
// create expire timestamp
// Get the current date and time
const currentDate = new Date();

// Add 4 weeks (4 weeks * 7 days/week * 24 hours/day * 60 minutes/hour * 60 seconds/minute * 1000 milliseconds/second)
const futureDate = new Date(currentDate.getTime() + 4 * 7 * 24 * 60 * 60 * 1000);
log.info("futuredate: " + futureDate);
// Convert to ISO string
const futureDateISOString = futureDate.toISOString();

// This is the JSON data embedded in the token.
var claims = {
  iss: "https://api.com",
  sub: "anonymous",
  scope: "freeUser",
  favoriteColor: "black",
  expiration: futureDateISOString
};

// Create a JWT
var jwt = njwt.create(claims, key);

// Log the JWT
log.info("jwt:");
const jwt_json_text=JSON.stringify(jwt).replace(/}/g, "\n").replace(/","/g, '",\n"');
log.info(jwt);
// Jwt {
//  header: JwtHeader { typ: 'JWT', alg: 'HS256' },
//  body:
//   JwtBody {
//     iss: 'https://api.com',
//     sub: 'someuserid',
//     scope: 'freeUser',
//     favoriteColor: 'black',
//     jti: '903c5447-ebfd-43e8-8f4d-b7cc5922f5ec',
//     iat: 1528824349,
//     exp: 1528827949 },
//  signingKey: <Buffer 9c e9 48 a7 b3 c9 87 be 5f 59 90 a5 08 02 9b 98 5c 5e 1c 29 3f b0 33 c5 8c c8 f9 c8 3e 35 f0 7c 20 a0 aa 65 cc 98 47 b6 31 c5 5c d6 4e 6e 25 29 2b d3 ... > }

// The JWT in compacted form (ready for sending over the network)
var token =  jwt.compact();

// Log the compacted JWT
log.info(jwt.compact());
// eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb20iLCJzdWIiOiJzb21ldXNlcmlkIiwic2NvcGUiOiJmcmVlVXNlciIsImZhdm9yaXRlQ29sb3IiOiJibGFjayIsImp0aSI6IjkwM2M1NDQ3LWViZmQtNDNlOC04ZjRkLWI3Y2M1OTIyZjVlYyIsImlhdCI6MTUyODgyNDM0OSwiZXhwIjoxNTI4ODI3OTQ5fQ.y7ad-nUsHAkI8a5bixYnr_v0vStRqnzsT4bbWGAM2vw

// Verify the JWT using the secret key
njwt.verify(token, key, (err, verifiedJwt) => {
  if (err) throw err;
  log.info("The JWT has been verified and can be trusted!");
  // The JWT has been verified and can be trusted!
});


const token_page='<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>download token</title></head><body>platform token  <div id="json">     <pre>'+jwt_json_text+'</pre> </div><div id="mydiv">     <b>'+jwt.compact()+'</b> </div>  </body></html>';


    res.status(200)
  res.send(token_page);



});


app.post('/plugin_user_create_access_token', (req, res) => {
  log.info('/plugin_user_create_access_token');
  log.info(req.method);
  log.info(req.rawHeaders);
  log.info("\n\nreq.body");
  console.log(req.body.publicKey);

  const JWT_SECRET = 'your_secret_key'; // Change this to a secure key
try{
  function isValidNameInput(input) {
    const name_regex = /^[A-Za-z0-9,.\- ]{1,20}$/;

    return name_regex.test(input);
}

function isValidPEMInput(input) {
  
  const pem_regex = /^[A-Za-z0-9\/\r\n\- \+]{100,4000}$/;
  return pem_regex.test(input);
}

const name_regex = /^[A-Za-z0-9,.\- ]{1,20}$/;
const pem_regex = /^[A-Za-z0-9\/\r\n\- \+]{100,4000}$/;

console.log(name_regex.test(req.body.name));
console.log(pem_regex.test(req.body.publicKey));
log.info(isValidNameInput(req.body.name));
log.info(isValidPEMInput(req.body.publicKey));

if (isValidNameInput(req.body.name) && isValidPEMInput(req.body.publicKey)){


  const subject = req.body.name;

    const publicKey = req.body.publicKey;

    if (!subject || !publicKey) {
        return res.status(400).send("Missing name or public key.");
    }

    const payload = {
        ver: "1.0", // Version of the token
        sub: subject,
        x5c: [publicKey], // x5c expects an array of certificate strings. Here we provide only the public key.
        iat: Math.floor(Date.now() / 1000), // Current timestamp
        exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days from now
    };
    const cybotixkey = fs.readFileSync('./keys/cybotix_private_key.pem');
    log.info("cybotixkey");
    log.info(cybotixkey);
    log.debug(payload);
   

      // This is the JSON data embedded in the token. It includes the public key of the client
var payload1 = {
  iss: "https://api.com",
  sub: subject,
  scope: "freeUser",
  favoriteColor: "black",
  key: publicKey, 
  version: "1.0"
 
};

const token = jsonwebtoken2.sign(payload, cybotixkey, { algorithm: 'ES256' ,
header: {
  kid: "1.0.0",
  sub: subject
}});
log.info("data_access_grant_token");
log.info(token);

    
console.log(token);

// Splitting the JWT to get the header, payload, and signature
const [header, load, signature] = token.split('.');

// Base64-decoding the header and payload for display
const decodedHeader = Buffer.from(header, 'base64').toString();
const decodedPayload = Buffer.from(load, 'base64').toString();
console.log("render");
res.render('display_platformtoken', {
    token: token,
    decodedHeader: decodedHeader,
    decodedPayload: decodedPayload,
    signature: signature
});

//var page = '';

   // res.send(`Generated JWT: ${token}`);
  }else{
    return res.status(400).send("Missing name or public key.");
  }
}catch(err){
  console.log(err);
}
  
})

app.post('/fordevelopmentonly_generate_platform_token_from_key', (req, res) => {
    log.info(req.method);
    //log.info(req.rawHeaders);
    log.info("\n\nreq.body");
    log.info(req.body);
  
    log.info(req.body);

    const subject = req.body.sub;
const clientprivkey = req.body.privatekey_pem;
log.info("privkey: " + clientprivkey);

const clientpubkey = req.body.publickey_pem;
log.info("pubkey: " + clientpubkey);


  // Validate JSON against schema
  const njwt = require("njwt");
const secureRandom = require("secure-random");


// create expire timestamp
// Get the current date and time
const currentDate = new Date();

// Add 4 weeks (4 weeks * 7 days/week * 24 hours/day * 60 minutes/hour * 60 seconds/minute * 1000 milliseconds/second)
const futureDate = new Date(currentDate.getTime() + 4 * 7 * 24 * 60 * 60 * 1000);
log.info("futuredate: " + futureDate);
// Convert to ISO string
const futureDateISOString = futureDate.toISOString();

// This is the JSON data embedded in the token. It includes the public key of the client
var payload1 = {
    iss: "https://api.com",
    sub: subject,
    scope: "freeUser",
    favoriteColor: "black",
    key: clientpubkey, 
    version: "1.0"
   
  };
  
  // To do
 // valify that the publick and the pribate key are  matching.


 // sign the payload (which included the public key provided by the client) with the private key provided by the client
 const token2 = jsonwebtoken.sign(payload1, clientprivkey, { algorithm: 'RS256' ,
 header: {
   kid: "self",
 }});
 log.info("token2");
 log.info(token2);

 // at the user customer has signed the "payload1" portion, creating JWS. 
 // Cybotix signes the whole resulting token with it's own private key. The result is the platform token. 
 // the signature-on-signature enures that the token can be trusted by the remote clients (plugins).

 const cybotixkey = fs.readFileSync('./keys/cybotix_private_key.pem');
    log.info("cybotixkey");
    log.info(cybotixkey);
    var payload = {
        platform_client: token2,
        expiration: futureDateISOString
      };

 
      const data_access_grant_token = jsonwebtoken2.sign(payload, cybotixkey, { algorithm: 'ES256' ,
      header: {
        kid: "1.0.0",
        sub: subject
      }});
      log.info("data_access_grant_token");
      log.info(data_access_grant_token);



// verify

 // Read the public key from the Cybotix key file
 
 const cybotixPublicKey = fs.readFileSync('./keys/cybotix_public_key.pem');
 // Verify the token
 const jwt = require('jsonwebtoken');
 const decoded = jwt.verify(data_access_grant_token, cybotixPublicKey, { algorithms: ['ES256'] });
log.info("decoded");
log.info( decoded);


      const jws_json_text2 ="";

// validate the inner part that comes from the client/customer
//const platform_client = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb20iLCJzdWIiOiJhbm9ueW1vdXMiLCJzY29wZSI6ImZyZWVVc2VyIiwiZmF2b3JpdGVDb2xvciI6ImJsYWNrIiwiaWF0IjoxNjkzNzU1NDA3fQ.TKx_UhKDqc8pf50zAjj44rk0GD7h1078m8HMCylxTxEJOoQXQTrMOB2AlG0UDGJK5OR9dKARarehinXEl1b8Y1ZTNXe0bukEauitotZ6Zgh6e2HXydIl14BVJBKXF90krxw_3SsFp7lRE3utNlfC7QdEMOQLaqs17MUUNeiJTKeVC_-qWQE45in2xl35dePRYLvYVVNXFX-P6172IMTQ6dhuNM-Ni2eQvpkIXZRx2BCmKA3fsLsizw8KevAmbjMS7B28T7VwkfR6o_KeII8D0x3KJXn8zuUggNjIeQHosTGVlcAYchEH_xyGFMG5RpmcB2RfdRyq1n-_87O9DWanQQ';
const platform_client = decoded.platform_client;

 // Decode the header without verification
 const jwt4 = require('jsonwebtoken');
 const decodedHeader = jwt4.decode(platform_client, { complete: true }).header;
log.info(decodedHeader);
log.info("decoded");
const decoded_for_verification=jwt4.decode(platform_client, { complete: true });
log.info(decoded_for_verification);

const verify_with_key = decoded_for_verification.payload.key;

log.info("verify_with_key");
log.info(verify_with_key);

const decoded2 = jwt.verify(platform_client, verify_with_key, { algorithms: ['RS256'] });
log.info("decoded2");
log.info( decoded2);
// by verifying the first signature with th public key provided, it is proven that the private key used for the signature is the same as the public key provided.



const token_page='<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>download token</title></head><body>platform token (JWS) <div id="json">     <pre>'+decoded+'</pre> </div><div id="mydiv">     <b>'+data_access_grant_token+'</b> </div>  </body></html>';


    res.status(200)
  res.send(token_page);



});




app.post('/fordevelopmentonly_generate_data_access_request_token_from_json_and_key', (req, res) => {
    //log.info(req.method);
    //log.info(req.rawHeaders);
   // log.info("\n\nreq.body");
    //log.info(req.body);
  
    //log.info(req.body);

//const platform_token = req.body.platform_token;
const platform_token = req.get('X_HTTP_CYBOTIX_PLATFORM_TOKEN');

log.info("platform_token: " + platform_token);



log.info("+\n");
log.info("data_access_request_payload: " + req.body.data_access_request_payload);

const data_request_json = decodeBase64(req.body.data_access_request_payload);

log.info("data_request_json: " + data_request_json);
// schema validate the request

// Validate JSON against schema
const valid = ajv.validate(data_access_request_json_schema, data_request_json);

log.info(valid);

if (!valid) {
  log.info("invalid data format");
  // return res.status(400).json({ error: 'Invalid data format' });
}
const data_request = JSON.parse(data_request_json);
log.info("data_request: " + data_request);
log.info( data_request);



const clientprivkey = req.body.privatekey_pem;
log.info("privkey: " + clientprivkey);



  // Validate the JSON of the data platform token against schema
  // before checking the signature, check the schema of the token
  

//Apply json schema to control the syntax in the data request


 


// get publickey from platform token


 // Read the public key from the Cybotix key file
 
 const clientpubkey = getKeyFromPlatformtoken(platform_token);
 
 log.info("clientpubkey");
 log.info(clientpubkey);


// create expire timestamp for data request token
// Get the current date and time
const currentDate = new Date();

// default (in milliseconds) duration of the data request token - set to 7 days
const default_duration =  7 * 24 * 60 * 60 * 1000;

// get proposed duration from the request submitted by client
try{
log.info(data_request);
//log.info(JSON.parse(data_request_json).one);
log.info(data_request.validity);
log.info(data_request.validity.notafter);
}catch(err){
  log.info(err);
}


log.info("time remaining on platform token");
log.info(currentDate);

const requested_expiration_date = data_request.validity.notafter;
log.info("requested_expiration_date: " + requested_expiration_date);

const date1 = new Date(data_request.validity.notafter);
const date2 = new Date(getPlatformtokenNotAfter(platform_token));
log.info("date1 : " + date1.getTime());
log.info("date2 : " + date2.getTime());

// set the expiration to what was requested
var expiration_date = date1;
// But if the platformtoken expires earlier than that, 
// use the shorter of the request time and the platform expiration time
if (date1.getTime() > date2.getTime()){
  log.info("reducing the expiration date to the platform token expiration date");
    expiration_date = date2;
}

log.info("expiration_date: " + expiration_date);




// Add 4 weeks (4 weeks * 7 days/week * 24 hours/day * 60 minutes/hour * 60 seconds/minute * 1000 milliseconds/second)
//const futureDate = new Date(currentDate.getTime() + 4 * 7 * 24 * 60 * 60 * 1000);
//log.info("futuredate: " + futureDate);
// Convert to ISO string
const futureDateISOString = expiration_date.toISOString();

// apply any applicable reduction to the scope in the data request


// create the payload based the data request token with any applicable reductions and restrictions. 

// set expiration data as the lesser of the requested expiration data, the expiration date of the platform token.


// This is the JSON data embedded in the token. It includes the public key of the client
var payload1 = {
    iss: "https://api.com",
    sub: "anonymous",
    scope: "freeUser",
    favoriteColor: "black",
    key: clientpubkey
   
  };
  
  // To do
 // valify that the publick and the pribate key are  matching.


 // sign the payload (which included the public key provided by the client) with the private key provided by the client
 const token2 = jsonwebtoken.sign(payload1, clientprivkey, { algorithm: 'RS256' ,
 header: {
   kid: "self",
 }});
 log.info("token2");
 log.info(token2);

// URL/location where this data access grant token may be used
 var audience = ["https://api.cybotix.no/data","https://api.cybotix.no/development/data"];



 // at the user customer has signed the "payload1" portion, creating JWS. 
 // Cybotix signes the whole resulting token with it's own private key. The result is the platform token. 
 // the signature-on-signature enures that the token can be trusted by the remote clients (plugins).

 const cybotixkey = fs.readFileSync('./keys/cybotix_private_key.pem');
    log.info("cybotixkey");
    log.info(cybotixkey);
    var data_access_grant_payload = {
        version: "1.0",
        platform_client: token2,
        aud: audience,
        conditions:{
        notafter: futureDateISOString}
      };
 
      const data_access_grant_token = jsonwebtoken2.sign(data_access_grant_payload, cybotixkey, { algorithm: 'ES256' ,
      header: {
        kid: "1.0.0",
      }});
      log.info("data_access_grant_token");
      log.info(data_access_grant_token);



// verify the token just created

 // Read the public key from the Cybotix key file
 
 const cybotixPublicKey = fs.readFileSync('./keys/cybotix_public_key.pem');
 // Verify the token
 const jwt = require('jsonwebtoken');
 const decoded = jwt.verify(data_access_grant_token, cybotixPublicKey, { algorithms: ['ES256'] });
log.info("decoded");
log.info( decoded);


      const jws_json_text2 ="";

// validate the inner part that comes from the client/customer
//const platform_client = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb20iLCJzdWIiOiJhbm9ueW1vdXMiLCJzY29wZSI6ImZyZWVVc2VyIiwiZmF2b3JpdGVDb2xvciI6ImJsYWNrIiwiaWF0IjoxNjkzNzU1NDA3fQ.TKx_UhKDqc8pf50zAjj44rk0GD7h1078m8HMCylxTxEJOoQXQTrMOB2AlG0UDGJK5OR9dKARarehinXEl1b8Y1ZTNXe0bukEauitotZ6Zgh6e2HXydIl14BVJBKXF90krxw_3SsFp7lRE3utNlfC7QdEMOQLaqs17MUUNeiJTKeVC_-qWQE45in2xl35dePRYLvYVVNXFX-P6172IMTQ6dhuNM-Ni2eQvpkIXZRx2BCmKA3fsLsizw8KevAmbjMS7B28T7VwkfR6o_KeII8D0x3KJXn8zuUggNjIeQHosTGVlcAYchEH_xyGFMG5RpmcB2RfdRyq1n-_87O9DWanQQ';
const platform_client = decoded.platform_client;

 // Decode the header without verification
 const jwt4 = require('jsonwebtoken');
 const decodedHeader = jwt4.decode(platform_client, { complete: true }).header;
log.info(decodedHeader);
log.info("decoded");
const decoded_for_verification=jwt4.decode(platform_client, { complete: true });
log.info(decoded_for_verification);

const verify_with_key = decoded_for_verification.payload.key;

log.info("verify_with_key");
log.info(verify_with_key);

const decoded2 = jwt.verify(platform_client, verify_with_key, { algorithms: ['RS256'] });
log.info("decoded2");
log.info( decoded2);
// by verifying the first signature with th public key provided, it is proven that the private key used for the signature is the same as the public key provided.



const token_page='<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>download token</title></head><body>platform token (JWS) <div id="json">     <pre>'+decoded+'</pre> </div><div id="mydiv">     <b>'+data_access_grant_token+'</b> </div>  </body></html>';


    res.status(200)
    res.send(token_page);



});





app.post('/fordevelopmentonly_generate_data_agreement_grant_token_from_json_and_key', (req, res) => {
  //log.info(req.method);
  //log.info(req.rawHeaders);
 // log.info("\n\nreq.body");
  //log.info(req.body);

  //log.info(req.body);

//const platform_token = req.body.platform_token;
const platform_token = req.get('X_HTTP_CYBOTIX_PLATFORM_TOKEN');

log.info("platform_token: " + platform_token);




log.info("+\n");
log.info("data_agreement_request_payload: " + req.body.data_access_request_payload);

const data_request_json = decodeBase64(req.body.data_access_request_payload);

log.info("data_request_json: " + data_request_json);
// schema validate the request

// Validate JSON against schema
const valid = ajv.validate(data_access_request_json_schema, data_request_json);

log.info(valid);

if (!valid) {
log.info("invalid data format");
// return res.status(400).json({ error: 'Invalid data format' });
}
const data_request = JSON.parse(data_request_json);
log.info("data_request: " + data_request);
log.info( data_request);



const clientprivkey = req.body.privatekey_pem;
log.info("privkey: " + clientprivkey);



// Validate the JSON of the data platform token against schema
// before checking the signature, check the schema of the token


//Apply json schema to control the syntax in the data request





// get publickey from platform token


// Read the public key from the Cybotix key file

const clientpubkey = getKeyFromPlatformtoken(platform_token);

log.info("clientpubkey");
log.info(clientpubkey);


// create expire timestamp for data request token
// Get the current date and time
const currentDate = new Date();

// default (in milliseconds) duration of the data request token - set to 7 days
const default_duration =  7 * 24 * 60 * 60 * 1000;

// get proposed duration from the request submitted by client
try{
log.info(data_request);
//log.info(JSON.parse(data_request_json).one);
log.info(data_request.validity);
log.info(data_request.validity.notafter);
}catch(err){
log.info(err);
}


log.info("time remaining on platform token");
log.info(currentDate);

const requested_expiration_date = data_request.validity.notafter;
log.info("requested_expiration_date: " + requested_expiration_date);

const date1 = new Date(data_request.validity.notafter);
const date2 = new Date(getPlatformtokenNotAfter(platform_token));
log.info("date1 : " + date1.getTime());
log.info("date2 : " + date2.getTime());

// set the expiration to what was requested
var expiration_date = date1;
// But if the platformtoken expires earlier than that, 
// use the shorter of the request time and the platform expiration time
if (date1.getTime() > date2.getTime()){
log.info("reducing the expiration date to the platform token expiration date");
  expiration_date = date2;
}

log.info("expiration_date: " + expiration_date);




// Add 4 weeks (4 weeks * 7 days/week * 24 hours/day * 60 minutes/hour * 60 seconds/minute * 1000 milliseconds/second)
//const futureDate = new Date(currentDate.getTime() + 4 * 7 * 24 * 60 * 60 * 1000);
//log.info("futuredate: " + futureDate);
// Convert to ISO string
const futureDateISOString = expiration_date.toISOString();

// apply any applicable reduction to the scope in the data request


// create the payload based the data request token with any applicable reductions and restrictions. 

// set expiration data as the lesser of the requested expiration data, the expiration date of the platform token.


// This is the JSON data embedded in the token. It includes the public key of the client
var payload1 = {
  iss: "https://api.com",
  sub: "anonymous",
  scope: "freeUser",
  favoriteColor: "black",
  key: clientpubkey
 
};

// To do
// valify that the publick and the pribate key are  matching.


// sign the payload (which included the public key provided by the client) with the private key provided by the client
const token2 = jsonwebtoken.sign(payload1, clientprivkey, { algorithm: 'RS256' ,
header: {
 kid: "self",
}});
log.info("token2");
log.info(token2);

// URL/location where this data agreement grant token may be used
var audience = ["https://api.cybotix.no/data","https://api.cybotix.no/development/data"];



// at the user customer has signed the "payload1" portion, creating JWS. 
// Cybotix signes the whole resulting token with it's own private key. The result is the platform token. 
// the signature-on-signature enures that the token can be trusted by the remote clients (plugins).

const cybotixkey = fs.readFileSync('./keys/cybotix_private_key.pem');
  log.info("cybotixkey");
  log.info(cybotixkey);
  var data_access_grant_payload = {
      version: "1.0",
      platform_client: token2,
      aud: audience,
      conditions:{
      notafter: futureDateISOString}
    };

    const data_access_grant_token = jsonwebtoken2.sign(data_access_grant_payload, cybotixkey, { algorithm: 'ES256' ,
    header: {
      kid: "1.0.0",
    }});
    log.info("data_access_grant_token");
    log.info(data_access_grant_token);



// verify the token just created

// Read the public key from the Cybotix key file

const cybotixPublicKey = fs.readFileSync('./keys/cybotix_public_key.pem');
// Verify the token
const jwt = require('jsonwebtoken');
const decoded = jwt.verify(data_access_grant_token, cybotixPublicKey, { algorithms: ['ES256'] });
log.info("decoded");
log.info( decoded);


    const jws_json_text2 ="";

// validate the inner part that comes from the client/customer
//const platform_client = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb20iLCJzdWIiOiJhbm9ueW1vdXMiLCJzY29wZSI6ImZyZWVVc2VyIiwiZmF2b3JpdGVDb2xvciI6ImJsYWNrIiwiaWF0IjoxNjkzNzU1NDA3fQ.TKx_UhKDqc8pf50zAjj44rk0GD7h1078m8HMCylxTxEJOoQXQTrMOB2AlG0UDGJK5OR9dKARarehinXEl1b8Y1ZTNXe0bukEauitotZ6Zgh6e2HXydIl14BVJBKXF90krxw_3SsFp7lRE3utNlfC7QdEMOQLaqs17MUUNeiJTKeVC_-qWQE45in2xl35dePRYLvYVVNXFX-P6172IMTQ6dhuNM-Ni2eQvpkIXZRx2BCmKA3fsLsizw8KevAmbjMS7B28T7VwkfR6o_KeII8D0x3KJXn8zuUggNjIeQHosTGVlcAYchEH_xyGFMG5RpmcB2RfdRyq1n-_87O9DWanQQ';
const platform_client = decoded.platform_client;

// Decode the header without verification
const jwt4 = require('jsonwebtoken');
const decodedHeader = jwt4.decode(platform_client, { complete: true }).header;
log.info(decodedHeader);
log.info("decoded");
const decoded_for_verification=jwt4.decode(platform_client, { complete: true });
log.info(decoded_for_verification);

const verify_with_key = decoded_for_verification.payload.key;

log.info("verify_with_key");
log.info(verify_with_key);

const decoded2 = jwt.verify(platform_client, verify_with_key, { algorithms: ['RS256'] });
log.info("decoded2");
log.info( decoded2);
// by verifying the first signature with th public key provided, it is proven that the private key used for the signature is the same as the public key provided.



const token_page='<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>download token</title></head><body>platform token (JWS) <div id="json">     <pre>'+decoded+'</pre> </div><div id="mydiv">     <b>'+data_access_grant_token+'</b> </div>  </body></html>';


  res.status(200)
  res.send(token_page);



});



}



function inserttokenuuid(uuid){

  const sql = 'INSERT INTO CybotixDB.data_accesstoken_tb (createtime, uuid,1) VALUES (now(),"'+uuid + '", 1 )';
  
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

}


function decodeBase64(base64String) {
  try {
      const decodedString = Buffer.from(base64String, 'base64').toString('utf-8');
      return decodedString;
  } catch (error) {
      console.error('Error decoding Base64:', error);
      return null;
  }
}

function getKeyFromPlatformtoken(platform_token) {
    const cybotixPublicKey3 = fs.readFileSync('./keys/cybotix_public_key.pem');
    // Verify the token
    const jwt3 = require('jsonwebtoken');
    const decoded3 = jwt3.verify(platform_token, cybotixPublicKey3, { algorithms: ['ES256'] });
    log.info("decoded3");
    log.info(decoded3);


    // validate the inner part that comes from the client/customer
    //const platform_client = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb20iLCJzdWIiOiJhbm9ueW1vdXMiLCJzY29wZSI6ImZyZWVVc2VyIiwiZmF2b3JpdGVDb2xvciI6ImJsYWNrIiwiaWF0IjoxNjkzNzU1NDA3fQ.TKx_UhKDqc8pf50zAjj44rk0GD7h1078m8HMCylxTxEJOoQXQTrMOB2AlG0UDGJK5OR9dKARarehinXEl1b8Y1ZTNXe0bukEauitotZ6Zgh6e2HXydIl14BVJBKXF90krxw_3SsFp7lRE3utNlfC7QdEMOQLaqs17MUUNeiJTKeVC_-qWQE45in2xl35dePRYLvYVVNXFX-P6172IMTQ6dhuNM-Ni2eQvpkIXZRx2BCmKA3fsLsizw8KevAmbjMS7B28T7VwkfR6o_KeII8D0x3KJXn8zuUggNjIeQHosTGVlcAYchEH_xyGFMG5RpmcB2RfdRyq1n-_87O9DWanQQ';
    //const platform_client = decoded3.platform_client;
    // Decode the header without verification
    const jwt5 = require('jsonwebtoken');
    const decodedHeader3 = jwt5.decode(decoded3.platform_client, { complete: true }).header;
    log.info(decodedHeader3);
    log.info("decoded");
    const decoded_for_verification4 = jwt5.decode(decoded3.platform_client, { complete: true });
    log.info(decoded_for_verification4);

    const verify_with_key4 = decoded_for_verification4.payload.key;

    log.info("verify_with_key4");
    log.info(verify_with_key4);

    const decoded5 = jwt5.verify(decoded3.platform_client, verify_with_key4, { algorithms: ['RS256'] });
    log.info("decoded5");
    log.info(decoded5);
    // by verifying the first signature with th public key provided, it is proven that the private key used for the signature is the same as the public key provided.
    const clientpubkey = decoded5.key;
    return clientpubkey;
}




function getPlatformtokenNotAfter(platform_token) {
log.info("getPlatformtokenNotAfter");
const jwt = require('jsonwebtoken');
const decoded_for_extract = jwt.decode(platform_token, { complete: true });
return decoded_for_extract.payload.expiration;

log.info(decoded_for_extract);

log.info(decoded_for_extract.payload);
log.info(decoded_for_extract.payload.expiration);
log.info("#######");

    const cybotixPublicKey3 = fs.readFileSync('./keys/cybotix_public_key.pem');
    // Verify the token
    const jwt3 = require('jsonwebtoken');
    const decoded3 = jwt3.verify(platform_token, cybotixPublicKey3, { algorithms: ['ES256'] });
    log.info("decoded3");
    log.info(decoded3);


    // validate the inner part that comes from the client/customer
    //const platform_client = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb20iLCJzdWIiOiJhbm9ueW1vdXMiLCJzY29wZSI6ImZyZWVVc2VyIiwiZmF2b3JpdGVDb2xvciI6ImJsYWNrIiwiaWF0IjoxNjkzNzU1NDA3fQ.TKx_UhKDqc8pf50zAjj44rk0GD7h1078m8HMCylxTxEJOoQXQTrMOB2AlG0UDGJK5OR9dKARarehinXEl1b8Y1ZTNXe0bukEauitotZ6Zgh6e2HXydIl14BVJBKXF90krxw_3SsFp7lRE3utNlfC7QdEMOQLaqs17MUUNeiJTKeVC_-qWQE45in2xl35dePRYLvYVVNXFX-P6172IMTQ6dhuNM-Ni2eQvpkIXZRx2BCmKA3fsLsizw8KevAmbjMS7B28T7VwkfR6o_KeII8D0x3KJXn8zuUggNjIeQHosTGVlcAYchEH_xyGFMG5RpmcB2RfdRyq1n-_87O9DWanQQ';
    //const platform_client = decoded3.platform_client;
    // Decode the header without verification
    const jwt5 = require('jsonwebtoken');
    const decodedHeader3 = jwt5.decode(decoded3.platform_client, { complete: true }).header;
    log.info(decodedHeader3);
    log.info("decoded");
    const decoded_for_verification4 = jwt5.decode(decoded3.platform_client, { complete: true });
    log.info(decoded_for_verification4);

    const verify_with_key4 = decoded_for_verification4.payload.key;

    log.info("verify_with_key4");
    log.info(verify_with_key4);

    const decoded5 = jwt5.verify(decoded3.platform_client, verify_with_key4, { algorithms: ['RS256'] });
    log.info("decoded5");
    log.info(decoded5);
    // by verifying the first signature with th public key provided, it is proven that the private key used for the signature is the same as the public key provided.
    const clientpubkey = decoded5.key;
    return clientpubkey;
}