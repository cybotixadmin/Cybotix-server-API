
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
                console.log("a valid installationUniqueId found in header (" + installationUniqueId + ")");
            } else {
                console.log("an invalid installationUniqueId found in header");

            }

        } catch (err) {
            console.log(err);

        }
        console.log("adding agreement");
        console.log(JSON.stringify(req.body));

        // generate agreement id

        const uuid = crypto.randomUUID()

            // var data_grants = req.body.data_grants;
            // console.debug(data_grants)
            // console.debug(JSON.stringify(data_grants))

            var original_request;
        try {
            original_request = JSON.stringify(req.body.original_request);
        } catch (err) {}
        //json.uuid = uuid;

        // use the data_grants field to contain more easily searchable specifics about the access granted.
        var data_grants;
        try {
            console.debug("data grants")
            //console.debug(req.body.data_grants);
            data_grants = JSON.stringify(req.body.data_grants);
            //console.debug(req.body.original_request.requests[0]);
            console.debug(data_grants);
            //          console.debug(data_grants === "undefined");


            //data_grants = '{"data_grants":'+JSON.stringify(data_grants) + '}';
        } catch (err) {}

        console.debug(original_request);
        //       const sql = 'INSERT INTO Cybotix.data_agreements_tb ( browser_id, uuid, createtime, lastmodifiedtime, json ) VALUES (?,?,?,?,?)';
        const utc = new Date().toISOString();
        //const values = [req.body.browser_id ,uuid , req.body.agreement_json.createtime , utc  , JSON.stringify(json)];
        //console.log(values);
        var sql;
        //  if (data_grants === "undefined"){
        //    sql = 'INSERT INTO CybotixDB.data_agreements_tb ( browserid, uuid, createtime, lastmodifiedtime,active,  original_request ) VALUES("'+installationUniqueId+'","'+uuid+'", now(), now(),1,' + "'"+ original_request+ "'"+')';
        //  }else{
        sql = 'INSERT INTO CybotixDB.data_agreements_tb ( browserid, uuid, createtime, lastmodifiedtime,active, data_grants, original_request ) VALUES("' + installationUniqueId + '","' + uuid + '", now(), now(),1, ' + "'" + data_grants + "','" + original_request + "'" + ')';
        //  }

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
                res.status(200).json('{"added:"' + result.affectedRows + "}");
            } else {
                res.status(404).json({});
            }
        });
    });

    app.get('/plugin_user_check_request_against_data_agreements', (req, res) => {
        console.log(req.method);
        console.log(req.rawHeaders);

        var isCoveredByAgreement = false;
        var installationUniqueId = "";
        try {

            if (regExpValidInstallationUniqueId.test(req.header("installationUniqueId"))) {
                installationUniqueId = req.header("installationUniqueId");
                console.log("a valid installationUniqueId found in header (" + installationUniqueId + ")");

                const rawPlatformToken = req.get('X_HTTP_CYBOTIX_PLATFORM_TOKEN');
                getValidPlatformToken(rawPlatformToken).then(function (data) {
                    console.log(data);

                    // lookup the ID from the platform token agains this users agreements in the database
                    const counterparty_id = data.sub;
                    console.debug("counterparty_id: " + counterparty_id);

                    //
                    const sql = 'SELECT * FROM CybotixDB.data_agreements_tb WHERE counterparty_id = "' + counterparty_id + '" AND browserid = "' + installationUniqueId + '"';

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
                            console.debug("rawDataRequest: " + rawDataRequest);
                            const dataRequest = JSON.parse(base642str(rawDataRequest));
                            for (let j = 0; j < dataRequest.requests.length; j++) {
                                // is this request covered ?
                                const data_ask = JSON.stringify(dataRequest.requests[j]);
                                console.debug("data_ask: " + data_ask);
                                for (let i = 0; i < rows.length; i++) {
                                    const result = rows[i];
                                    console.log("check if this agreement covers the request");
                                    console.log(result);
                                    // get the datagrant from the database
                                    const data_grants = result.data_grants;
                                    const current_datagrant = JSON.stringify(JSON.parse(data_grants));
                                    console.debug("current_datagrant: " + current_datagrant);
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
        console.log(req.method);
        console.log(req.rawHeaders);
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
        console.log(sql);
        console.log(values);

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
        console.log(req.method);
        console.log(req.rawHeaders);
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
        console.log(sql);
        console.log(values);

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
        //  console.log(req.method);
        //  console.log(req.rawHeaders);
        //  console.log(req.body);
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
            // console.log(rows);
            if (rows.length > 0) {
                console.log(rows)
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
        resolve(JSON.parse(base642str(parts[1].replace(/-/g, '+').replace(/_/g, '/'))));

    });
}

function base642str(data) {
    let buff = new Buffer(data, 'base64');
    let text = buff.toString('ascii');
    return text;
}

function validatePlatformToken(tokenPayload) {
    console.log("validatePlatformToken");
    // chect validy time

    // check issuer
    // check for revocation
    console.debug(tokenPayload);

    return new Promise(function (resolve, reject) {

        const aud = tokenPayload.aud;

        console.debug(aud);

        console.debug(keyExists(tokenPayload.aud, valid_audience_values));

        console.debug(tokenPayload);

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
