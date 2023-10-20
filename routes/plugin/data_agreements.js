
const Ajv = require('ajv');
const crypto = require('crypto');
const multer = require('multer');
const storage = multer.memoryStorage(); // Store the file in memory
const upload = multer({
        storage: storage
    });
const multiparty = require('multiparty');
const formidable = require("formidable");
const fs = require('fs');
const express = require('express');

const valid_audience_values = {
    "cybotix-personal-data-commander": "1",
    "Cybotix": "1"
};

const bunyan = require('bunyan');
var RotatingFileStream = require('bunyan-rotating-file-stream');
// Create a logger instance
const log = bunyan.createLogger({
  name: 'apiapp',                    // Name of the application
  streams: [{
    stream: new RotatingFileStream({
        type: 'rotating-file',
        path: './logs/server-data_agreements-%Y%m%d.log',
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

    // JSON Schema


    const plugin_user_add_data_agreement_json_schema = {
        type: "object",
        properties: {
            counterparty_id: {
                type: 'string',
                "minLength": 0,
                "maxLength": 300
            },
            userid: {
                type: 'string',
                "minLength": 0,
                "maxLength": 300
            },
            browser_id: {
                type: 'string',
                "pattern": "^[A-Za-z0-9]{4,}$",
                "minLength": 4,
                "maxLength": 60
            }
        },
        required: ['counterparty_id'],
    };

    const plugin_user_validate_data_agreement_json_schema = {
        type: "object",
        properties: {
            counterparty_id: {
                type: 'string',
                "minLength": 0,
                "maxLength": 300
            },
            userid: {
                type: 'string',
                "minLength": 0,
                "maxLength": 300
            },
            browser_id: {
                type: 'string',
                "pattern": "^[A-Za-z0-9]{4,}$",
                "minLength": 4,
                "maxLength": 60
            }
        },
        required: ['counterparty_id'],
    };

    const plugin_user_read_all_agreements_json_schema = {
        type: "object",
        properties: {
            userid: {
                type: 'string',
                "minLength": 0,
                "maxLength": 300
            },
            browser_id: {
                type: 'string',
                "pattern": "^[A-Za-z0-9]{4,}$",
                "minLength": 4,
                "maxLength": 60
            }
        },
        required: ['browser_id', 'userid'],
    };

    const plugin_user_delete_data_agreement_json_schema = {
        type: "object",
        properties: {
            uuid: {
                type: 'string',
                "minLength": 0,
                "maxLength": 300
            },
            userid: {
                type: 'string',
                "minLength": 0,
                "maxLength": 300
            },
            browser_id: {
                type: 'string',
                "pattern": "^[A-Za-z0-9]{4,}$",
                "minLength": 4,
                "maxLength": 60
            }
        },
        required: ['browser_id', 'userid', 'uuid'],
    };

    const plugin_user_check_request_against_data_agreements_json_schema = {
        type: "object",
        properties: {
            platformtoken: {
                type: 'string',
                "minLength": 0,
                "maxLength": 2000
            },
            request: {
                type: 'string',
                "minLength": 0,
                "maxLength": 2000
            }
        },
        required: [],
    };

    const ajv = new Ajv();

    const regExpValidInstallationUniqueId = new RegExp(/^[a-zA-Z0-9_\.\-]{10,60}$/);

    /**
     * {
    "createtime":"2023-08-28T20:49:41.725Z",
    "lastmodifiedtime":"2023-08-29T20:49:41.725Z",
    "principal_name" : "2342",
    "principal_id":"2342",
    "counterparty_name" :"Web Shop Inc.",
    "counterparty_id":"65232",
    "data_grants" : [{"one": "two"} ,{"one":"two"}
    ]
    }
     *
     */

    app.post('/plugin_user_add_data_agreement', (req, res) => {
        // Validate JSON against schema
        const valid = ajv.validate(plugin_user_add_data_agreement_json_schema, req.body);
        //const valid = true;
        if (!valid) {
            return res.status(400).json({
                error: 'Invalid data format'
            });
        }
        var installationUniqueId = "";
        try {

            if (regExpValidInstallationUniqueId.test(req.header("installationUniqueId"))) {
                installationUniqueId = req.header("installationUniqueId");
                log.info("a valid installationUniqueId found in header (" + installationUniqueId + ")");
            } else {
                log.info("an invalid installationUniqueId found in header");

            }

        } catch (err) {
            log.info(err);

        }
        log.info("adding agreement");
        log.info(JSON.stringify(req.body));

        // generate agreement id

        const uuid = crypto.randomUUID()

            // var data_grants = req.body.data_grants;
            // log.debug(data_grants)
            // log.debug(JSON.stringify(data_grants))

            var original_request;
        try {
            original_request = JSON.stringify(req.body.original_request);
        } catch (err) {}
        //json.uuid = uuid;

        // use the data_grants field to contain more easily searchable specifics about the access granted.
        var data_grants;
        try {
            log.debug("data grants")
            //log.debug(req.body.data_grants);
            data_grants = JSON.stringify(req.body.data_grants);
            //log.debug(req.body.original_request.requests[0]);
            log.debug(data_grants);
            //          log.debug(data_grants === "undefined");


            //data_grants = '{"data_grants":'+JSON.stringify(data_grants) + '}';
        } catch (err) {}

        log.debug(original_request);
        //       const sql = 'INSERT INTO Cybotix.data_agreements_tb ( browser_id, uuid, createtime, lastmodifiedtime, json ) VALUES (?,?,?,?,?)';
        const utc = new Date().toISOString();
        //const values = [req.body.browser_id ,uuid , req.body.agreement_json.createtime , utc  , JSON.stringify(json)];
        //log.info(values);
        var sql;
        //  if (data_grants === "undefined"){
        //    sql = 'INSERT INTO CybotixDB.data_agreements_tb ( browserid, uuid, createtime, lastmodifiedtime,active,  original_request ) VALUES("'+installationUniqueId+'","'+uuid+'", now(), now(),1,' + "'"+ original_request+ "'"+')';
        //  }else{
        sql = 'INSERT INTO CybotixDB.data_agreements_tb ( browserid, uuid, createtime, lastmodifiedtime,active, data_grants, original_request ) VALUES("' + installationUniqueId + '","' + uuid + '", now(), now(),1, ' + "'" + data_grants + "','" + original_request + "'" + ')';
        //  }

        log.info("SQL 2");
        log.info(sql);

        connection.query(sql, function (err, result) {
            //db.all(sql, values, (err, rows) => {
            if (err) {
                log.debug(err);
                return res.status(500).json({
                    error: 'Database error'
                });
            }
            log.info(result);
            log.info(result.affectedRows);
            //log.info("1---"+JSON.parse(result));
            //log.info("2---"+JSON.stringify(result));


            if (result.affectedRows > 0) {
                log.info("affectedRows: " + result.affectedRows)
                res.status(200).json('{"added:"' + result.affectedRows + "}");
            } else {
                res.status(404).json({});
            }
        });
    });

    app.get('/plugin_user_check_request_against_data_agreements', (req, res) => {
        log.info(req.method);
        log.info(req.rawHeaders);

        var isCoveredByAgreement = false;
        var installationUniqueId = "";
        try {

            if (regExpValidInstallationUniqueId.test(req.header("installationUniqueId"))) {
                installationUniqueId = req.header("installationUniqueId");
                log.info("a valid installationUniqueId found in header (" + installationUniqueId + ")");

                const rawPlatformToken = req.get('X_HTTP_CYBOTIX_PLATFORM_TOKEN');
                getValidPlatformToken(rawPlatformToken).then(function (data) {
                    log.info(data);

                    // lookup the ID from the platform token agains this users agreements in the database
                    const counterparty_id = data.sub;
                    log.debug("counterparty_id: " + counterparty_id);

                    //
                    const sql = 'SELECT * FROM CybotixDB.data_agreements_tb WHERE counterparty_id = "' + counterparty_id + '" AND browserid = "' + installationUniqueId + '"';

                    log.info("SQL 2.1");
                    log.info(sql);
                    connection.query(sql, installationUniqueId, (err, rows) => {
                        log.info("SQL 2.1.0");
                        if (err) {
                            return res.status(500).json({
                                error: 'Database error'
                            });
                        }
                        log.info("2.2");
                        log.info(rows);
                        if (rows.length > 0) {
                            // some agreements where in place for this user and counterparty

                            // get request
                            const rawDataRequest = req.get('X_HTTP_CYBOTIX_DATA_REQUEST');
                            log.debug("rawDataRequest: " + rawDataRequest);
                            const dataRequest = JSON.parse(base642str(rawDataRequest));
                            for (let j = 0; j < dataRequest.requests.length; j++) {
                                // is this request covered ?
                                const data_ask = JSON.stringify(dataRequest.requests[j]);
                                log.debug("data_ask: " + data_ask);
                                for (let i = 0; i < rows.length; i++) {
                                    const result = rows[i];
                                    log.info("check if this agreement covers the request");
                                    log.info(result);
                                    // get the datagrant from the database
                                    const data_grants = result.data_grants;
                                    const current_datagrant = JSON.stringify(JSON.parse(data_grants));
                                    log.debug("current_datagrant: " + current_datagrant);
                                    // check if this agreement covers the request
                                    if (current_datagrant.includes(data_ask)) {
                                        isCoveredByAgreement = true;
                                        // break out of the loop
                                        i = 100;
                                    }

                                }
                            }

                            log.info("2.4");

                            if (isCoveredByAgreement) {
                                log.info("active");
                                res.status(200).json({
                                    covered: 'true'
                                });
                            } else {
                                log.info("not active");
                                res.status(200).json({
                                    covered: 'false'
                                });
                            }
                        } else {
                            log.info("2.5");
                            log.info("not found");
                            res.status(200).json({
                                covered: 'false'
                            });
                        }
                        log.info("2.6");
                    });
                }).catch(function (err) {
                    log.info(err);
                });
            } else {
                log.info("an invalid installationUniqueId found in header");
            }
        } catch (err) {
            log.info(err);
        }
    });

    app.post('/plugin_user_validate_data_agreement', (req, res) => {
        log.info(req.method);
        log.info(req.rawHeaders);
        // Validate JSON against schema
        const valid = ajv.validate(plugin_user_validate_data_agreement_json_schema, req.body);

        if (!valid) {
            return res.status(400).json({
                error: 'Invalid data format'
            });
        }

        // delete from SQLite database
        const sql = 'SELECT active FROM data_agreements_tb WHERE browser_id = ? ';

        //  const sql = "DELETE FROM messages WHERE browser_id='" +req.body.browser_id+ "' AND id=" +req.body.id+ "";

        const values = [req.body.browser_id, req.body.id];
        log.info(sql);
        log.info(values);

        db.run(sql, values, function (err) {
            if (err) {
                return res.status(500).json({
                    error: 'Database error'
                });
            }
            res.status(201).json({
                status: 0
            });
        });
    });

    app.post('/plugin_user_delete_data_agreement', (req, res) => {
        log.info(req.method);
        log.info(req.rawHeaders);
        // Validate JSON against schema
        const valid = ajv.validate(plugin_user_delete_data_agreement_json_schema, req.body);

        if (!valid) {
            return res.status(400).json({
                error: 'Invalid data format'
            });
        }

        // delete from database
        const sql = 'DELETE FROM CybotixDB.data_agreements WHERE browser_id="' + installationUniqueId + '" AND uuid="' + req.body.uuid + '"';

        const values = [req.body.browser_id, req.body.uuid];
        log.info(sql);
        log.info(values);

        all_data_agreements_db.run(sql, values, function (err) {
            if (err) {
                return res.status(500).json({
                    error: 'Database error'
                });
            }
            res.status(201).json({
                status: 0
            });
        });
    });

    app.post('/plugin_user_read_all_data_agreements', (req, res) => {
        //  log.info(req.method);
        //  log.info(req.rawHeaders);
        //  log.info(req.body);
        // Validate JSON against schema
        const valid = ajv.validate(plugin_user_read_all_agreements_json_schema, req.body);

        if (!valid) {
            return res.status(400).json({
                error: 'Invalid data format'
            });
        }

        // Read from SQLite database
        const browser_id = [req.body.browser_id];
        const sql = 'SELECT * FROM all_data_agreements WHERE browser_id = ? ';
        all_data_agreements_db.all(sql, browser_id, (err, rows) => {
            if (err) {
                return res.status(500).json({
                    error: 'Database error'
                });
            }
            // log.info(rows);
            if (rows.length > 0) {
                log.info(rows)
                res.status(200).json(rows);
            } else {
                res.status(404).json({
                    error: 'Message not found'
                });
            }
        });
    });

}

/*return the payload of a validated token, or nothing*/
function getValidPlatformToken(token) {
    log.info("getValidPlatformToken");
    log.info(token);
    return new Promise(function (resolve, reject) {
        const parts = token.replace(/-/g, '+').replace(/_/g, '/').split('.');
        if (parts.length !== 3) {
            //throw new Error('Invalid token format');
            log.info('Invalid token format');
        } else {

            parseJWTbypassSignCheck(token, "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzNDQRPGUPmpUj3K7D0LoucRrCuAwLLD7B0i9iOfJLXps9lN05+bL8H24eVGwb8UO+Ip+2GQrLlPoErvuqqftv9heKQ9C6P3dNPFHsgcJqLIT2qYOWRXqceKdV5VshGzVRdS7v+/giWn4uTkEFskor9JZJFnxredZyOK7Buc/WvU1yt40FQum1/mpCPCmKcqulBib93PpwlXkjyZfbmQHG5QQ/DSg2bE607SrXc0vRYhrHfiuncSbfkKaxPA4C/YQr/4QbyX1Hm/IzKrToaWwghjF0uP0VWVlHJ1xfyGlxQvPllQpa6t7FuBx3N9xJ1OEsGRo4gS7ctiogHVwh1M5oQIDAQAB")
            .then(function (payload) {

                return validatePlatformToken(payload);
            }).then(function (data) {
                platformtokencontent = data;
                log.info(platformtokencontent);
                resolve(platformtokencontent);

            }).catch(function (err) {
                log.info(err);
                reject();
            });
        }
    });
}

function parseJWTbypassSignCheck(token, publicKeyPEM) {
    log.info("parseJWTbypassSignCheck");
    // log.info(token);
    const parts = token.replace(/-/g, '+').replace(/_/g, '/').split('.');
    if (parts.length !== 3) {
        //throw new Error('Invalid token format');
        log.info('Invalid token format');
    }

    return new Promise(function (resolve, reject) {

        // bypass this pending work on JWKs
        resolve(JSON.parse(base642str(parts[1].replace(/-/g, '+').replace(/_/g, '/'))));

    });
}

function base642str(data) {
    let buff = new Buffer(data, 'base64');
    let text = buff.toString('ascii');
    return text;
}

function validatePlatformToken(tokenPayload) {
    log.info("validatePlatformToken");
    // chect validy time

    // check issuer
    // check for revocation
    log.debug(tokenPayload);

    return new Promise(function (resolve, reject) {

        const aud = tokenPayload.aud;

        log.debug(aud);

        log.debug(keyExists(tokenPayload.aud, valid_audience_values));

        log.debug(tokenPayload);

        // check audience
        if (keyExists(tokenPayload.aud, valid_audience_values)) {

            resolve(tokenPayload);
        } else {
            reject("invalid audience");
        }

    });

}

function keyExists(key, obj) {
    return obj[key] !== undefined;
}
