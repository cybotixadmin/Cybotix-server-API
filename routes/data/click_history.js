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
const e = require('express');
// Create a logger instance
const log = bunyan.createLogger({
        name: 'apiapp', // Name of the application
        streams: [{
                stream: new RotatingFileStream({
                    type: 'rotating-file',
                    path: './logs/server-data-%Y%m%d.log',
                    period: '1d', // daily rotation
                    totalFiles: 10, // keep up to 10 back copies
                    rotateExisting: true, // Give ourselves a clean file when we start up, based on period
                    threshold: '10m', // Rotate log files larger than 10 megabytes
                    totalSize: '20m', // Don't keep more than 20mb of archived log files
                    gzip: true, // Compress the archive log files to save space
                    template: 'server-%Y%m%d.log' //you can add. - _ before datestamp.
                })
            }
        ]
    });
module.exports = function (app, connection) {

    const regExpValidInstallationUniqueId = new RegExp(/^[a-zA-Z0-9_\.\-]{10,60}$/);

    // JSON Schema
    const plugin_user_post_click_json_schema = {
        type: 'object',
        properties: {
            content: {
                type: 'string',
                "minLength": 2,
                "maxLength": 30
            },
            localtime: {
                type: 'string',
                "minLength": 2,
                "maxLength": 30
            },
            url: {
                type: 'string',
                "minLength": 1,
                "maxLength": 1000
            },
            browser_id: {
                type: 'string',
                "pattern": "^[A-Za-z0-9\-_\.]{4,100}$",
                "minLength": 4,
                "maxLength": 100
            }
        },
        required: ['browser_id', 'url', 'localtime'],
    };

    const ajv = new Ajv();

    app.get('/data', (req, res) => {
        try {
            log.info("/data");
            log.info(req.rawHeaders);
            log.info(req.body);
            // Validate JSON against schema


            const rawPlatformToken = req.header("X_HTTP_CYBOTIX_PLATFORM_TOKEN");

            console.debug("isPlatformTokenRawStructureValid: " + isPlatformTokenRawStructureValid(req.header("X_HTTP_CYBOTIX_PLATFORM_TOKEN")));

            cons = req.header("X_HTTP_CYBOTIX_PLATFORM_TOKEN")
                const parts = rawPlatformToken.replace(/-/g, '+').replace(/_/g, '/').split('.');
            var rawPlatformTokenPayload = "";

            rawPlatformTokenPayload = parts[1];
            const rawPlatformTokenHeader = parts[0];
            const rawPlatformTokenSign = parts[1];

            console.log("platform token (raw): " + rawPlatformToken);
            console.log("platform token payload (base64): " + rawPlatformTokenPayload);

            console.debug("isPlatformtokenSignatureValid: " + decodedPlatformtokenSignatureValid(rawPlatformToken));

            // validate platformtoken signature
            const platformTokenPayload = decodedPlatformtokenSignatureValid(rawPlatformToken)
                if (platformTokenPayload) {
                    console.log("signature is valid and content is decoded as: " + platformTokenPayload);

                    // check the content of the platform token

                    //const platformTokenPayload = Buffer.from(rawPlatformTokenPayload, 'base64').toString('utf8');
                    //console.log("3.9. platform token payload(decoded): " + platformTokenPayload);
                    console.log(platformTokenPayload);

                    console.log("isPlatformTokenPayloadDataValid: " + isPlatformTokenPayloadDataValid(platformTokenPayload));

                    // check for possible revokcation of platformtoken
                    const tokenid = platformTokenPayload.jti;

                    var counterparty = platformTokenPayload.sub;
                    console.log("counterparty: " + counterparty);

                  
                    const rawDatagrantToken = req.header("X_HTTP_CYBOTIX_DATA_ACCESSTOKEN");
                    if (isDataAccessTokenRawStructureValid(rawDatagrantToken)) {

                        const datagrantTokenPayload = decodedDataGrantTokenSignatureValid(rawPlatformToken)
                            if (datagrantTokenPayload) {
                                console.log("data grant token signature is valid and content is decoded as: " + datagrantTokenPayload);

                                 // check for possible revocation of datagrant token


// check token content
console.log("isDatagrantTokenPayloadDataValid: " + isDatagrantTokenPayloadDataValid(datagrantTokenPayload));
if (isDatagrantTokenPayloadDataValid(datagrantTokenPayload)){

  const datagrantokenid = datagrantTokenPayload.jti;
  // check if the counterparty (subject of platformtoken) is in the dataaccess token audience
  console.log( platformTokenPayload.sub);
  console.log( datagrantTokenPayload.aud);
  console.log( platformTokenPayload.sub ==  datagrantTokenPayload.aud);
console.log("does the datatoken belong to the same entity as the platform token? ")



}else{

}

  

                            } else {}
                    } else {
                        console.log("invalud JWT structure");
                    }

                } else {
                    console.log("3.8. platform token signature invalid");
                    //return res.status(401).json({ error: 'Invalid platform token signature' });
                }

                var platformtoken;

            rawDatagrantToken = req.header("X_HTTP_CYBOTIX_DATA_ACCESSTOKEN");
            if (isDataAccessTokenRawStructureValid(rawDatagrantToken)) {
                console.log("rawDatagrantToken is requierd strcture");

            } else {}

            // check if is in platform token matches the id in the dataacces token. Do this check first, since this is a computationally "cheaper" test.

            // validate dataacces token

            // isDatagrantTokenPayloadDataValid(token)

            // check revocation of dataacces token


            // search filter is composed on the information from both token

            // user/subject filter is taken from the dataacces token

            // create search filter from the grants in the data access token

            // add search filter from the data query. The data query is optional, and if missing all that the data access token allows, is returned

            // get userid from ... field in data access token
            var userid;
            // get browserid from ... field in data access token
            var browserid;

            // look for time range in data access token
            var from;
            var to;

            // look for url filter in data access token


            // look for url filter in data query


            // only procceed if both tokens are present and valid

            // Read from database
            //const browser_id = [req.body.browser_id];
            //log.info(browser_id);
            //    const sql = 'SELECT * FROM messages WHERE browser_id = ? ORDER BY url';
            const sql = 'SELECT uuid,utc, local_time, url FROM ' + defaultdb + '.clickdata_tb WHERE browser_id = "' + browserid + '" ';
            log.info(sql);
            connection.query(sql, browserid, (err, rows) => {
                if (err) {
                    return res.status(500).json({
                        error: 'Database error'
                    });
                }
                log.info(rows);
                if (rows.length > 0) {
                    log.info(rows)
                    res.status(200).json(rows);
                } else {
                    res.status(404).json({
                        error: 'Message not found'
                    });
                }
            });
        } catch (e) {
            console.log(e);
            res.status(500).json({
                error: 'error'
            });
        }
    });
}

