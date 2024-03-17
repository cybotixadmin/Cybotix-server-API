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

const clickdata_table = config.database.clickdata_table;
const environment = config.environment;

const regExpValidInstallationUniqueId = new RegExp(/^[a-zA-Z0-9_\.\-]{10,60}$/);

const bunyan = require('bunyan');
var RotatingFileStream = require('bunyan-rotating-file-stream');
// Create a logger instance
const log = bunyan.createLogger({
        name: 'apiapp', // Name of the application
        streams: [{
                stream: new RotatingFileStream({
                    type: 'rotating-file',
                    path: './logs/server-click_data-%Y%m%d.log',
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
    const plugin_user_post_click_json_schema = {
        type: 'object',
        properties: {
            content: {
                type: 'string',
                "minLength": 2,
                "maxLength": 30
            },
            local_time: {
                type: 'string',
                "pattern": "^[A-Za-z0-9\-_\. :]{8,30}$",
                "minLength": 8,
                "maxLength": 30
            },
            expiration: {
                type: 'string',
                "pattern": "^[A-Za-z0-9\-_\. :]{8,30}$",
                "minLength": 8,
                "maxLength": 30
            },
            url: {
                type: 'string',
                "minLength": 1,
                "maxLength": 1000
            }
        },
        required: ['url', 'local_time'],
    };

    const plugin_user_delete_clicks_json_schema = {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "linkid": {
                    "type": "string",
                    "minLength": 8,
                "maxLength": 30
                }
            },
            "required": ["linkid"],
            "additionalProperties": false
        },
        "minItems": 1,
        "maxItems": 20,
        "uniqueItems": true
    };

    const plugin_user_get_all_clicks_json_schema = {
        type: "object",
        properties: {
            pattern: {
                type: 'string',
                "minLength": 0,
                "maxLength": 300
            }
        },
        required: [],
    };

    const plugin_user_set_clickdata_lifetime_json_schema = {
        type: "object",
        properties: {
            days: {
                "type": "number",
                "minimum": 0,
                "maximum": 100

            },
            hours: {
                "type": "number",
                "minimum": 0,
                "maximum": 100

            }
        },
        required: ['days', 'hours'],
    };

    const plugin_user_delete_click_json_schema = {
        type: "object",
        properties: {
            linkid: {
                type: 'string',
                "pattern": "^[A-Za-z0-9\-\_\.]{10,100}$",
                "minLength": 1,
                "maxLength": 100
            }
        },
        required: ['linkid'],
    };

    
    const plugin_user_delete_expired_clickdata_json_schema = {
        type: "object",
        properties: {
            local_time: {
                type: 'string',
                "pattern": "^[A-Za-z0-9\-\_\. :]{10,30}$",
                "minLength": 1,
                "maxLength": 30
            }
        },
        required: ['local_time'],
    };


    const ajv = new Ajv();


    // delete one click history item
    app.post('/plugin_user_delete_click', (req, res) => {
        try {
            log.info('/plugin_user_delete_click');

            // Validate JSON against schema
            var installationUniqueId = "";

            if (regExpValidInstallationUniqueId.test(req.header("installationUniqueId"))) {
                installationUniqueId = req.header("installationUniqueId");
                log.info("a valid installationUniqueId found in header (" + installationUniqueId + ")");
            } else {
                log.info("an invalid installationUniqueId found in header");

            }

            const valid = ajv.validate(plugin_user_delete_click_json_schema, req.body);

            if (!valid) {
                return res.status(400).json({
                    error: 'Invalid data format'
                });
            }

            // delete from databasen
            const sql = 'DELETE FROM ' + clickdata_table + ' WHERE environment="' + environment + '" AND browserid="' + installationUniqueId + '" AND linkid="' + req.body.linkid + '"';

            console.log(sql);

            connection.query(sql, function (err, result) {

                if (err) {
                    log.debug(err);
                    return res.status(500).json({
                        error: 'Database error'
                    });
                }

                if (result.affectedRows > 0) {
                    log.info("affectedRows: " + result.affectedRows)
                    res.status(200).json('{"added:"' + result.affectedRows + "}");
                } else {
                    res.status(404).json({});
                }
            });
        } catch (err) {
            log.info(err);

        }

    });

    app.post('/plugin_user_set_clickdata_lifetime', (req, res) => {
        console.debug("/plugin_user_set_clickdata_lifetime");
        try {
            console.log(req.method);
            console.log(req.rawHeaders);
            log.debug(req.body);
            var installationUniqueId = getInstallationUniqueId(req.header("installationUniqueId"));

            if (!installationUniqueId) {
                return res.status(400).json({
                    error: 'Invalid installationUniqueId'
                });
            }
            // Validate JSON against schema
            const valid = ajv.validate(plugin_user_set_clickdata_lifetime_json_schema, req.body);

            if (!valid) {

                return res.status(400).json({
                    error: 'Invalid data format'
                });
            }

                const utc = new Date().toISOString();
            const sql = 'UPDATE  ' + clickdata_table + ' SET expiration =  DATE_ADD(DATE_ADD(utc, INTERVAL '+req.body.days+' DAY), INTERVAL '+req.body.hours+' HOUR) '  + ' WHERE environment="' + environment + '" AND browserid="' + installationUniqueId + '"';


            console.log("SQL update expiration");
            console.log(sql);

            connection.query(sql, function (err, result) {
                if (err) {
                    console.debug(err);
                    return res.status(500).json({
                        error: 'Database error'
                    });
                }

                if (result.affectedRows > 0) {
                    log.info("affectedRows: " + result.affectedRows)
                    res.status(200).json('{"added:"' + result.affectedRows + "}");
                } else {
                    res.status(404).json({});
                }
            });
        } catch (err) {
            console.debug(err);
        }
    });

    app.post('/plugin_user_post_click', (req, res) => {
        console.debug("/plugin_user_post_click");
        try {
            console.log(req.method);
            console.log(req.rawHeaders);
            log.debug(req.body);
            var installationUniqueId = getInstallationUniqueId(req.header("installationUniqueId"));

            if (!installationUniqueId) {
                return res.status(400).json({
                    error: 'Invalid installationUniqueId'
                });
            }
            // Validate JSON against schema
            const valid = ajv.validate(plugin_user_post_click_json_schema, req.body);

            if (!valid) {
                return res.status(400).json({
                    error: 'Invalid data format'
                });
            }
            
var local_time = req.body.local_time;
var expiration = req.body.expiration;

            // generate unique note id
            const linkid = crypto.randomUUID()

                const utc = new Date().toISOString();
            const sql = 'INSERT INTO ' + clickdata_table + ' (environment, url, browserid,linkid, utc, local_time, expiration) VALUES ("' + environment + '", "' + req.body.url + '", "' + installationUniqueId + '", "' + linkid + '", now(), "'+local_time.replace(/\.[0-9]{3}Z$/,"") +'", "'+expiration.replace(/\.[0-9]{3}Z$/,"")+'" )';

            console.log("SQL 1.0.2");
            console.log(sql);

            connection.query(sql, function (err, result) {
                if (err) {
                    console.debug(err);
                    return res.status(500).json({
                        error: 'Database error'
                    });
                }

                if (result.affectedRows > 0) {
                    log.info("affectedRows: " + result.affectedRows)
                    res.status(200).json('{"added:"' + result.affectedRows + "}");
                } else {
                    res.status(404).json({});
                }
            });
        } catch (err) {
            console.debug(err);
        }
    });

    // bulk delete one click history item
    app.post('/plugin_user_delete_clicks', (req, res) => {
        console.log('/plugin_user_delete_clicks');
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
        const valid = ajv.validate(plugin_user_delete_clicks_json_schema, req.body);

        if (valid) {
            console.log('Invalid data format');
            return res.status(200).json({
                error: 'Invalid data format'
            });
        }

        const commaSeparatedList = req.body.map(item => `'${item.linkid}'`).join(', ');

        // delete from database
        const sql = "DELETE FROM " + clickdata_table + " WHERE environment='" + environment + "' AND browserid='" + installationUniqueId + "' AND linkid IN (" + commaSeparatedList + ")";
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


    
    app.get('/plugin_user_delete_all_clickdata', (req, res) => {
        try {
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

             // delete from database
 const sql = "DELETE FROM " + clickdata_table + " WHERE environment='" + environment + "' AND browserid='" + installationUniqueId + "' ";
 console.log(sql);

 connection.query(sql, function (err, result) {
    connection.query(sql, function (err, result) {
        if (err) {
            console.debug(err);
            return res.status(500).json({
                error: 'Database error'
            });
        }

        if (result.affectedRows > 0) {
            log.info("affectedRows: " + result.affectedRows)
            res.status(200).json('{"added:"' + result.affectedRows + "}");
        } else {
            res.status(404).json({});
        }
    });
 });


        } catch (err) {
            console.log(err);
            log.info(err);
        }
    });
    app.post('/plugin_user_delete_expired_clickdata', (req, res) => {
        try {
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


            
   // Validate JSON against schema
   const valid = ajv.validate(plugin_user_delete_expired_clickdata_json_schema, req.body);

   if (!valid) {
       return res.status(400).json({
           error: 'Invalid data format'
       });
   }

 // delete from database
 const sql = "DELETE FROM " + clickdata_table + " WHERE environment='" + environment + "' AND browserid='" + installationUniqueId + "' AND expiration < '" + req.body.local_time + "'";
 console.log(sql);

 connection.query(sql, function (err, result) {
    connection.query(sql, function (err, result) {
        if (err) {
            console.debug(err);
            return res.status(500).json({
                error: 'Database error'
            });
        }

        if (result.affectedRows > 0) {
            log.info("affectedRows: " + result.affectedRows)
            res.status(200).json('{"added:"' + result.affectedRows + "}");
        } else {
            res.status(404).json({});
        }
    });
 });


        } catch (err) {
            console.log(err);
            log.info(err);
        }
    });
    app.get('/plugin_user_get_all_clicks', (req, res) => {
        try {
            log.info(req.method);
            // Validate JSON against schema
            const valid = ajv.validate(plugin_user_get_all_clicks_json_schema, req.body);

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

           

            // TO BE IMPLEMENTED, using the option regexp pattern
            // at present all data is returned
            // Read from database
            const sql = 'SELECT linkid, utc, local_time, url, expiration FROM ' + clickdata_table + ' WHERE environment="' + environment + '" AND ( expiration >=now() OR expiration IS NULL ) AND browserid = "' + installationUniqueId + '" ';
            log.info(sql);
            console.log(sql)
            connection.query(sql, installationUniqueId, (err, rows) => {
                if (err) {
                    console.log(err);
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
        } catch (err) {
            console.log(err);
            log.info(err);
        }
    });
}

function isPlatformTokenRawStructureValid(token) {
    console.debug("isPlatformTokenStructureValid");
    const regExpValidPlatformToken = new RegExp(/^[a-zA-Z0-9_\.\-_=]{100,2000}$/);
    if (regExpValidPlatformToken.test(token)) {
        return true
    } else {
        return false;
    }
}

function isDataAccessTokenRawStructureValid(platform_token_payload, token) {
    console.debug("isDataAccessTokenStructureValid");
    const regExpValidDataAccessToken = new RegExp(/^[a-zA-Z0-9_\.\-_=]{100,2000}$/);
    if (regExpValidDataAccessToken.test(token)) {
        return true
    } else {
        return false;
    }
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
