const sqlite3 = require('sqlite3').verbose();
const Ajv = require('ajv');
const fs = require('fs');
const jsonwebtoken = require('jsonwebtoken');
const jsonwebtoken2 = require('jsonwebtoken');
const crypto = require('crypto');

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
    console.log(`Received a request on path: ${req.path}`);
    next(); // Continue to the next middleware/route handler
});


/* check if a token has been revoked

Returns {"status":"not_revoked"} for valid token and 
{"status":"revoked"} for a revoked token
If no information found, return "not_revoked"

*/
  app.get('/plugin_user_query_accesstoken_status', (req, res) => {
    console.log(req.method);
    console.log(req.path);
    // check the token against the database
    console.log(req.query);
    console.log(req.query.uuid);


var installationUniqueId = "";
try {
    if (regExpValidInstallationUniqueId.test(req.header("installationUniqueId"))) {
      installationUniqueId = req.header("installationUniqueId");
      console.log("a valid installationUniqueId found in header (" +installationUniqueId+")");
 


const regExpValidTokenUUID = new RegExp(/^[a-zA-Z0-9_\.\-]{10,60}$/);
//const uuid = req.query.uuid;
var uuid = "";
try {
    if (regExpValidTokenUUID.test(req.query.uuid)) {
      uuid = req.query.uuid;
      console.log("a valid uuid found in querystring (" +uuid+")");
 


const sql = 'SELECT activestatus FROM CybotixDB.data_accesstokens_tb WHERE uuid="'+uuid+'"';
       

console.log("SQL 2");
console.log(sql);
connection.query(sql, installationUniqueId ,(err, rows) => {
  if (err) {
    return res.status(500).json({ error: 'Database error' });
  }
console.log(rows);
if (rows.length > 0)  {
  
  if (rows[0].activestatus == "1"){
console.log("active");
res.status(200).json({ activestatus: 'not_revoked' });
  }else{
console.log("not active");
res.status(200).json({ activestatus: 'revoked' });
  }
  } else {
    console.log("not found");
    res.status(200).json({ activestatus: 'not_revoked' });
  }

});
} else {
  console.log("an invalid uuid found in querystring");
}
} catch (err) {
console.log(err);
}
} else {
  console.log("an invalid installationUniqueId found in header");
}
} catch (err) {
console.log(err);
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
  console.log('/plugin_user_create_access_token');

  var installationUniqueId = "";
  try {

      if (regExpValidInstallationUniqueId.test(req.header("installationUniqueId"))) {
          installationUniqueId = req.header("installationUniqueId");
          console.log("a valid installationUniqueId found in header (" + installationUniqueId + ")");

          //create the access token based on the request approved by the user (per past agreement)
          console.log(req.body);


          const rawPlatformToken = req.get('X_HTTP_CYBOTIX_PLATFORM_TOKEN');
console.log("rawPlatformToken");

const parts = rawPlatformToken.replace(/-/g, '+').replace(/_/g, '/').split('.');
if (parts.length !== 3) {
    //throw new Error('Invalid token format');
    console.log('Invalid token format');
}
console.log("parts: " + parts[1 ]);
const payload_raw = parts[1 ];
const payload = Buffer.from(payload_raw, 'base64').toString('utf8');
console.log(payload);




          const rawDataRequest = req.get('X_HTTP_CYBOTIX_DATA_REQUEST');



      } else {
          console.log("an invalid installationUniqueId found in header");
      }
  } catch (err) {
      console.log(err);
  }


});




app.get('/fordevelopmentonly_generate_a_platform_token', (req, res) => {
    console.log(req.method);
    console.log(req.rawHeaders);
  // Validate JSON against schema
  const njwt = require("njwt");
const secureRandom = require("secure-random");

// This is a "secret key" that the creator of the JWT must keep private.
var key = secureRandom(256, { type: "Buffer" });

console.log(key);
// create expire timestamp
// Get the current date and time
const currentDate = new Date();

// Add 4 weeks (4 weeks * 7 days/week * 24 hours/day * 60 minutes/hour * 60 seconds/minute * 1000 milliseconds/second)
const futureDate = new Date(currentDate.getTime() + 4 * 7 * 24 * 60 * 60 * 1000);
console.log("futuredate: " + futureDate);
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
console.log("jwt:");
const jwt_json_text=JSON.stringify(jwt).replace(/}/g, "\n").replace(/","/g, '",\n"');
console.log(jwt);
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
console.log(jwt.compact());
// eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb20iLCJzdWIiOiJzb21ldXNlcmlkIiwic2NvcGUiOiJmcmVlVXNlciIsImZhdm9yaXRlQ29sb3IiOiJibGFjayIsImp0aSI6IjkwM2M1NDQ3LWViZmQtNDNlOC04ZjRkLWI3Y2M1OTIyZjVlYyIsImlhdCI6MTUyODgyNDM0OSwiZXhwIjoxNTI4ODI3OTQ5fQ.y7ad-nUsHAkI8a5bixYnr_v0vStRqnzsT4bbWGAM2vw

// Verify the JWT using the secret key
njwt.verify(token, key, (err, verifiedJwt) => {
  if (err) throw err;
  console.log("The JWT has been verified and can be trusted!");
  // The JWT has been verified and can be trusted!
});


const token_page='<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>download token</title></head><body>platform token  <div id="json">     <pre>'+jwt_json_text+'</pre> </div><div id="mydiv">     <b>'+jwt.compact()+'</b> </div>  </body></html>';


    res.status(200)
  res.send(token_page);



});




