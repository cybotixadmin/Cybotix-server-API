const Ajv = require('ajv');
const express = require('express');
const fs = require('fs');
const jsonwebtoken = require('jsonwebtoken');
const jsonwebtoken2 = require('jsonwebtoken');
const crypto = require('crypto');
const {
    v1: uuidv1,
    v4: uuidv4,
} = require('uuid');

// Read the configuration file once and store the data in memory
const configFile = fs.readFileSync('./config.json');
const config = JSON.parse(configFile);

accepted_audiences = config.accepted_audiences;
accepted_issuers = config.accepted_issuers;

const defaultdb = config.database.database_name;

const issuer = config.issuer;
const default_audience = config.default_audience;

const bunyan = require('bunyan');
var RotatingFileStream = require('bunyan-rotating-file-stream');
// Create a logger instance
const log = bunyan.createLogger({
        name: 'apiapp', // Name of the application
        streams: [{
                stream: new RotatingFileStream({
                    type: 'rotating-file',
                    path: 'logs/server-tokens-%Y%m%d.log',
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

    /**
     * package of functions to generate and validate tokens for the Cybotix platform
     */

    const regExpValidInstallationUniqueId = new RegExp(/^[a-zA-Z0-9_\.\-]{10,60}$/);

    // JSON Schema


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
            validity: {
                type: 'string',
                "minLength": 0,
                "maxLength": 30
            }
        },
        required: ['clickhistory']
    };

    const ajv = new Ajv();

    app.use((req, res, next) => {
        console.log(`Received a request on path: ${req.path}`);
        next(); // Continue to the next middleware/route handler
    });

    /* check if a token has been revoked

    Returns {"status":"not_revoked"} for valid token and {"status":"revoked"} for a revoked token
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
                console.log("a valid installationUniqueId found in header (" + installationUniqueId + ")");

                const regExpValidTokenUUID = new RegExp(/^[a-zA-Z0-9_\.\-]{10,60}$/);
                //const uuid = req.query.uuid;
                var uuid = "";
                try {
                    if (regExpValidTokenUUID.test(req.query.uuid)) {
                        uuid = req.query.uuid;
                        console.log("a valid uuid found in querystring (" + uuid + ")");

                        const sql = 'SELECT activestatus FROM ' + defaultdb + '.data_accesstokens_tb WHERE uuid="' + uuid + '"';

                        console.log("SQL 2");
                        console.log(sql);
                        connection.query(sql, installationUniqueId, (err, rows) => {
                            if (err) {
                                return res.status(500).json({
                                    error: 'Database error'
                                });
                            }
                            console.log(rows);
                            if (rows.length > 0) {

                                if (rows[0].activestatus == "1") {
                                    console.log("active");
                                    res.status(200).json({
                                        activestatus: 'not_revoked'
                                    });
                                } else {
                                    console.log("not active");
                                    res.status(200).json({
                                        activestatus: 'revoked'
                                    });
                                }
                            } else {
                                console.log("not found");
                                res.status(200).json({
                                    activestatus: 'not_revoked'
                                });
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

    app.get('/plugin_user_create_dataaccess_token', (req, res) => {
        console.log('/plugin_user_create_dataaccess_token');

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
                console.log("platform token payload(raw): " + parts[1]);
                const payload_raw = parts[1];
                const payload = Buffer.from(payload_raw, 'base64').toString('utf8');

                const platformtoken = getValidatedPlatformTokenPayload(req.get('X_HTTP_CYBOTIX_PLATFORM_TOKEN'));
                console.log(platformtoken);

                console.log("3.9. platform token payload(decoded): ");
                console.log(payload);
                const rawDataRequest_raw = req.get('X_HTTP_CYBOTIX_DATA_REQUEST');
                console.log("4.0. rawDataRequest(raw): " + rawDataRequest_raw);

                const restrictions_raw = req.get('X_HTTP_CYBOTIX_DATA_RESTRICTIONS');
                console.log("4.1. restrictions(raw): " + restrictions_raw);

                const rawDataRequest = Buffer.from(rawDataRequest_raw, 'base64').toString('utf8');
                console.log("rawDataRequest(decoded): " + rawDataRequest);
                const token = create_dataaccess_token(rawPlatformToken, rawDataRequest, installationUniqueId, null, restrictions_raw);
                console.log("#3.0.1. token");
                console.log(token);
                // Respond with JWT
                res.json({
                    dataaccesstoken: token
                });

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
        var key = secureRandom(256, {
                type: "Buffer"
            });

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
            iss: issuer,
            sub: "anonymous",
            scope: "freeUser",
            favoriteColor: "black",
            expiration: futureDateISOString
        };

        // Create a JWT
        var jwt = njwt.create(claims, key);

        // Log the JWT
        console.log("jwt:");
        const jwt_json_text = JSON.stringify(jwt).replace(/}/g, "\n").replace(/","/g, '",\n"');
        console.log(jwt);
        // The JWT in compacted form (ready for sending over the network)
        var token = jwt.compact();

        // Log the compacted JWT
        console.log(jwt.compact());
        // eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb20iLCJzdWIiOiJzb21ldXNlcmlkIiwic2NvcGUiOiJmcmVlVXNlciIsImZhdm9yaXRlQ29sb3IiOiJibGFjayIsImp0aSI6IjkwM2M1NDQ3LWViZmQtNDNlOC04ZjRkLWI3Y2M1OTIyZjVlYyIsImlhdCI6MTUyODgyNDM0OSwiZXhwIjoxNTI4ODI3OTQ5fQ.y7ad-nUsHAkI8a5bixYnr_v0vStRqnzsT4bbWGAM2vw

        // Verify the JWT using the secret key
        njwt.verify(token, key, (err, verifiedJwt) => {
            if (err)
                throw err;
            console.log("The JWT has been verified and can be trusted!");
            // The JWT has been verified and can be trusted!
        });

        const token_page = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>download token</title></head><body>platform token  <div id="json">     <pre>' + jwt_json_text + '</pre> </div><div id="mydiv">     <b>' + jwt.compact() + '</b> </div>  </body></html>';

        res.status(200)
        res.send(token_page);

    });


    /** create platform token
     * called from a GUI-frontend to create a platform token
     * Takes name and public key as input
     */
    app.post('/gui_user_create_platform_token2', (req, res) => {
        console.log('/gui_user_create_platform_token');
        console.log(req.method);
        console.log(req.rawHeaders);
        console.log("\n\nreq.body");
        console.log(req.body);
        console.log("\n\nreq.body.publicKey");
        console.log(req.body.publicKey);

        try {
            function isValidNameInput(input) {
                const name_regex = /^[A-Za-z0-9,.\- ]{1,50}$/;

                return name_regex.test(input);
            }

            function isValidPEMInput(input) {

                const pem_regex = /^[A-Za-z0-9\/\r\n\- \+=]{80,4000}$/;
                return pem_regex.test(input);
            }

            console.log("1.1");
            console.log(isValidNameInput(req.body.name));
            console.log(isValidPEMInput(req.body.publicKey));
            if (isValidNameInput(req.body.name) && isValidPEMInput(req.body.publicKey)) {
                console.log("1.2");

                // these two values should be know from the authentication that the customer goes through to get to this point
                const subject_name = req.body.name;
                const subject_id = uuidv4();
                console.log("subject_name: " + subject_name);
                console.log("subject_id: " + subject_id);
                const subject = {
                    name: subject_name,
                    id: subject_id
                };

                const sub = base64encode(JSON.stringify(subject));

                const publicKey = req.body.publicKey;

                if (!subject || !publicKey) {
                    return res.status(400).send("Missing name or public key.");
                }

                const payload = {
                    version: "1.0", // Version of the token
                    iss: issuer,
                    sub: sub, // subject of the token
                    aud: default_audience, // Audience of the token
                    key: [publicKey], // x5c expects an array of certificate strings. Here we provide only the public key.
                    jti: uuidv4(), // unique identifier for the token
                    iat: Math.floor(Date.now() / 1000), // Current timestamp
                    nbf: Math.floor(Date.now() / 1000), // Current timestamp
                    exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days from now
                };
                const cybotixkey = fs.readFileSync(config.signing_key);

                console.log("cybotixkey");
                console.log(cybotixkey);
                log.debug(payload);

                function readKeyFromFile(filePath) {
                    return new Promise((resolve, reject) => {
                        fs.readFile(filePath, (err, data) => {
                            if (err)
                                reject(err);
                            else
                                resolve(data);
                        });
                    });
                }

                // Usage
                const keyPath = 'keys/private_key.der';
                readKeyFromFile(keyPath)
                .then(function (derKey) {
                    console.log("DER data")
                    console.log(derKey);
                    return crypto.subtle.importKey(
                        "pkcs8",
                        derKey, {
                        name: "RSASSA-PKCS1-v1_5",
                        hash: "SHA-256"
                    },
                        false,
                        ["sign"]);
                }).then(function (key) {
                    console.log("key");
                    console.log(key);
                    return crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, data);
                }).then(function (signature) {
                    console.log("signature");
                    console.log(signature);
                    return signature;

                    // data is the key in Buffer format
                })
                .catch(err => console.error(err));

                var signAlgorithm = {
                    name: "RSASSA-PKCS1-v1_5",
                    hash: {
                        name: "SHA-256"
                    },
                    modulusLength: 2048,
                    extractable: false,
                    publicExponent: new Uint8Array([1, 0, 1])
                }

                const header2 = {
                    alg: "RS256",
                    typ: "JWT"
                };

                const payload2 = {
                    sub: "1234567890",
                    name: "John Doe",
                    iat: 1516239022
                };
                //const pem = "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDLdnnAn8J6XNVJ\nsWPYqKpLcisq8G/m0TlknJ6BXVriQBpFBOeUB3LoYEcPfoSneXtUqJeDEyUK8uil\n4hQm2eJ2Qf5i4y3AFa1uz2r3GhcIZ/mb9gf5lcXpvlCiUiFiR25kwLwXRlIoEm37\nwBMxNfwdvN6rje7yseLYoeOxFAUOLzxnpa0pNPfUyIDAT5avCOB8WO1KqRAVuAzw\nudNDUi/i/yxJjOnaQ3Y8Sfbw/YZHzGItMMSF2zCjIvjjPpHs7F6MibVRkbPaanjR\ngf/bjS7MATmGJ78Xl5SpIBJkNPUIdCvHQR1/i3bAdhn/BdT4EgSFdaNyST1XsY83\nBeH4Bkl7AgMBAAECggEAYTjXrOeqMnYxpOkS4PCXjz2aywXhMtY/Koh8ZSyKxRoE\nc36Ief+lNMzsp8a49J3kBOwamhOH29d+u+Vv47CxufiG6hHMRsEVAqIyZqkc4HNu\nnsvNu8GJtMuwFCBSu3eOlK5UMnrzvxovW+DISveU5VDexfMofufpkcKp3m/GiqPF\nh9OmO/zL1310WuUe7EiGXq6UACpdTpUvjHGMi+sjLnXJHglzYWbwFq7kHNnh+2dU\nv7EqaxMc8iSlaZXKmUdv0tdrzpH+wDcl+/M5glD/J8Me5Y2WvxVC+SwS2amYvlak\ngmRnMWKh4iKnd0Xguq15PLniOtLu742HhXR2UZgAQQKBgQDlnsFxwoAyWoWZmSYC\nFmBCCQ5FpNFnUdF2BXV1q5AIl2sHcFQSy5iGfVMn+jljkqR7QB4JHeALPGeTeNcV\nN7pxBlfcGH9PHx1LSfM4iFDIofWvIKVx6H9F8TVK4kmv7eldlHjAgPUA6uipQj0E\nS0+5FfnDzcM6QrPyK5YCEgs26QKBgQDi1mtTw87VdwvW1VZttK+pBMLuriDs7033\nVbnP5XQkJKBYFtaqkDwTLaiJexUbkZn0Z/Cs2moxCCdWx+4CUsEsQT0kBZbH21S2\nnGCHx0vzpXcIcgdZ3ZvvxgSk3XjvTVyDX+60xsnWF/Wr6CHatXi5BjuxseNJqJ9h\n90tqyWIGwwKBgQCbBgGoIh6W4FKOjr0Ab8bxDlgaYNoXnT+DJNBWb0vA4SmbThUU\n02vYcMgxl1gjh5+QrosYsJjQPSnYgJ8FbihrolKy/78D1gfbCsQwiKexrNbIM4w/\nSS6UM/M86WXCZydEzLZxkR7YTcBidZvoSEg8tz93GHYT4XDHsPGH2FLF8QKBgQDi\nGMzTqklAFi+zy+Mg6EdqlbdixidFYuV4kXbq1I9l8yfrhaAkVC29A/aISilo2ED3\nDp8i+3V7N+BWLGN851VqMgCqJfP7cw/GEKpay/hVe2jg/x96oFvsq5g3aBVBmP+M\nZxN8FuRZRHp4BaGw6M7SxXa8kE23Pp7Wu/HtF5tglwKBgEmzTBmi4CQFDEpwXuta\n4jplBmdEuGPs6FzY5SovdOMbN6udO7ICs+jIXVvAJyGssvT/jg9CCDFr6dx+goYL\nPpVEuEmJJEN45bmKTvCCIMfTBnd8pWW49dnl5LfUfQQw7Wws8VIZZwa9wrj9rVLq\nnt8QyVivyYTwHAFGMLWLjwhg\n-----END PRIVATE KEY-----\n";
                //const pem = "-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgjM6jmaLwQHpAgIm9\nOxFN4ru82FIg1AcGsJbXNjle/i6hRANCAAT4z+VwSM8VRyaKXjIopqYGk6VtF1QI\n85etadqMY1FEkCSmnEm34YJKXFyyPYjPkNlVL/naRhkOXHMIzmBdWLkI\n-----END PRIVATE KEY-----";
                const pem = "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDQtueUsvaeSPKJ\nslM2AXAtdWnWosUc6WlWRb/XlBoTHlh1bLhVu3xFBvpEB3NbkhuYEWxMU4PJ9ToZ\nESBwfc2tyCK4VU17USyVySCtMV4SnLJhZ91pEWrIArQf6Q2y9vxdC7jEahb2ntKX\nx/fYOMdURcxB06pNDNKt9f4xldBjK7RuvLspZrCg1vC3/ORUS3WReFtfsmKBeopU\nGP0VaclZjJ/PRK4eOgc1c/PIRdrzjHSNtxEBGliGYrdUVbbTiqc4hb5HYfsaZchy\ne89vKEItowLIUvrNPiCbR0xGYBXR55dxNBClm531Krnj6YmHoS+q2B+v/9dFCfVc\n1zrkQcX3AgMBAAECggEAZ+DAveeciwcvf4z7kUOB+34WoTb99/fL755jbv5NQ/q0\neC0WScU4gnqIkNdMeOTtSvBRAGQIkbm1osg9Zv+WIModTbVXDOtHz3z9AHYzpfvL\nZGN3dVWv2cBOuhsaMFpxHDY7TbanmzNNCTIDjuAjhTQABzs75YFeUiq+yxsPTmuI\n9X0cem8T/Joy1JnOWKKsdtFnkiNJiy0+ErwKXf0XgIJMG314pzz1TAlX0YmBGEuv\nPROiyubCBokIk1WSm0uowRRMvizQuqlioTmZTGS0a9AUuZq+8Pmyfpkd/37WglRE\n3tn9ykrEZJMMvB7z8R97ybxF2/EmnaVaB4DrVtPZsQKBgQD/SeNK8X/pbdcWQFMG\nuDqMA42+kkj3txEqRG0YpaLhl1u+KJxL5P8cY3tReN8ImzdE1zkOcz7IqpkG2iZA\nuCIFJORMmPSTVsD9uEQ0fEIGy95xrPzn0l4QOZIOWz/4TQ190rmM1r0+zpkEDKvp\nI8UwKxFTyCjr3cvhx1XSXMlDvQKBgQDRS8rvSbiMLnou9ROPk70dJ2a9fKEImmuQ\nIArZgupqZBL9Y5ahIYfr/Vow7MSW9yW9CpbP4WZcqTRLLr7CJslvasl48f12xkem\n/x/mHwHqMZcawUWWkaN2bLLl+tjeBBmptRdKPth64GCRonhpJvnMmbELOZy6F90e\nnLf2xqwxwwKBgQC4oJJOcAvnITYt9IVXVcOZ4TQRADDfXjl+zQ/thFUhO9rw0uP+\ni3Xo7RWRnY4H5mF5WwH7rmNYsvCLIRgLNF/+QmkN8IzpRhO7KxnAr6D801Jj+gzK\nB71ZlJlJ4rqH9Anu1oi1D9S76KSHZjaqHOGObYdRhW/67WR3PDeYNNymLQKBgCrD\n0Nhp+NJz4LVdkDyjFF4zodOP9pt6agYN9gmRrXJFtned9LZB0rMOlnIuvtCV+VkS\nI9SgGrlOPYgrKgEjyb8BU99pmr+9LgDaWls79Lk0nspxuVVVts/I0Bkb01ox/khl\n3zdldfhNho3bY70goKQEt18yy2pe2+iYXyKGX8LfAoGBAKVMAtHvUp6m7hnYiLgV\nK9hoVhRoxG+PEN0Ps9oNR+nk6u2ZmyjCpHmZ8otTP7BpG1PDoOBWruW9Bu7D7owc\nX1m8jpr0v0ikiq9jSQY8eXYyZc4dxjoejHPRRUihGP7gfIcWTwh+zTJU+OpQh0kM\noyqxpEFuH2ZaFE4esdwXBIyx\n-----END PRIVATE KEY-----\n"
                function base64StringToArrayBuffer(b64str) {
                    var byteStr = atob(b64str)
                        var bytes = new Uint8Array(byteStr.length)
                        for (var i = 0; i < byteStr.length; i++) {
                            bytes[i] = byteStr.charCodeAt(i)
                        }
                        return bytes.buffer
                }

                function importPrivateKey0(pem) {
                    console.log("pem: " + pem)
                    const pemHeader = "-----BEGIN PRIVATE KEY-----";
                    const pemFooter = "-----END PRIVATE KEY-----";
                    const pemContents = pem.replace(/\-\-*(BEGIN|END) *PRIVATE *KEY *\-\-*/g, '').replace(/\n/g, '');
                    console.log("pemContents: " + pemContents)
                    const binaryDer = str2ab(atob(pemContents));

                    return crypto.subtle.importKey(
                        "pkcs8",
                        binaryDer, {
                        name: "RSASSA-PKCS1-v1_5",
                        hash: {
                            name: "SHA-256"
                        },
                    },
                        true,
                        ["sign"]).catch(error => {
                        console.error('Error importing private key:', error);
                        throw error;
                    });
                }

                const signAlgorithm1 = {
                    name: "RSASSA-PKCS1-v1_5",
                    hash: {
                        name: "SHA-256"
                    },
                    modulusLength: 2048,
                    extractable: false,
                    publicExponent: new Uint8Array([1, 0, 1])
                }

                function importPrivateKey(pemKey) {
                    return new Promise(function (resolve) {
                        var importer = crypto.subtle.importKey("pkcs8", base64StringToArrayBuffer(pemKey.replace(/\-\-*(BEGIN|END) *PRIVATE *KEY *\-\-*/g, '').replace(/\n/g, '')), signAlgorithm1, true, ["sign"])
                            importer.then(function (key) {
                                resolve(key)
                            })
                    })
                }

                importPrivateKey(pem)
                .then(privateKey => console.log('Imported private key:', privateKey))
                .catch(err => console.error(err));

                function str2ab(str) {
                    const buf = new ArrayBuffer(str.length);
                    const bufView = new Uint8Array(buf);
                    for (let i = 0, strLen = str.length; i < strLen; i++) {
                        bufView[i] = str.charCodeAt(i);
                    }
                    return buf;
                }

                const encodedHeader = base64UrlEncode(utf8Encode(JSON.stringify(header2)));
                const encodedPayload = base64UrlEncode(utf8Encode(JSON.stringify(payload)));
                const data = utf8Encode(encodedHeader + "." + encodedPayload);

                crypto.subtle.sign({
                    name: "RSASSA-PKCS1-v1_5"
                },
                    privateKey, // The private key for signing
                    data).then(function (signature) {
                    console.log(signature);
                    const token2 = encodedHeader + "." + encodedPayload + "." + base64UrlEncode(signature);
                    console.log(token2);

                });

                const token = jsonwebtoken2.sign(payload, cybotixkey, {
                        algorithm: 'RS256',
                        header: {
                            typ: "JWT",
                            alg: "RS256"
                        }
                    });
                console.log("platform_token");
                console.log(token);

                console.log(token);

                // Splitting the JWT to get the header, payload, and signature
                const[header, load, signature] = token.split('.');

                // Base64-decoding the header and payload for display
                const decodedHeader = Buffer.from(header, 'base64').toString();
                const decodedPayload = Buffer.from(load, 'base64').toString();
                console.log("render");

                const parsedPayload = JSON.parse(decodedPayload);

                console.log("parsedPayload");
                console.log(parsedPayload);

                res.render('display_platformtoken', {
                    token: token,
                    decodedHeader: decodedHeader,
                    parsedPayload: parsedPayload,
                    signature: signature,
                    publicKey: config.signature_validation_key
                });

                //var page = '';

                // res.send(`Generated JWT: ${token}`);
            } else {
                return res.status(400).send("Missing name or public key.");
            }
        } catch (err) {
            console.log(err);
        }
    });

    app.post('/gui_user_create_platform_token3', (req, res) => {
        console.log('/gui_user_create_platform_token');
        console.log(req.method);
        console.log(req.rawHeaders);
        console.log("\n\nreq.body");
        console.log(req.body);
        console.log("\n\nreq.body.publicKey");
        console.log(req.body.publicKey);

        try {
            function isValidNameInput(input) {
                const name_regex = /^[A-Za-z0-9,.\- ]{1,50}$/;

                return name_regex.test(input);
            }

            function isValidPEMInput(input) {

                const pem_regex = /^[A-Za-z0-9\/\r\n\- \+=]{80,4000}$/;
                return pem_regex.test(input);
            }

            console.log("1.1");
            console.log(isValidNameInput(req.body.name));
            console.log(isValidPEMInput(req.body.publicKey));
            if (isValidNameInput(req.body.name) && isValidPEMInput(req.body.publicKey)) {
                console.log("1.2");

                // these two values should be know from the authentication that the customer goes through to get to this point
                const subject_name = req.body.name;
                const subject_id = uuidv4();
                console.log("subject_name: " + subject_name);
                console.log("subject_id: " + subject_id);
                const subject = {
                    name: subject_name,
                    id: subject_id
                };

                const sub = base64encode(JSON.stringify(subject));

                const publicKey = req.body.publicKey;

                if (!subject || !publicKey) {
                    return res.status(400).send("Missing name or public key.");
                }

                const payload = {
                    version: "1.0", // Version of the token
                    iss: issuer,
                    sub: sub, // subject of the token
                    aud: default_audience, // Audience of the token
                    key: [publicKey], // x5c expects an array of certificate strings. Here we provide only the public key.
                    jti: uuidv4(), // unique identifier for the token
                    iat: Math.floor(Date.now() / 1000), // Current timestamp
                    nbf: Math.floor(Date.now() / 1000), // Current timestamp
                    exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days from now
                };
                //const cybotixkey = fs.readFileSync(config.signing_key);
                // console.log("cybotixkey");
                // console.log(cybotixkey);
                log.debug(payload);

                function base64StringToArrayBuffer(b64str) {
                    var byteStr = atob(b64str)
                        var bytes = new Uint8Array(byteStr.length)
                        for (var i = 0; i < byteStr.length; i++) {
                            bytes[i] = byteStr.charCodeAt(i)
                        }
                        return bytes.buffer
                }
                function convertPemToBinary(pem) {
                    var lines = pem.split('\n')
                        var encoded = ''
                        for (var i = 0; i < lines.length; i++) {
                            if (lines[i].trim().length > 0 &&
                                lines[i].indexOf('-BEGIN RSA PRIVATE KEY-') < 0 &&
                                lines[i].indexOf('-BEGIN RSA PUBLIC KEY-') < 0 &&
                                lines[i].indexOf('-END RSA PRIVATE KEY-') < 0 &&
                                lines[i].indexOf('-END RSA PUBLIC KEY-') < 0 &&
                                lines[i].indexOf('-BEGIN PRIVATE KEY-') < 0 &&
                                lines[i].indexOf('-BEGIN PUBLIC KEY-') < 0 &&
                                lines[i].indexOf('-END PRIVATE KEY-') < 0 &&
                                lines[i].indexOf('-END PUBLIC KEY-') < 0) {
                                encoded += lines[i].trim()
                            }
                        }
                        return base64StringToArrayBuffer(encoded)
                }

                function importPublicKey(pemKey) {
                    return new Promise(function (resolve) {
                        var importer = crypto.subtle.importKey("spki", convertPemToBinary(pemKey), signAlgorithm, true, ["verify"])
                            importer.then(function (key) {
                                resolve(key)
                            })
                    })
                }

                function importPrivateKey(pemKey) {
                    return new Promise(function (resolve) {
                        var importer = crypto.subtle.importKey("pkcs8", convertPemToBinary(pemKey), signAlgorithm, true, ["sign"])
                            importer.then(function (key) {
                                resolve(key)
                            })
                    })
                }

                const jwtheader = {
                    alg: 'RS256',
                    typ: 'JWT'
                };
                console.log(jwtheader);
                console.log(JSON.stringify(jwtheader));
                const jwtheader_b64 = base64encode(JSON.stringify(jwtheader));
                console.log(jwtheader_b64);

                const privatekeyPEM = fs.readFileSync(config.platformtoken_signing_key);
                console.log(privatekeyPEM);
                console.log("crypto.subtle");
                console.log(crypto.subtle);

                const jwtpayload = {
                    "name": "test",
                    "publicKey": "publickeyPEM"
                }
                console.log(JSON.stringify(jwtpayload));
                const jwtpayload_b64 = base64encode(JSON.stringify(jwtpayload));
                console.log(jwtpayload_b64);
                console.log(jwtpayload);
                const toSignJwtData = jwtheader_b64 + "." + jwtpayload_b64;
                console.log("toSignData: " + toSignJwtData);
                importPrivateKey(privatekeyPEM).then(function (key) {
                    console.log(key);
                    signData(key, toSignJwtData).then(function (jwtSignature) {
                        console.log(jwtSignature);
                        const jwtSignature_b64 = arrayBufferToBase64(jwtSignature);
                        console.log(jwtSignature_b64);
                        const jwt = urlEncodeBase64data(toSignJwtData + "." + jwtSignature_b64);
                        console.log(jwt);

                        // Splitting the JWT to get the header, payload, and signature
                        const[header, load, signature] = token.split('.');

                        // Base64-decoding the header and payload for display
                        const decodedHeader = Buffer.from(header, 'base64').toString();
                        const decodedPayload = Buffer.from(load, 'base64').toString();
                        console.log("render");

                        const parsedPayload = JSON.parse(decodedPayload);

                        console.log("parsedPayload");
                        console.log(parsedPayload);

                        res.render('display_platformtoken', {
                            token: jwt,
                            decodedHeader: JSON.stringify(jwtheader),
                            parsedPayload: parsedPayload,
                            signature: signature,
                            publicKey: config.signature_validation_key
                        });

                    })
                });

                //var page = '';

                // res.send(`Generated JWT: ${token}`);
            } else {
                return res.status(400).send("Missing name or public key.");
            }
        } catch (err) {
            console.log(err);
        }

    });

}

function base64UrlEncode(str) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function utf8Encode(str) {
    return new TextEncoder().encode(str);
}

function getValidatedPlatformTokenPayload(rawPlatformToken) {
    try {
        //     const token = rawPlatformToken.replace(/-/g, '+').replace(/_/g, '/');
        const token = rawPlatformToken;
        /*
        Do basic "sanity"-check on the JWT holding the platform token
        That it is of an appropriate length and that it is base64 encoded, and has the right number of delimiters
         */
        function isPlatformTokenRawStructureValid(token) {
            console.debug("isPlatformTokenStructureValid");
            const regExpValidPlatformToken = new RegExp(/^[a-zA-Z0-9\/_\.\-_=]{100,2000}$/);
            if (regExpValidPlatformToken.test(token)) {
                return true
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

        if (isPlatformTokenRawStructureValid(token)) {
            const platformTokenPayload = decodedPlatformtokenSignatureValid(token);
            if (platformTokenPayload) {
                console.log("signature is valid and content is decoded as: " + platformTokenPayload);

                // check the content of the platform token
                if (isPlatformTokenPayloadDataValid(platformTokenPayload)) {
                    if (checkTokenRevokationIfRevocationEndPointIsPresent) {
                        // look for token revocation endpoint in the JWT itself

                    } else {

                        return platformTokenPayload;
                    }
                } else {
                    console.log("invalid platform token content");
                    return false;
                }

            } else {
                console.log("3.8. platform token signature invalid");
                //return res.status(401).json({ error: 'Invalid platform token signature' });
            }

        } else {
            console.log("invalid platform token structure");
            return false;
        }

    } catch (e) {
        console.log(e);
        return false;
    }
}

function inserttokenuuid(uuid, expiretime, type) {

    var sql;
    if (type == "platformtoken") {
        sql = 'INSERT INTO ' + defaultdb + '.data_platformtoken_tb (createtime, uuid,1) VALUES (now(),"' + uuid + '", 1 )';
    } else if (type == "accesstoken") {
        sql = 'INSERT INTO ' + defaultdb + '.data_accesstoken_tb (createtime, uuid,1) VALUES (now(),"' + uuid + '", 1 )';
    }

    console.log("SQL 1");
    console.log(sql);

    connection.query(sql, function (err, result) {
        //db.all(sql, values, (err, rows) => {
        if (err) {
            log.debug(err);
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
            res.status(200).json('{"added:"' + result.affectedRows + "}");
        } else {
            res.status(404).json({});
        }
    });

}

function isPlatformTokenPayloadDataValid(platform_token_payload) {
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

function create_dataaccess_token(rawPlatformToken, rawDataRequest, installationUniqueId, userid, restrictions_raw) {
    console.log("## create_dataaccess_token");
    console.log("rawDataRequest(decoded): " + rawDataRequest);
    //const parts = rawPlatformToken.replace(/-/g, '+').replace(/_/g, '/').split('.');
    // if (parts.length !== 3) {
    //throw new Error('Invalid token format');
    //     console.log('Invalid token format');
    // }
    //console.log("payload(raw): " + parts[1]);
    //const payload_raw = parts[1];
    //const payload = Buffer.from(payload_raw, 'base64').toString('utf8');
    // console.log("payload(decoded): ");
    // console.log(payload);

    platformTokenPayload = getValidatedPlatformTokenPayload(rawPlatformToken);
    //platformTokenPayload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    //console.log(isPlatformTokenPayloadDataValid(platformTokenPayload));
    // check if the platform token is valid


    // check if the platform token has been revoked


    //console.log("rawDataRequest(raw): " + rawDataRequest_raw);

    //const rawDataRequest = Buffer.from(rawDataRequest_raw, 'base64').toString('utf8');

    console.log("rawRestrictions(raw): " + restrictions_raw);
    var restrictions;
    console.log("5.1.0 rawRestrictions(raw): " + (restrictions_raw === undefined));
    if (restrictions_raw !== undefined) {
        restrictions = Buffer.from(restrictions_raw, 'base64').toString('utf8');
    }

    console.log("rawRestrictions(decoded): " + restrictions);

    var data_subject = {
        installationUniqueId: installationUniqueId
    };
    if (userid) {
        data_subject.userid = "user";
    }

    // lookup existing data agreements to find the duration time for this access token
    // the agreemant especifiesnot only the scope of the data that may be accessed.
    // But also who long the access token should be valid for, before another one must be requested.
    // default is 3 days
    var expiration = Math.floor(Date.now() / 1000) + (3 * 24 * 60 * 60); // 3 days from now
    // check if there is an expiration in the restrictions

    try {
        console.log("restrictions");
        console.log(restrictions);
        console.log("restrictions.notafter");
        if (restrictions.notafter !== undefined) {
            console.log(restrictions.notafter);
            // there was an expiration present, use it
            expiration = restrictions.notafter;
        }
    } catch (err) {
        console.log(err);
    }
    // look for agreement
    try {
        console.log("restrictions");
        var counterparty = restrictions.counterparty;
    } catch (err) {
        console.log(err);
    }

    // check if there is an existing agreement for this installation, if o get expiration from there

    console.log("4.4.2 ");

    console.log(JSON.parse(rawDataRequest));
    console.log("4.4.3 ");
    const grants = JSON.parse(rawDataRequest).requests;
    console.log(grants);
    console.log("4.4.5 ");
    console.log(JSON.stringify((JSON.parse(rawDataRequest)).requests));
    console.log("4.4.6 ");
    console.log(base64encode(JSON.stringify((JSON.parse(rawDataRequest)).requests)));
    const data_grant = {
        data_subject: data_subject,
        grants: grants

    };

    console.log("data_grant")
    console.log(data_grant)

    console.log("4.4.7 ");
    var token;
    const dataaccess_token_payload = {
        version: "1.0", // Version of the token
        iss: issuer,
        sub: platformTokenPayload.sub, // who the token belongs to
        aud: config.data_access_token_audience.clickstreamdata_location, // Audience of the token
        jti: uuidv4(),
        iat: Math.floor(Date.now() / 1000), // Current timestamp
        nbf: Math.floor(Date.now() / 1000), // Current timestamp
        exp: expiration,
        grant: Buffer.from(JSON.stringify(data_grant)).toString('base64')
    };
    const cybotixkey = fs.readFileSync(config.signing_key);
    console.log("cybotixkey");

    console.log("" + platformTokenPayload.sub);
    console.log("" + platformTokenPayload.sub);

    console.log(cybotixkey);
    console.log("platformTokenPayload.    sub: " + platformTokenPayload.sub);
    console.log("dataaccess_token_payload.sub: " + dataaccess_token_payload.sub);
    console.log("6.1.1");
    //Buffer.from(rawData).toString('base64')
    // const token_payload_enc = str2base64((JSON.stringify(token_payload)));
    // console.log("token_payload, encoded");
    //console.log(token_payload_enc);

    token = jsonwebtoken2.sign(dataaccess_token_payload, cybotixkey, {
            algorithm: 'ES256',
            header: {
                typ: "JWT",
                alg: "ES256"
            }
        });
    console.log("data_access_grant_token");
    console.log(token);

    return token;

}

function base64decode(data) {
    return atob(data);
}

function base64encode(str) {
    return btoa(str);
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
    const decoded3 = jwt3.verify(platform_token, cybotixPublicKey3, {
            algorithms: ['ES256']
        });
    console.log("decoded3");
    console.log(decoded3);

    // validate the inner part that comes from the client/customer
    //const platform_client = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb20iLCJzdWIiOiJhbm9ueW1vdXMiLCJzY29wZSI6ImZyZWVVc2VyIiwiZmF2b3JpdGVDb2xvciI6ImJsYWNrIiwiaWF0IjoxNjkzNzU1NDA3fQ.TKx_UhKDqc8pf50zAjj44rk0GD7h1078m8HMCylxTxEJOoQXQTrMOB2AlG0UDGJK5OR9dKARarehinXEl1b8Y1ZTNXe0bukEauitotZ6Zgh6e2HXydIl14BVJBKXF90krxw_3SsFp7lRE3utNlfC7QdEMOQLaqs17MUUNeiJTKeVC_-qWQE45in2xl35dePRYLvYVVNXFX-P6172IMTQ6dhuNM-Ni2eQvpkIXZRx2BCmKA3fsLsizw8KevAmbjMS7B28T7VwkfR6o_KeII8D0x3KJXn8zuUggNjIeQHosTGVlcAYchEH_xyGFMG5RpmcB2RfdRyq1n-_87O9DWanQQ';
    //const platform_client = decoded3.platform_client;
    // Decode the header without verification
    const jwt5 = require('jsonwebtoken');
    const decodedHeader3 = jwt5.decode(decoded3.platform_client, {
            complete: true
        }).header;
    console.log(decodedHeader3);
    console.log("decoded");
    const decoded_for_verification4 = jwt5.decode(decoded3.platform_client, {
            complete: true
        });
    console.log(decoded_for_verification4);

    const verify_with_key4 = decoded_for_verification4.payload.key;

    console.log("verify_with_key4");
    console.log(verify_with_key4);

    const decoded5 = jwt5.verify(decoded3.platform_client, verify_with_key4, {
            algorithms: ['RS256']
        });
    console.log("decoded5");
    console.log(decoded5);
    // by verifying the first signature with th public key provided, it is proven that the private key used for the signature is the same as the public key provided.
    const clientpubkey = decoded5.key;
    return clientpubkey;
}

function getPlatformtokenNotAfter(platform_token) {
    console.log("getPlatformtokenNotAfter");
    const jwt = require('jsonwebtoken');
    const decoded_for_extract = jwt.decode(platform_token, {
            complete: true
        });
    return decoded_for_extract.payload.expiration;

    console.log(decoded_for_extract);

    console.log(decoded_for_extract.payload);
    console.log(decoded_for_extract.payload.expiration);
    console.log("#######");

    const cybotixPublicKey3 = fs.readFileSync('./keys/cybotix_public_key.pem');
    // Verify the token
    const jwt3 = require('jsonwebtoken');
    const decoded3 = jwt3.verify(platform_token, cybotixPublicKey3, {
            algorithms: ['ES256']
        });
    console.log("decoded3");
    console.log(decoded3);

    // validate the inner part that comes from the client/customer
    //const platform_client = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb20iLCJzdWIiOiJhbm9ueW1vdXMiLCJzY29wZSI6ImZyZWVVc2VyIiwiZmF2b3JpdGVDb2xvciI6ImJsYWNrIiwiaWF0IjoxNjkzNzU1NDA3fQ.TKx_UhKDqc8pf50zAjj44rk0GD7h1078m8HMCylxTxEJOoQXQTrMOB2AlG0UDGJK5OR9dKARarehinXEl1b8Y1ZTNXe0bukEauitotZ6Zgh6e2HXydIl14BVJBKXF90krxw_3SsFp7lRE3utNlfC7QdEMOQLaqs17MUUNeiJTKeVC_-qWQE45in2xl35dePRYLvYVVNXFX-P6172IMTQ6dhuNM-Ni2eQvpkIXZRx2BCmKA3fsLsizw8KevAmbjMS7B28T7VwkfR6o_KeII8D0x3KJXn8zuUggNjIeQHosTGVlcAYchEH_xyGFMG5RpmcB2RfdRyq1n-_87O9DWanQQ';
    //const platform_client = decoded3.platform_client;
    // Decode the header without verification
    const jwt5 = require('jsonwebtoken');
    const decodedHeader3 = jwt5.decode(decoded3.platform_client, {
            complete: true
        }).header;
    console.log(decodedHeader3);
    console.log("decoded");
    const decoded_for_verification4 = jwt5.decode(decoded3.platform_client, {
            complete: true
        });
    console.log(decoded_for_verification4);

    const verify_with_key4 = decoded_for_verification4.payload.key;

    console.log("verify_with_key4");
    console.log(verify_with_key4);

    const decoded5 = jwt5.verify(decoded3.platform_client, verify_with_key4, {
            algorithms: ['RS256']
        });
    console.log("decoded5");
    console.log(decoded5);
    // by verifying the first signature with th public key provided, it is proven that the private key used for the signature is the same as the public key provided.
    const clientpubkey = decoded5.key;
    return clientpubkey;
}
