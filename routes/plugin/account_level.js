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
const agreements_table = config.database.agreements_table;
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
                    path: './logs/account_level-%Y%m%d.log',
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
    const plugin_user_restore_json_schema = {
        "type": "object",
        "properties": {
            "clickhistory": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "linkid": {
                            "type": "string"
                        },
                        "utc": {
                            "type": "string"
                        },
                        "local_time": {
                            "type": "string"
                        },
                        "url": {
                            "type": "string"
                        },
                        "expiration": {
                            "type": "string"
                        }
                    },
                    "required": [
                        "utc",
                        "local_time",
                        "url"
                    ]
                },
                "minItems": 1,
                "maxItems": 2000,
                "uniqueItems": false

            },
            "data_agreements": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "createtime": {
                            "type": "string"
                        },
                        "lastmodifiedtime": {
                            "type": "string"
                        },
                        "counterparty_name": {
                            "type": "string"
                        },
                        "counterparty_id": {
                            "type": "string"
                        },
                        "agreementid": {
                            "type": "string"
                        },
                        "active": {
                            "type": "integer"
                        },
                        "data_grants": {
                            "type": "string"
                        },
                        "original_request": {
                            "type": "string"
                        }
                    },
                    "required": [
                        "createtime",
                        "lastmodifiedtime",
                        "counterparty_name",
                        "agreementid",
                        "active",
                        "counterparty_id"]
                },
                "minItems": 1,
                "maxItems": 1000,
                "uniqueItems": false

            }
        },
        "required": [
            "clickhistory",
            "data_agreements"
        ],
    };


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
        url: {
            type: 'string',
            "minLength": 1,
            "maxLength": 1000
        }
    },
    required: ['url', 'local_time'],
};

    const plugin_user_delete_account_json_schema = {
            type: "object",
            properties: {
                browserid: {
                    type: "string", 
                    "minLength": 1,
                    "maxLength": 100
                                    }
            },
            required: ["browserid"],
    };

    const ajv = new Ajv();

    app.post('/plugin_user_import', (req, res) => {
        console.debug("/plugin_user_import");
        try {
           // console.log(req.method);
           // console.log(req.rawHeaders);
           // console.log(req.body);
            var installationUniqueId = getInstallationUniqueId(req.header("installationUniqueId"));

            if (!installationUniqueId) {
                return res.status(400).json({
                    error: 'Invalid installationUniqueId'
                });
            }
            // Validate JSON against schema
            const valid = ajv.validate(plugin_user_restore_json_schema, req.body);

            if (!valid) {
                return res.status(400).json({
                    error: 'Invalid data format'
                });
            }   
            var clickdatainserts = 0;
            const executeQuery = (sql) => {
                return new Promise((resolve, reject) => {
                    connection.query(sql, (err, result) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(result);
                        }
                    });
                });
            };
console.log("req.body.clickhistory");
            const insertClickHistoryPromises = req.body.clickhistory.map(item => {
                    const {
                        linkid,
                        utc,
                        local_time,
                        url,
                        expiration
                    } = item;
                    const newlinkid = crypto.randomUUID();
                    const sql = `INSERT INTO ${clickdata_table} (environment, url, browserid, linkid, utc, local_time, expiration) VALUES (?, ?, ?, ?, ?, ?, ?)`;
                    console.log(sql );
                    const inserts = [environment, url, installationUniqueId, newlinkid, utc, local_time, expiration];
                    return executeQuery(mysql.format(sql, inserts));
                });

            const insertDataAgreementsPromises = req.body.data_agreements.map(item => {
                    const {
                        createtime,
                        lastmodifiedtime,
                        counterparty_name,
                        agreementid,
                        active,
                        counterparty_id,
                        data_grants,
                        original_request
                    } = item;
                    const newagreementid = crypto.randomUUID();
                    const sql = `INSERT INTO ${agreements_table} (environment, browserid, createtime, lastmodifiedtime, counterparty_name, agreementid, active, counterparty_id, data_grants, original_request) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                    const inserts = [environment, installationUniqueId, createtime, lastmodifiedtime, counterparty_name, newagreementid, active, counterparty_id, data_grants, original_request];
                    return executeQuery(mysql.format(sql, inserts));
                });

            Promise.all([...insertClickHistoryPromises, ...insertDataAgreementsPromises])
            .then(results => {
                // Handle success for all queries
                const affectedRows = results.reduce((acc, result) => acc + result.affectedRows, 0);
                console.info("Total affectedRows: " + affectedRows);
                res.status(200).json({
                    added: affectedRows
                });
            })
            .catch(err => {
                console.debug(err);
                res.status(500).json({
                    error: 'Database error'
                });
            });

        } catch (err) {
            console.debug(err);
        }
    });

    app.post('/plugin_user_delete_aaccount', (req, res) => {
        console.debug("/plugin_user_delete_aaccount");
        try {
            console.log(req.method);
            console.log(req.rawHeaders);
            console.log(req.body);
            var installationUniqueId = getInstallationUniqueId(req.header("installationUniqueId"));

            if (!installationUniqueId) {
                return res.status(400).json({
                    error: 'Invalid installationUniqueId'
                });
            }
            const body = req.body;
            // Validate JSON against schema
            console.log(body);
            const valid = ajv.validate(plugin_user_delete_account_json_schema, body);

            if (!valid) {
                return res.status(400).json({
                    error: 'Invalid data format'
                });
            }
            var clickdatainserts = 0;
            const executeQuery = (sql) => {
                return new Promise((resolve, reject) => {
                    connection.query(sql, (err, result) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(result);
                        }
                    });
                });
            };

            
                    const sql = "DELETE FROM "+ clickdata_table +" WHERE environment = ? AND browserid = ? ";
//console.log(sql);
                    const inserts = [environment, installationUniqueId];
                    const deleteClickHistoryPromise = executeQuery(mysql.format(sql, inserts));
                
                    const sql2 = "DELETE FROM "+ agreements_table +" WHERE environment = ? AND browserid = ? ";
                  //  console.log(sql2);
                                       // const inserts = [environment, installationUniqueId];
                                        const deleteDataAgreementsPromise = executeQuery(mysql.format(sql2, inserts));
                                    


         

            Promise.all([deleteClickHistoryPromise, deleteDataAgreementsPromise])
            .then(results => {
                // Handle success for all queries
                const affectedRows = results.reduce((acc, result) => acc + result.affectedRows, 0);
                console.info("Total affectedRows: " + affectedRows);
                res.status(200).json({
                    added: affectedRows
                });
            })
            .catch(err => {
                console.debug(err);
                res.status(500).json({
                    error: 'Database error'
                });
            });

        } catch (err) {
            console.debug(err);
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