app.post('/fordevelopmentonly_generate_platform_token_from_key', (req, res) => {
    console.log(req.method);
    //console.log(req.rawHeaders);
    console.log("\n\nreq.body");
    console.log(req.body);
  
    console.log(req.body);

    const subject = req.body.sub;
const clientprivkey = req.body.privatekey_pem;
console.log("privkey: " + clientprivkey);

const clientpubkey = req.body.publickey_pem;
console.log("pubkey: " + clientpubkey);


  // Validate JSON against schema
  const njwt = require("njwt");
const secureRandom = require("secure-random");


// create expire timestamp
// Get the current date and time
const currentDate = new Date();

// Add 4 weeks (4 weeks * 7 days/week * 24 hours/day * 60 minutes/hour * 60 seconds/minute * 1000 milliseconds/second)
const futureDate = new Date(currentDate.getTime() + 4 * 7 * 24 * 60 * 60 * 1000);
console.log("futuredate: " + futureDate);
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
 console.log("token2");
 console.log(token2);

 // at the user customer has signed the "payload1" portion, creating JWS. 
 // Cybotix signes the whole resulting token with it's own private key. The result is the platform token. 
 // the signature-on-signature enures that the token can be trusted by the remote clients (plugins).

 const cybotixkey = fs.readFileSync('./keys/cybotix_private_key.pem');
    console.log("cybotixkey");
    console.log(cybotixkey);
    var payload = {
        platform_client: token2,
        expiration: futureDateISOString
      };

 
      const data_access_grant_token = jsonwebtoken2.sign(payload, cybotixkey, { algorithm: 'ES256' ,
      header: {
        kid: "1.0.0",
        sub: subject
      }});
      console.log("data_access_grant_token");
      console.log(data_access_grant_token);



// verify

 // Read the public key from the Cybotix key file
 
 const cybotixPublicKey = fs.readFileSync('./keys/cybotix_public_key.pem');
 // Verify the token
 const jwt = require('jsonwebtoken');
 const decoded = jwt.verify(data_access_grant_token, cybotixPublicKey, { algorithms: ['ES256'] });
console.log("decoded");
console.log( decoded);


      const jws_json_text2 ="";

// validate the inner part that comes from the client/customer
//const platform_client = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb20iLCJzdWIiOiJhbm9ueW1vdXMiLCJzY29wZSI6ImZyZWVVc2VyIiwiZmF2b3JpdGVDb2xvciI6ImJsYWNrIiwiaWF0IjoxNjkzNzU1NDA3fQ.TKx_UhKDqc8pf50zAjj44rk0GD7h1078m8HMCylxTxEJOoQXQTrMOB2AlG0UDGJK5OR9dKARarehinXEl1b8Y1ZTNXe0bukEauitotZ6Zgh6e2HXydIl14BVJBKXF90krxw_3SsFp7lRE3utNlfC7QdEMOQLaqs17MUUNeiJTKeVC_-qWQE45in2xl35dePRYLvYVVNXFX-P6172IMTQ6dhuNM-Ni2eQvpkIXZRx2BCmKA3fsLsizw8KevAmbjMS7B28T7VwkfR6o_KeII8D0x3KJXn8zuUggNjIeQHosTGVlcAYchEH_xyGFMG5RpmcB2RfdRyq1n-_87O9DWanQQ';
const platform_client = decoded.platform_client;

 // Decode the header without verification
 const jwt4 = require('jsonwebtoken');
 const decodedHeader = jwt4.decode(platform_client, { complete: true }).header;
console.log(decodedHeader);
console.log("decoded");
const decoded_for_verification=jwt4.decode(platform_client, { complete: true });
console.log(decoded_for_verification);

const verify_with_key = decoded_for_verification.payload.key;

console.log("verify_with_key");
console.log(verify_with_key);

const decoded2 = jwt.verify(platform_client, verify_with_key, { algorithms: ['RS256'] });
console.log("decoded2");
console.log( decoded2);
// by verifying the first signature with th public key provided, it is proven that the private key used for the signature is the same as the public key provided.



const token_page='<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>download token</title></head><body>platform token (JWS) <div id="json">     <pre>'+decoded+'</pre> </div><div id="mydiv">     <b>'+data_access_grant_token+'</b> </div>  </body></html>';


    res.status(200)
  res.send(token_page);



});




