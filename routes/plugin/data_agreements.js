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
const e = require('express');
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
            console.log("counterparty_id: " + counterparty_id);

            // generate uniqueagreement id

            const uuid = crypto.randomUUID()

                // var data_grants = req.body.data_grants;
                // console.log(data_grants)
                // console.log(JSON.stringify(data_grants))

                var original_request;
            try {
                original_request = JSON.stringify(req.body.original_request);
            } catch (err) {}
            //json.uuid = uuid;

            // use the data_grants field to contain more easily searchable specifics about the access granted.
            var data_grants;
            try {
                console.log("data grants")
                //console.log(req.body.data_grants);
                data_grants = JSON.stringify(req.body.data_grants);
                //console.log(req.body.original_request.requests[0]);
                console.log(data_grants);
                //          console.log(data_grants === "undefined");


                //data_grants = '{"data_grants":'+JSON.stringify(data_grants) + '}';
            } catch (err) {}

            console.log(original_request);
            //       const sql = 'INSERT INTO Cybotix.data_agreements_tb ( browser_id, uuid, createtime, lastmodifiedtime, json ) VALUES (?,?,?,?,?)';
            const utc = new Date().toISOString();

            var sql = 'INSERT INTO ' + agreements_table + ' ( browserid, uuid, counterparty_id, createtime, lastmodifiedtime, active, data_grants, original_request, environment ) VALUES("' + installationUniqueId + '","' + uuid + '","' + counterparty_id + '", now(), now(),1, ' + "'" + data_grants + "','" + original_request + "','" + environment + "'" + ')';

            console.log("SQL 2");
            console.log(sql);

            connection.query(sql, function (err, result) {
                //db.all(sql, values, (err, rows) => {
                if (err) {
                    console.log(err);
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
                    console.log("counterparty_id: " + counterparty_id);

                    // look for active agreements in the database
                    const sql = 'SELECT data_grants FROM ' + agreements_table + ' WHERE environment="' + environment + '" AND (expiretime IS NULL OR expiretime > now()) AND active="1" AND counterparty_id = "' + counterparty_id + '" AND browserid = "' + installationUniqueId + '"';

                    // Assemble a list of all the data_grants from the active agreements
                    // in the form of one long string
                    console.log("SQL 2.1");
                    console.log(sql);
                    connection.query(sql, installationUniqueId, (err, rows) => {
                        console.log("SQL 2.1.0");
                        if (err) {
                            console.log(err);
                            return res.status(500).json({
                                error: 'Database error'
                            });
                        }
                        console.log("2.2");
                        console.log(rows);
                        var existing_data_grants = [];
                        if (rows.length > 0) {
                            for (let m = 0; m < rows.length; m++) {
                                console.log("2.3.1");
                                console.log(existing_data_grants);
                                console.log("2.3.2");
                                // console.log(rows[m]);
                                console.log("2.3.3");
                                console.log(JSON.parse(rows[m].data_grants));
                                console.log("2.3.4");

                                const temp = existing_data_grants.concat(JSON.parse(rows[m].data_grants));
                                console.log(temp);
                                console.log("2.3.5");
                                existing_data_grants = temp;
                                console.log(existing_data_grants);
                            }
                            console.log("existing_data_grants");
                            console.log(existing_data_grants);

                            // some agreements where in place for this user and counterparty
                            console.log("rows: " + JSON.stringify(rows));
                            // reject the request if any part of it is not covered by an agreement
                            // get request
                            const rawDataRequest = req.get('X_HTTP_CYBOTIX_DATA_REQUEST');
                            console.log("rawDataRequest: " + rawDataRequest);
                            // Iterate through each "ask" in the data request
                            // "Fail" the request if any part of it is not covered by an agreement
                            // const res = findCommonItems(arrayOld, arrayNew);
                            const dataRequests = (JSON.parse(base64decode(rawDataRequest))).requests;

                            console.log("1.dataRequests: " + JSON.stringify(dataRequests));

                            // check each request against the grants returned from the database to check if is this request covered ?
                            const overlap = compareArrayObjects(existing_data_grants, dataRequests);
                            console.log("overlap: " + overlap);
                            console.log("overlap: " + JSON.stringify(overlap));
                            if (overlap) {
                                isCoveredByAgreement = false;
                            } else {
                                isCoveredByAgreement = true;
                            }
                            console.log("isCoveredByAgreement: " + isCoveredByAgreement);

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

        const sql = "SELECT active FROM " + agreements_table + " WHERE environment='" + environment + "' AND browser_id = '" + installationUniqueId + "'";

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

function compareValues2(value1, value2) {
    console.log("compareValues");
    // If both values are objects, we delegate the comparison to compareObjects
    if (typeof value1 === 'object' && typeof value2 === 'object') {
        return compareObjects(value1, value2);
    }
    // Direct comparison for primitives
    return value1 === value2;
}

function compareValues(value1, value2) {
    console.log("compareValues:");
    console.log("value1: " + value1);
    console.log("value2: " + value2);

    // When the values are strings and look like regex patterns, we treat them specially
    if (typeof value1 === 'string' && typeof value2 === 'string') {
        try {
            // Test if one regex is a subset of another by checking a sample string
            let testString = 'The quick brown fox jumps over the lazy dog'; // Sample string for regex test
            let regex1 = new RegExp(value1);
            let grantedR
            egex = new RegExp(value2);

            // If both regex patterns match the same set of strings, consider them equal
            return regex1.test(testString) === grantedR
            egex.test(testString);
        } catch (e) {
            // If regex construction failed, fall back to normal comparison
            return value1 === value2;
        }
    } else {
        // For non-string or non-regex patterns, use strict equality
        return value1 === value2;
    }
}

function compareObjects(requestObj, grantedObj) {
    // count number of keys in each object and if different, return false
    const keys1 = Object.keys(requestObj);
    const keys2 = Object.keys(grantedObj);

    if (keys1.length !== keys2.length) {
        return false;
    }

    // do a string string comparison as a quick check
    if (JSON.stringify(requestObj) === JSON.stringify(grantedObj)) {
        return true;
    } else {
        console.log("grant string comparison failed");
    }

    console.log("1 req: " + requestObj);
    console.log("1 req: " + JSON.stringify(requestObj));

    console.log("1 requested: " + requestObj.requesttype);
    console.log("2 granted: " + grantedObj.requesttype);
    if (requestObj.requesttype != grantedObj.requesttype) {
        return false;
    } else {
        console.log("requesttype match");
    }
    console.log("1: " + JSON.stringify(requestObj.requestdetails));
    console.log("2: " + JSON.stringify(grantedObj.requestdetails));

    if (JSON.stringify(requestObj.requestdetails) === JSON.stringify(grantedObj.requestdetails)) {
        return true;
    } else {
        console.log("grant details string comparison failed");
    }

    console.log("requestObj.requestdetails" + JSON.stringify(requestObj.requestdetails));
    console.log("grantedObj.requestdetails" + JSON.stringify(grantedObj.requestdetails));

    const res = compareFilters(requestObj.requestdetails, grantedObj.requestdetails);
    console.log("res: " + res);

    return res;

    for (let key of keys1) {
        if (!keys2.includes(key)) {
            return false;
        }

        // Special handling for the 'filter' key which contains regex patterns
        if (key === 'filter' && typeof requestObj[key] === 'string' && typeof grantedObj[key] === 'string') {
            // Use a custom comparison for regex patterns
            if (!compareValues(requestObj[key], grantedObj[key])) {
                return false;
            }
        } else if (!compareValues(requestObj[key], grantedObj[key])) {
            // For other keys or non-regex patterns, use regular comparison
            return false;
        }
    }

}

function compareFilters(requestObj, grantedObj) {
    // both objects in a request rule must match
    // if there is a time requirement, compare them here
    let timeComparison = isTimeInside(requestObj.time, grantedObj.time);
    console.log("timeComparison: " + timeComparison);

    // if there is a (text) filter, compare them here
    // comparing regex is non-trivial
    // For now, use the fact that ".*" will encompass all other regex patterns
    let regexComparison = areRegexesEqual(requestObj.filter, grantedObj.filter);
    console.log("regexComparison: " + regexComparison);

    return timeComparison && regexComparison;
}

function isTimeInside(requestTime, grantedTime) {
    console.log("isTimeInside");
    const starts_with_now = /^ *now/i;

    if (starts_with_now.test(requestTime) && starts_with_now.test(grantedTime)) {
        // Extract the number of hours from the time strings
        const getHours = timeString => parseInt(timeString.match(/now-(\d+)hr/)[1], 10);

        let requestedHours = getHours(requestTime);
        let grantedHours = getHours(grantedTime);
        console.log("requestedHours: " + requestedHours);
        console.log("grantedHours: " + grantedHours);
        console.log("is request within ? " + (grantedHours >= requestedHours))
        // Check if time2's hours fall within time1's range
        return grantedHours >= requestedHours;
    } else {
        // perform no other checks, simply reject this as being identical
        return false;
    }

}

function areRegexesEqual(reqRegex, grantedRegex) {
    // Compare two regex patterns as strings
    if (reqRegex === grantedRegex) {
        return true
    }
    // if ".* has been granted, it do not matter what is being requested"
    if (grantedRegex === ".*") {
        return true
    }
    // no further checking - though much more could be done
    return false;
}

function compareObjects2(obj1, obj2) {
    console.log("compareObjects");
    // Get keys of both objects
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    console.log("keysre1: " + obj1.request_type + "  " + JSON.stringify(keys1));
    console.log("keys2re: " + obj2.request_type + "  " + JSON.stringify(keys2));

    console.log("keys1: " + keys1 + "  " + JSON.stringify(keys1));
    console.log("keys2: " + keys2 + "  " + JSON.stringify(keys2));

    // If number of properties is different, objects are not identical
    if (keys1.length !== keys2.length) {
        // return false;
    }
    // compare request types
    console.log(!keys2.includes("request_type"));
    console.log(!compareValues(obj1["request_type"], obj2["request_type"]));

    if (!keys2.includes("request_type") || !compareValues(obj1["request_type"], obj2["request_type"])) {
        console.log("false");
        return false;
    }

    // for kind og attribute, there is a different kind of camparison required to check for logical subsets
    // Compare each key/value pair
    for (let key of keys1) {
        console.log("key: " + key);
        // check for logical subsets
        // i.e.
        // ".*" includes ".*test.*"
        //  "now()-4hr"   includes "now()-3hr"

        if (key.includes(".*")) {
            // request is a logical subset of grant
        }

        if (!keys2.includes(key) || !compareValues(obj1[key], obj2[key])) {
            return false;
        }
    }

    // If all keys and values are identical
    return true;
}

// Main function to compare two arrays of objects
function compareArrayObjects(grantedArr, requestedArray) {
    console.log("compareArrayObjects");
    console.log("compareArrayObjects.grantedArr " + JSON.stringify(grantedArr));
    console.log("compareArrayObjects.requestedArray " + JSON.stringify(requestedArray));

    const matchedItems = [];
    let allMatched = true;
    for (let requestedItem of requestedArray) {
        console.log("#\n#\n# requestedItem: " + JSON.stringify(requestedItem));
        let matchFound = false;

        for (let grantedItem of grantedArr) {
            console.log("###\n###\n### checking against grantedItem: " + JSON.stringify(grantedItem));

            if (compareObjects(requestedItem, grantedItem)) {
                console.log("this request is covered by a grant: " + JSON.stringify(requestedItem));
                matchFound = true;

            } else {
                console.log("this request is NOT covered by a grant: " + JSON.stringify(requestedItem));
                //break; // No need to check the rest of the old array if we found a non-match
            }
        }

        if (matchFound) {
            matchedItems.push(requestedItem); // newItem is in arrayOld
        } else {
            allMatched = false; // Not all newItem are found in arrayOld
        }
    }

    // If all items were matched, return false, else return the matched items
    return allMatched ? false : {
        matchedItems
    };
}

function findCommonItems(arrayOld, arrayNew) {
    console.log("findCommonItems");
    const commonItems = arrayNew.filter(itemNew => arrayOld.some(itemOld => compareObjects(itemNew, itemOld)));

    // Check if we found any common items
    if (commonItems.length === 0) {
        return false;
    }

    // Return the common items in a JSON object
    return {
        commonItems: commonItems
    };
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
    console.log(tokenPayload);

    return new Promise(function (resolve, reject) {

        const aud = tokenPayload.aud;

        console.log(aud);

        console.log(keyExists(tokenPayload.aud, valid_audience_values));

        console.log(tokenPayload);

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