function isPlatformTokenPayloadDataValid(platform_token_payload) {
    console.log("isPlatformTokenPayloadDataValid");
    // check platform token issue and audience
    console.log(accepted_audiences);
    console.log(accepted_issuers);
    console.log(platform_token_payload);

    console.log("iss: " + platform_token_payload.iss);
    console.log("iss accept: " + (platform_token_payload.iss in accepted_issuers));
    console.log("sub: " + platform_token_payload.sub);
    console.log("aud: " + platform_token_payload.aud);
    console.log("aud accept: " + (platform_token_payload.aud in accepted_audiences));
    const now = Math.floor(Date.now() / 1000);
    console.log("now: " + now);

    console.log("exp: " + platform_token_payload.exp);
    console.log("exp accept: " + (now <= platform_token_payload.exp));
    console.log("nbf: " + platform_token_payload.nbf);
    console.log("nbf accept: " + (now >= platform_token_payload.nbf));

    if (platform_token_payload.iss in accepted_issuers &&
        platform_token_payload.aud in accepted_audiences &&
        now <= platform_token_payload.exp &&
        now >= platform_token_payload.nbf) {
        return true;
    } else {
        return false;
    }
}

function isDatagrantTokenPayloadDataValid(payload) {
    console.log("isDatagrantTokenPayloadDataValid");
    // check platform token issue and audience

    const accepted_audiences = config.datagrant_tokens.accepted_audiences;
    const accepted_issuers = config.datagrant_tokens.accepted_issuers;

    console.log(accepted_audiences);
    console.log(accepted_issuers);
    console.log(payload);

    console.log("iss: " + payload.iss);
    console.log("iss accept: " + (payload.iss in accepted_issuers));
    console.log("sub: " + payload.sub);
    console.log("jti: " + payload.jti);
    console.log("aud: " + payload.aud);
    console.log("aud accept: " + (payload.aud in accepted_audiences));
    const now = Math.floor(Date.now() / 1000);
    console.log("now: " + now);
    console.log("exp: " + payload.exp);
    console.log("exp accept: " + (now <= payload.exp));
    console.log("nbf: " + payload.nbf);
    console.log("nbf accept: " + (now >= payload.nbf));
    try{
    console.log("grant: " + grant);
    }catch(e){
      console.log(e);
    }
    if (payload.iss in accepted_issuers &&
        payload.aud in accepted_audiences &&
        now <= payload.exp &&
        now >= payload.nbf) {
        return true;
    } else {
        return false;
    }
}

function decodedPlatformtokenSignatureValid(token) {
    try {
        console.debug("isPlatformtokenSignatureValid");
        console.debug("isPlatformtokenSignatureValid, validating: " + token);
        const cybotixPublicKey = config.signature_validation_key;
        console.debug("isPlatformtokenSignatureValid, using: " + cybotixPublicKey);
        // Verify the token
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, cybotixPublicKey, {
                algorithms: ['ES256']
            });
        console.log("decoded");
        console.log(decoded);
        return decoded;
    } catch (e) {
        console.log(e);
        return false;
    }
}

function decodedDataGrantTokenSignatureValid(token) {
    try {
        console.debug("decodedDataGrantTokenSignatureValid, validating: " + token);
        const cybotixPublicKey = config.signature_validation_key;
        console.debug("decodedDataGrantTokenSignatureValid, using: " + cybotixPublicKey);
        // Verify the token
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, cybotixPublicKey, {
                algorithms: ['ES256']
            });
        console.log("decoded");
        console.log(decoded);
        return decoded;
    } catch (e) {
        console.log(e);
        return false;
    }
}

/*
Do basic "sanity"-check on the JWT holding the platform token
That it is of an appropriate length and that it is base64 encoded, and has the right number of delimiters
 */
function isPlatformTokenRawStructureValid(token) {
    console.debug("isPlatformTokenStructureValid");
    const regExpValidPlatformToken = new RegExp(/^[a-zA-Z0-9_\.\-_=]{100,2000}$/);
    if (regExpValidPlatformToken.test(token)) {
        return true
    } else {
        return false;
    }
}

/*
Do basic "sanity"-check on the JWT holding the data access token
That it is of an appropriate length and that it is base64 encoded, and has the right number of delimiters
 */
function isDataAccessTokenRawStructureValid(token) {
    console.debug("isDataAccessTokenStructureValid");
    const regExpValidDataAccessToken = new RegExp(/^[a-zA-Z0-9_\.\-_=]{100,2000}$/);
    if (regExpValidDataAccessToken.test(token)) {
        return true
    } else {
        return false;
    }
}