app.post('/fordevelopmentonly_generate_data_access_request_token_from_json_and_key', (req, res) => {
    //console.log(req.method);
    //console.log(req.rawHeaders);
   // console.log("\n\nreq.body");
    //console.log(req.body);
  
    //console.log(req.body);

//const platform_token = req.body.platform_token;
const platform_token = req.get('X_HTTP_CYBOTIX_PLATFORM_TOKEN');

console.log("platform_token: " + platform_token);



console.log("+\n");
console.log("data_access_request_payload: " + req.body.data_access_request_payload);

const data_request_json = decodeBase64(req.body.data_access_request_payload);

console.log("data_request_json: " + data_request_json);
// schema validate the request

// Validate JSON against schema
const valid = ajv.validate(data_access_request_json_schema, data_request_json);

console.log(valid);

if (!valid) {
  console.log("invalid data format");
  // return res.status(400).json({ error: 'Invalid data format' });
}
const data_request = JSON.parse(data_request_json);
console.log("data_request: " + data_request);
console.log( data_request);



const clientprivkey = req.body.privatekey_pem;
console.log("privkey: " + clientprivkey);



  // Validate the JSON of the data platform token against schema
  // before checking the signature, check the schema of the token
  

//Apply json schema to control the syntax in the data request


 


// get publickey from platform token


 // Read the public key from the Cybotix key file
 
 const clientpubkey = getKeyFromPlatformtoken(platform_token);
 
 console.log("clientpubkey");
 console.log(clientpubkey);


// create expire timestamp for data request token
// Get the current date and time
const currentDate = new Date();

// default (in milliseconds) duration of the data request token - set to 7 days
const default_duration =  7 * 24 * 60 * 60 * 1000;

// get proposed duration from the request submitted by client
try{
console.log(data_request);
//console.log(JSON.parse(data_request_json).one);
console.log(data_request.validity);
console.log(data_request.validity.notafter);
}catch(err){
  console.log(err);
}


console.log("time remaining on platform token");
console.log(currentDate);

const requested_expiration_date = data_request.validity.notafter;
console.log("requested_expiration_date: " + requested_expiration_date);

const date1 = new Date(data_request.validity.notafter);
const date2 = new Date(getPlatformtokenNotAfter(platform_token));
console.log("date1 : " + date1.getTime());
console.log("date2 : " + date2.getTime());

// set the expiration to what was requested
var expiration_date = date1;
// But if the platformtoken expires earlier than that, 
// use the shorter of the request time and the platform expiration time
if (date1.getTime() > date2.getTime()){
  console.log("reducing the expiration date to the platform token expiration date");
    expiration_date = date2;
}

console.log("expiration_date: " + expiration_date);




// Add 4 weeks (4 weeks * 7 days/week * 24 hours/day * 60 minutes/hour * 60 seconds/minute * 1000 milliseconds/second)
//const futureDate = new Date(currentDate.getTime() + 4 * 7 * 24 * 60 * 60 * 1000);
//console.log("futuredate: " + futureDate);
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
 console.log("token2");
 console.log(token2);

// URL/location where this data access grant token may be used
 var audience = ["https://api.cybotix.no/data","https://api.cybotix.no/development/data"];



 // at the user customer has signed the "payload1" portion, creating JWS. 
 // Cybotix signes the whole resulting token with it's own private key. The result is the platform token. 
 // the signature-on-signature enures that the token can be trusted by the remote clients (plugins).

 const cybotixkey = fs.readFileSync('./keys/cybotix_private_key.pem');
    console.log("cybotixkey");
    console.log(cybotixkey);
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
      console.log("data_access_grant_token");
      console.log(data_access_grant_token);



// verify the token just created

 // Read the public key from the Cybotix key file
 
 const cybotixPublicKey = fs.readFileSync('./keys/cybotix_public_key.pem');
 // Verify the token
 const jwt = require('jsonwebtoken');
 const decoded = jwt.verify(data_access_grant_token, cybotixPublicKey, { algorithms: ['ES256'] });
console.log("decoded");
console.log( decoded);


      const jws_json_text2 ="";

// validate the inner part that comes from the client/customer
//const platform_client = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb20iLCJzdWIiOiJhbm9ueW1vdXMiLCJzY29wZSI6ImZyZWVVc2VyIiwiZmF2b3JpdGVDb2xvciI6ImJsYWNrIiwiaWF0IjoxNjkzNzU1NDA3fQ.TKx_UhKDqc8pf50zAjj44rk0GD7h1078m8HMCylxTxEJOoQXQTrMOB2AlG0UDGJK5OR9dKARarehinXEl1b8Y1ZTNXe0bukEauitotZ6Zgh6e2HXydIl14BVJBKXF90krxw_3SsFp7lRE3utNlfC7QdEMOQLaqs17MUUNeiJTKeVC_-qWQE45in2xl35dePRYLvYVVNXFX-P6172IMTQ6dhuNM-Ni2eQvpkIXZRx2BCmKA3fsLsizw8KevAmbjMS7B28T7VwkfR6o_KeII8D0x3KJXn8zuUggNjIeQHosTGVlcAYchEH_xyGFMG5RpmcB2RfdRyq1n-_87O9DWanQQ';
const platform_client = decoded.platform_client;

 // Decode the header without verification
 const jwt4 = require('jsonwebtoken');
 const decodedHeader = jwt4.decode(platform_client, { complete: true }).header;
console.log(decodedHeader);
console.log("decoded");
const decoded_for_verification=jwt4.decode(platform_client, { complete: true });
console.log(decoded_for_verification);

const verify_with_key = decoded_for_verification.payload.key;

console.log("verify_with_key");
console.log(verify_with_key);

const decoded2 = jwt.verify(platform_client, verify_with_key, { algorithms: ['RS256'] });
console.log("decoded2");
console.log( decoded2);
// by verifying the first signature with th public key provided, it is proven that the private key used for the signature is the same as the public key provided.



const token_page='<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>download token</title></head><body>platform token (JWS) <div id="json">     <pre>'+decoded+'</pre> </div><div id="mydiv">     <b>'+data_access_grant_token+'</b> </div>  </body></html>';


    res.status(200)
    res.send(token_page);



});





