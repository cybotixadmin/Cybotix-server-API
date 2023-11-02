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

// Read the configuration file once and store the data in memory
const configFile = fs.readFileSync('./config.json');
const config = JSON.parse(configFile);

const defaultdb = config.database.database_name;

const agreements_table = config.database.agreements_table;
const environment = config.environment;

const valid_audience_values = {
    "cybotix-personal-data-commander": "1",
    "Cybotix": "1"
};

const regExpValidInstallationUniqueId = new RegExp(/^[a-zA-Z0-9_\.\-]{10,60}$/);

const bunyan = require('bunyan');
var RotatingFileStream = require('bunyan-rotating-file-stream');
// Create a logger instance
const log = bunyan.createLogger({
        name: 'apiapp', // Name of the application
        streams: [{
                stream: new RotatingFileStream({
                    type: 'rotating-file',
                    path: './logs/server-data_agreements-%Y%m%d.log',
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

    const plugin_user_set_agreement_active_status_json_schema = {
        type: "object",
        properties: {
            agreement_id: {
                type: 'string',
                "pattern": "^[A-Za-z0-9\-\_\.]{10,100}$",
                "minLength": 10,
                "maxLength": 100
            },
            activestatus: {
                type: 'string',
                "pattern": "^[01]$",
                "minLength": 0,
                "maxLength": 1
            }
        },
        required: ['agreement_id', 'activestatus'],
    };

    const plugin_user_delete_data_agreement_json_schema = {
        type: "object",
        properties: {
            agreement_id: {
                type: 'string',
                "pattern": "^[A-Za-z0-9\.\-\_]{4,60}$",
                "minLength": 4,
                "maxLength": 60
            }
        },
        required: ['agreement_id'],
    };

    const plugin_user_read_data_agreement_json_schema = {
        type: "object",
        properties: {
            agreement_id: {
                type: 'string',
                "pattern": "^[A-Za-z0-9\.\-_]{4,60}$",
                "minLength": 4,
                "maxLength": 60
            }
        },
        required: ['agreement_id'],
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
        var installationUniqueId = getInstallationUniqueId(req.header("installationUniqueId"));

        if (!installationUniqueId) {
            return res.status(400).json({
                error: 'Invalid installationUniqueId'
            });
        }
        console.log("adding agreement");
        console.log(JSON.stringify(req.body));

        // get infor  on counter party from platformtoken
        var counterparty_id;
        const rawPlatformToken = req.body.platformtoken;
        getValidPlatformToken(rawPlatformToken).then(function (data) {
            console.log(data);
            counterparty_id = data.sub;
            log.debug("counterparty_id: " + counterparty_id);

            // generate uniqueagreement id

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

            var sql = 'INSERT INTO ' + agreements_table + ' ( browserid, uuid, counterparty_id, createtime, lastmodifiedtime, active, data_grants, original_request, environment ) VALUES("' + installationUniqueId + '","' + uuid + '","' + counterparty_id + '", now(), now(),1, ' + "'" + data_grants + "','" + original_request + "','" + environment + "'" + ')';

            console.log("SQL 2");
            console.log(sql);

            connection.query(sql, function (err, result) {
                //db.all(sql, values, (err, rows) => {
                if (err) {
                    log.debug(err);
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
                    //res.status(200).json('{"added:"' + result.affectedRows + "}");
                    res.status(200).json({
                        added: result.affectedRows
                    });

                } else {
                    res.status(404).json({});
                }
            });
        });
    });

    app.get('/plugin_user_check_request_against_data_agreements', (req, res) => {
        console.log(req.method);
        console.log(req.rawHeaders);

        var isCoveredByAgreement = false;

        var installationUniqueId = getInstallationUniqueId(req.header("installationUniqueId"));

        if (!installationUniqueId) {
            return res.status(400).json({
                error: 'Invalid installationUniqueId'
            });
        }

        try {

            if (regExpValidInstallationUniqueId.test(req.header("installationUniqueId"))) {
                installationUniqueId = req.header("installationUniqueId");
                console.log("a valid installationUniqueId found in header (" + installationUniqueId + ")");

                const rawPlatformToken = req.get('X_HTTP_CYBOTIX_PLATFORM_TOKEN');
                getValidPlatformToken(rawPlatformToken).then(function (data) {
                    console.log(data);

                    // lookup the ID from the platform token agains this users agreements in the database
                    const counterparty_id = data.sub;
                    log.debug("counterparty_id: " + counterparty_id);

                    // look for active agreements in the database
                    const sql = 'SELECT * FROM ' + agreements_table + ' WHERE environment="' + environment + '" AND active="1" AND counterparty_id = "' + counterparty_id + '" AND browserid = "' + installationUniqueId + '"';

                    console.log("SQL 2.1");
                    console.log(sql);
                    connection.query(sql, installationUniqueId, (err, rows) => {
                        console.log("SQL 2.1.0");
                        if (err) {
                            return res.status(500).json({
                                error: 'Database error'
                            });
                        }
                        console.log("2.2");
                        console.log(rows);
                        if (rows.length > 0) {
                            // some agreements where in place for this user and counterparty

                            // get request
                            const rawDataRequest = req.get('X_HTTP_CYBOTIX_DATA_REQUEST');
                            log.debug("rawDataRequest: " + rawDataRequest);
                            const dataRequest = JSON.parse(base64decode(rawDataRequest));
                            for (let j = 0; j < dataRequest.requests.length; j++) {
                                // is this request covered ?
                                // this process must be consdiereably improved, checking the actual details individually
                                const data_ask = JSON.stringify(dataRequest.requests[j]);
                                log.debug("data_ask: " + data_ask);
                                for (let i = 0; i < rows.length; i++) {
                                    const result = rows[i];
                                    console.log("check if this agreement covers the request");
                                    console.log(result);
                                    console.log("data_grants");

                                    // get the datagrant from the database
                                    const data_grants = result.data_grants;
                                    console.log(data_grants);
                                    console.log("1.0");
                                    console.log(JSON.parse(data_grants));
                                    console.log("1.1");
                                    console.log(JSON.stringify(data_grants));
                                    console.log("1.3");
                                    console.log(data_grants[0]);
                                    console.log("1.2");
                                    console.log(data_grants[1]);

                                    console.log(isValidJSON(data_grants));
                                    // use a back-n-forth to get a normalized-stringified version of the data_grants
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

                            console.log("2.4");

                            if (isCoveredByAgreement) {
                                console.log("active");
                                res.status(200).json({
                                    covered: 'true'
                                });
                            } else {
                                console.log("not active");
                                res.status(200).json({
                                    covered: 'false'
                                });
                            }
                        } else {
                            console.log("2.5");
                            console.log("not found");
                            res.status(200).json({
                                covered: 'false'
                            });
                        }
                        console.log("2.6");
                    });
                }).catch(function (err) {
                    console.log(err);
                });
            } else {
                console.log("an invalid installationUniqueId found in header");
            }
        } catch (err) {
            console.log(err);
        }
    });

    app.post('/plugin_user_validate_data_agreement', (req, res) => {
        console.log("/plugin_user_validate_data_agreement");
        console.log(req.method);
        console.log(req.rawHeaders);

        var installationUniqueId = getInstallationUniqueId(req.header("installationUniqueId"));

        if (!installationUniqueId) {
            return res.status(400).json({
                error: 'Invalid installationUniqueId'
            });
        }
        // Validate JSON against schema
        const valid = ajv.validate(plugin_user_validate_data_agreement_json_schema, req.body);

        if (!valid) {
            return res.status(400).json({
                error: 'Invalid data format'
            });
        }

        
        const sql = "SELECT active FROM " + agreements_table + " WHERE environment='" + environment + "' AND browser_id = '"+installationUniqueId+"'";

        const values = [req.body.browser_id, req.body.id];
        console.log(sql);
        console.log(values);

        connection.query(sql, function (err, result) {
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

    app.post('/plugin_user_set_agreement_active_status', (req, res) => {
        console.log(req.method);
        console.log(req.rawHeaders);
        var installationUniqueId = getInstallationUniqueId(req.header("installationUniqueId"));

        if (!installationUniqueId) {
            return res.status(400).json({
                error: 'Invalid installationUniqueId'
            });
        }
        // Validate JSON against schema
        const valid = ajv.validate(plugin_user_set_agreement_active_status_json_schema, req.body);

        if (!valid) {
            return res.status(400).json({
                error: 'Invalid data format'
            });
        }

        // delete from database
        const sql = 'UPDATE ' + agreements_table + " SET active='" + req.body.activestatus + "' WHERE environment='" + environment + "' AND browserid='" + installationUniqueId + "' AND uuid='" + req.body.agreement_id + "'";
        console.log(sql);
        //   const values = [req.body.browser_id, req.body.uuid];
        // console.log(sql);
        //     console.log(values);

        connection.query(sql, function (err, result) {
            //       all_data_agreements_db.run(sql, values, function (err) {
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
        console.log('/plugin_user_delete_data_agreement');
        console.log(req.method);
        console.log(req.rawHeaders);
        console.log(req.body)
        var installationUniqueId = getInstallationUniqueId(req.header("installationUniqueId"));

        if (!installationUniqueId) {
            return res.status(400).json({
                error: 'Invalid installationUniqueId'
            });
        }

        // Validate JSON against schema
        const valid = ajv.validate(plugin_user_delete_data_agreement_json_schema, req.body);

        if (valid) {
            console.log('Invalid data format');
            return res.status(400).json({
                error: 'Invalid data format'
            });
        }

        // delete from database
        const sql = "DELETE FROM " + agreements_table + " WHERE environment='" + environment + "' AND browserid='" + installationUniqueId + "' AND uuid='" + req.body.agreement_id + "'";
        console.log(sql);

        connection.query(sql, function (err, result) {
            if (err) {
                console.log(err);
                return res.status(500).json({
                    error: 'Database error'
                });
            }
            res.status(201).json({
                status: 0
            });
        });
    });

    app.post('/plugin_user_read_data_agreement', (req, res) => {
        console.log(req.method);
        console.log(req.rawHeaders);
        var installationUniqueId = getInstallationUniqueId(req.header("installationUniqueId"));

        if (!installationUniqueId) {
            return res.status(400).json({
                error: 'Invalid installationUniqueId'
            });
        }
        // Validate JSON against schema
        const valid = ajv.validate(plugin_user_read_data_agreement_json_schema, req.body);

        if (!valid) {
            return res.status(400).json({
                error: 'Invalid data format'
            });
        }

        // delete from database
        const sql = "SELECT * FROM " + agreements_table + " WHERE environment='" + environment + "' AND browserid='" + installationUniqueId + "' AND uuid='" + req.body.agreement_id + "'";
        console.log(sql);

        connection.query(sql, function (err, result) {

            if (err) {
                return res.status(500).json({
                    error: 'Database error'
                });
            }
            // console.log(result);
            if (result.length > 0) {
                console.log(result)
                res.status(200).json(result);
            } else {
                res.status(404).json({
                    error: 'Message not found'
                });
            }
        });
    });

    app.get('/plugin_user_read_all_data_agreements', (req, res) => {
        try {
            console.log('/plugin_user_read_all_data_agreements');
            //  console.log(req.method);
            //  console.log(req.rawHeaders);
            //  console.log(req.body);
            // Validate JSON against schema
            var installationUniqueId = getInstallationUniqueId(req.header("installationUniqueId"));

            if (!installationUniqueId) {
                return res.status(400).json({
                    error: 'Invalid installationUniqueId'
                });
            }

            const sql = 'SELECT userid, browserid, createtime, lastmodifiedtime, counterparty_name, uuid, active, counterparty_id, data_grants, original_request FROM ' + agreements_table + " WHERE environment='" + environment + "' AND browserid = '" + installationUniqueId + "' ORDER BY lastmodifiedtime DESC";
            console.log(sql);
            //        all_data_agreements_db.all(sql, browser_id, (err, rows) => {
            connection.query(sql, function (err, result) {

                if (err) {
                    return res.status(500).json({
                        error: 'Database error'
                    });
                }
                // console.log(result);
                if (result.length > 0) {
                    console.log(result)
                    res.status(200).json(result);
                } else {
                    res.status(404).json({
                        error: 'Message not found'
                    });
                }
            });
        } catch (err) {
            console.log(err);
        }
    });

}

/*return the payload of a validated token, or nothing*/
function getValidPlatformToken(token) {
    console.log("getValidPlatformToken");
    console.log(token);
    return new Promise(function (resolve, reject) {
        const parts = token.replace(/-/g, '+').replace(/_/g, '/').split('.');
        if (parts.length !== 3) {
            //throw new Error('Invalid token format');
            console.log('Invalid token format');
        } else {

            parseJWTbypassSignCheck(token, "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzNDQRPGUPmpUj3K7D0LoucRrCuAwLLD7B0i9iOfJLXps9lN05+bL8H24eVGwb8UO+Ip+2GQrLlPoErvuqqftv9heKQ9C6P3dNPFHsgcJqLIT2qYOWRXqceKdV5VshGzVRdS7v+/giWn4uTkEFskor9JZJFnxredZyOK7Buc/WvU1yt40FQum1/mpCPCmKcqulBib93PpwlXkjyZfbmQHG5QQ/DSg2bE607SrXc0vRYhrHfiuncSbfkKaxPA4C/YQr/4QbyX1Hm/IzKrToaWwghjF0uP0VWVlHJ1xfyGlxQvPllQpa6t7FuBx3N9xJ1OEsGRo4gS7ctiogHVwh1M5oQIDAQAB")
            .then(function (payload) {

                return validatePlatformToken(payload);
            }).then(function (data) {
                platformtokencontent = data;
                console.log(platformtokencontent);
                resolve(platformtokencontent);

            }).catch(function (err) {
                console.log(err);
                reject();
            });
        }
    });
}

function isValidJSON(jsonString) {
    try {
        JSON.parse(jsonString);
        return true;
    } catch (e) {
        return false;
    }
}

function parseJWTbypassSignCheck(token, publicKeyPEM) {
    console.log("parseJWTbypassSignCheck");
    // console.log(token);
    const parts = token.replace(/-/g, '+').replace(/_/g, '/').split('.');
    if (parts.length !== 3) {
        //throw new Error('Invalid token format');
        console.log('Invalid token format');
    }

    return new Promise(function (resolve, reject) {

        // bypass this pending work on JWKs
        resolve(JSON.parse(base64decode(parts[1].replace(/-/g, '+').replace(/_/g, '/'))));

    });
}

function base642str(data) {
    let buff = new Buffer(data, 'base64');
    let text = buff.toString('ascii');
    return text;
}

function base64decode(data) {
    return atob(data);
}

function base64encode(str) {
    return btoa(str);
}

function validatePlatformToken(tokenPayload) {
    console.log("validatePlatformToken");
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

function getInstallationUniqueId(text) {

    try {

        if (regExpValidInstallationUniqueId.test(text)) {
            installationUniqueId = text;
            console.log("a valid installationUniqueId found in header (" + installationUniqueId + ")");
            return installationUniqueId;
        } else {
            console.log("an invalid installationUniqueId found in header");
            return false;
        }

    } catch (err) {
        console.log(err);
        return false;
    }
}