app.post('/fordevelopmentonly_generate_data_agreement_grant_token_from_json_and_key', (req, res) => {
  //console.log(req.method);
  //console.log(req.rawHeaders);
 // console.log("\n\nreq.body");
  //console.log(req.body);

  //console.log(req.body);

//const platform_token = req.body.platform_token;
const platform_token = req.get('X_HTTP_CYBOTIX_PLATFORM_TOKEN');

console.log("platform_token: " + platform_token);




console.log("+\n");
console.log("data_agreement_request_payload: " + req.body.data_access_request_payload);

const data_request_json = decodeBase64(req.body.data_access_request_payload);

console.log("data_request_json: " + data_request_json);
// schema validate the request

// Validate JSON against schema
const valid = ajv.validate(data_access_request_json_schema, data_request_json);

console.log(valid);

if (!valid) {
console.log("invalid data format");
// return res.status(400).json({ error: 'Invalid data format' });
}
const data_request = JSON.parse(data_request_json);
console.log("data_request: " + data_request);
console.log( data_request);



const clientprivkey = req.body.privatekey_pem;
console.log("privkey: " + clientprivkey);



// Validate the JSON of the data platform token against schema
// before checking the signature, check the schema of the token


//Apply json schema to control the syntax in the data request





// get publickey from platform token


// Read the public key from the Cybotix key file

const clientpubkey = getKeyFromPlatformtoken(platform_token);

console.log("clientpubkey");
console.log(clientpubkey);


// create expire timestamp for data request token
// Get the current date and time
const currentDate = new Date();

// default (in milliseconds) duration of the data request token - set to 7 days
const default_duration =  7 * 24 * 60 * 60 * 1000;

// get proposed duration from the request submitted by client
try{
console.log(data_request);
//console.log(JSON.parse(data_request_json).one);
console.log(data_request.validity);
console.log(data_request.validity.notafter);
}catch(err){
console.log(err);
}


console.log("time remaining on platform token");
console.log(currentDate);

const requested_expiration_date = data_request.validity.notafter;
console.log("requested_expiration_date: " + requested_expiration_date);

const date1 = new Date(data_request.validity.notafter);
const date2 = new Date(getPlatformtokenNotAfter(platform_token));
console.log("date1 : " + date1.getTime());
console.log("date2 : " + date2.getTime());

// set the expiration to what was requested
var expiration_date = date1;
// But if the platformtoken expires earlier than that, 
// use the shorter of the request time and the platform expiration time
if (date1.getTime() > date2.getTime()){
console.log("reducing the expiration date to the platform token expiration date");
  expiration_date = date2;
}

console.log("expiration_date: " + expiration_date);




// Add 4 weeks (4 weeks * 7 days/week * 24 hours/day * 60 minutes/hour * 60 seconds/minute * 1000 milliseconds/second)
//const futureDate = new Date(currentDate.getTime() + 4 * 7 * 24 * 60 * 60 * 1000);
//console.log("futuredate: " + futureDate);
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
console.log("token2");
console.log(token2);

// URL/location where this data agreement grant token may be used
var audience = ["https://api.cybotix.no/data","https://api.cybotix.no/development/data"];



// at the user customer has signed the "payload1" portion, creating JWS. 
// Cybotix signes the whole resulting token with it's own private key. The result is the platform token. 
// the signature-on-signature enures that the token can be trusted by the remote clients (plugins).

const cybotixkey = fs.readFileSync('./keys/cybotix_private_key.pem');
  console.log("cybotixkey");
  console.log(cybotixkey);
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
    console.log("data_access_grant_token");
    console.log(data_access_grant_token);



// verify the token just created

// Read the public key from the Cybotix key file

const cybotixPublicKey = fs.readFileSync('./keys/cybotix_public_key.pem');
// Verify the token
const jwt = require('jsonwebtoken');
const decoded = jwt.verify(data_access_grant_token, cybotixPublicKey, { algorithms: ['ES256'] });
console.log("decoded");
console.log( decoded);


    const jws_json_text2 ="";

// validate the inner part that comes from the client/customer
//const platform_client = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb20iLCJzdWIiOiJhbm9ueW1vdXMiLCJzY29wZSI6ImZyZWVVc2VyIiwiZmF2b3JpdGVDb2xvciI6ImJsYWNrIiwiaWF0IjoxNjkzNzU1NDA3fQ.TKx_UhKDqc8pf50zAjj44rk0GD7h1078m8HMCylxTxEJOoQXQTrMOB2AlG0UDGJK5OR9dKARarehinXEl1b8Y1ZTNXe0bukEauitotZ6Zgh6e2HXydIl14BVJBKXF90krxw_3SsFp7lRE3utNlfC7QdEMOQLaqs17MUUNeiJTKeVC_-qWQE45in2xl35dePRYLvYVVNXFX-P6172IMTQ6dhuNM-Ni2eQvpkIXZRx2BCmKA3fsLsizw8KevAmbjMS7B28T7VwkfR6o_KeII8D0x3KJXn8zuUggNjIeQHosTGVlcAYchEH_xyGFMG5RpmcB2RfdRyq1n-_87O9DWanQQ';
const platform_client = decoded.platform_client;

// Decode the header without verification
const jwt4 = require('jsonwebtoken');
const decodedHeader = jwt4.decode(platform_client, { complete: true }).header;
console.log(decodedHeader);
console.log("decoded");
const decoded_for_verification=jwt4.decode(platform_client, { complete: true });
console.log(decoded_for_verification);

const verify_with_key = decoded_for_verification.payload.key;

console.log("verify_with_key");
console.log(verify_with_key);

const decoded2 = jwt.verify(platform_client, verify_with_key, { algorithms: ['RS256'] });
console.log("decoded2");
console.log( decoded2);
// by verifying the first signature with th public key provided, it is proven that the private key used for the signature is the same as the public key provided.



const token_page='<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>download token</title></head><body>platform token (JWS) <div id="json">     <pre>'+decoded+'</pre> </div><div id="mydiv">     <b>'+data_access_grant_token+'</b> </div>  </body></html>';


  res.status(200)
  res.send(token_page);



});



}



function inserttokenuuid(uuid){

  const sql = 'INSERT INTO CybotixDB.data_accesstoken_tb (createtime, uuid,1) VALUES (now(),"'+uuid + '", 1 )';
  
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
    console.log("decoded3");
    console.log(decoded3);


    // validate the inner part that comes from the client/customer
    //const platform_client = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb20iLCJzdWIiOiJhbm9ueW1vdXMiLCJzY29wZSI6ImZyZWVVc2VyIiwiZmF2b3JpdGVDb2xvciI6ImJsYWNrIiwiaWF0IjoxNjkzNzU1NDA3fQ.TKx_UhKDqc8pf50zAjj44rk0GD7h1078m8HMCylxTxEJOoQXQTrMOB2AlG0UDGJK5OR9dKARarehinXEl1b8Y1ZTNXe0bukEauitotZ6Zgh6e2HXydIl14BVJBKXF90krxw_3SsFp7lRE3utNlfC7QdEMOQLaqs17MUUNeiJTKeVC_-qWQE45in2xl35dePRYLvYVVNXFX-P6172IMTQ6dhuNM-Ni2eQvpkIXZRx2BCmKA3fsLsizw8KevAmbjMS7B28T7VwkfR6o_KeII8D0x3KJXn8zuUggNjIeQHosTGVlcAYchEH_xyGFMG5RpmcB2RfdRyq1n-_87O9DWanQQ';
    //const platform_client = decoded3.platform_client;
    // Decode the header without verification
    const jwt5 = require('jsonwebtoken');
    const decodedHeader3 = jwt5.decode(decoded3.platform_client, { complete: true }).header;
    console.log(decodedHeader3);
    console.log("decoded");
    const decoded_for_verification4 = jwt5.decode(decoded3.platform_client, { complete: true });
    console.log(decoded_for_verification4);

    const verify_with_key4 = decoded_for_verification4.payload.key;

    console.log("verify_with_key4");
    console.log(verify_with_key4);

    const decoded5 = jwt5.verify(decoded3.platform_client, verify_with_key4, { algorithms: ['RS256'] });
    console.log("decoded5");
    console.log(decoded5);
    // by verifying the first signature with th public key provided, it is proven that the private key used for the signature is the same as the public key provided.
    const clientpubkey = decoded5.key;
    return clientpubkey;
}




function getPlatformtokenNotAfter(platform_token) {
console.log("getPlatformtokenNotAfter");
const jwt = require('jsonwebtoken');
const decoded_for_extract = jwt.decode(platform_token, { complete: true });
return decoded_for_extract.payload.expiration;

console.log(decoded_for_extract);

console.log(decoded_for_extract.payload);
console.log(decoded_for_extract.payload.expiration);
console.log("#######");

    const cybotixPublicKey3 = fs.readFileSync('./keys/cybotix_public_key.pem');
    // Verify the token
    const jwt3 = require('jsonwebtoken');
    const decoded3 = jwt3.verify(platform_token, cybotixPublicKey3, { algorithms: ['ES256'] });
    console.log("decoded3");
    console.log(decoded3);


    // validate the inner part that comes from the client/customer
    //const platform_client = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb20iLCJzdWIiOiJhbm9ueW1vdXMiLCJzY29wZSI6ImZyZWVVc2VyIiwiZmF2b3JpdGVDb2xvciI6ImJsYWNrIiwiaWF0IjoxNjkzNzU1NDA3fQ.TKx_UhKDqc8pf50zAjj44rk0GD7h1078m8HMCylxTxEJOoQXQTrMOB2AlG0UDGJK5OR9dKARarehinXEl1b8Y1ZTNXe0bukEauitotZ6Zgh6e2HXydIl14BVJBKXF90krxw_3SsFp7lRE3utNlfC7QdEMOQLaqs17MUUNeiJTKeVC_-qWQE45in2xl35dePRYLvYVVNXFX-P6172IMTQ6dhuNM-Ni2eQvpkIXZRx2BCmKA3fsLsizw8KevAmbjMS7B28T7VwkfR6o_KeII8D0x3KJXn8zuUggNjIeQHosTGVlcAYchEH_xyGFMG5RpmcB2RfdRyq1n-_87O9DWanQQ';
    //const platform_client = decoded3.platform_client;
    // Decode the header without verification
    const jwt5 = require('jsonwebtoken');
    const decodedHeader3 = jwt5.decode(decoded3.platform_client, { complete: true }).header;
    console.log(decodedHeader3);
    console.log("decoded");
    const decoded_for_verification4 = jwt5.decode(decoded3.platform_client, { complete: true });
    console.log(decoded_for_verification4);

    const verify_with_key4 = decoded_for_verification4.payload.key;

    console.log("verify_with_key4");
    console.log(verify_with_key4);

    const decoded5 = jwt5.verify(decoded3.platform_client, verify_with_key4, { algorithms: ['RS256'] });
    console.log("decoded5");
    console.log(decoded5);
    // by verifying the first signature with th public key provided, it is proven that the private key used for the signature is the same as the public key provided.
    const clientpubkey = decoded5.key;
    return clientpubkey;
}