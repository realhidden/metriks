var _ = require('underscore');
var async = require('async');
var exec = require('child_process').exec;
var fs = require('fs');
var glob = require('glob');
var os = require('os');
var sys = require('sys');
var util = require('util');
var path = require('path');
var mkdirp = require('mkdirp');
var RRDTool = require('./rrdtool').RRDTool;

_.templateSettings = {
    interpolate: /\{(.+?)\}/g
};

exports.RRD = RRD;

function RRD(config) {
    this.theme = {
        'BACK': '#F0F0F0FF',
        'CANVAS': '#FFFFFFFF',
        'FRAME': '#F0F0F0FF',
        'FONT': '#666666FF',
        'AXIS': '#CFD6F8FF',
        'ARROW': '#CFD6F8FF',
        'LINES': ["#00CC00FF", "#0066B3FF", "#FF8000FF", "#FFCC00FF",
            "#330099FF", "#990099FF", "#CCFF00FF", "#FF0000FF", "#808080FF",
            "#008F00FF", "#00487DFF", "#B35A00FF", "#B38F00FF", "#6B006BFF",
            "#8FB300FF", "#B30000FF", "#BEBEBEFF", "#80FF80FF", "#80C9FFFF",
            "#FFC080FF", "#FFE680FF", "#AA80FFFF", "#EE00CCFF", "#FF8080FF",
            "#666600FF", "#FFBFFFFF", "#00FFCCFF", "#CC6699FF", "#999900FF"]
    };

    this.font = ['TITLE:12:Sans', 'DEFAULT:7', 'LEGEND:7'];

    this.defaultGraphStore = {
        consolidation: 'AVERAGE',
        xff: 0.5,
        step: 1,
        rows: 300,
    };

    this.defaultGraph = {
        width: 1000,
        height: 600,
        watermark: 'metriks',
        border: 0,
        zoom: 1,
        fullSizeMode: true,
        dynamicLabels: true,
        slopeMode: true,
        end: 'now',
        start: 'end-120000s',
        verticalLabel: '',
    };

    this.defaultLineStore = {
        dsType: 'GAUGE',
        consolidation: 'AVERAGE',
        heartBeat: 600,
        min: 'U',
        max: 'U',
    };

    this.defaultLine = {
        element: 'LINE1',
    };

    this.name = '';

    this.graph = {};
    this.graphStore = {};
    this.line = {};
    this.lineStore = {};

    this.rrdDir = null;
    this.pngDir = null;

    this.rrdFile = null;
    this.pngFile = null;

    // mgr config
    this.cli = {
        info: function (str) {
            console.log('INFO:  ' + str);
        },
        debug: function (str) {
            console.log('DEBUG: ' + str);
        },
        error: function (str) {
            console.log('ERROR: ' + str);
        },
        fatal: function (str) {
            console.log('FATAL: ' + str);
        },
        ok: function (str) {
            console.log('OK:    ' + str);
        },
    };

    // Merge passed config
    _.extend(this, config);

    this.rrdtool = new RRDTool({
        cli: this.cli,
    });

    this.graph = {};
    _.extend(this.graph, this.defaultGraph, config.graph);
    this.graphStore = {};
    _.extend(this.graphStore, this.defaultGraphStore, config.graphStore);

    // Allow complementing line defaults using wildcards
    if (config.line) {
        _.extend(this.defaultLine, config.line['*']);
        delete config.line['*'];
    }
    if (config.lineStore) {
        _.extend(this.defaultLineStore, config.lineStore['*']);
        delete config.lineStore['*'];
    }

    // Save line properties under dsName compatible names
    var cleanLine = {};
    _.each(config.line, function (lineProperties, dsName) {
        // Merging defaults can only be done at runtime
        var cleanDsName = (dsName + '').replace(/[^a-zA-Z0-9_]/g, '_').substr(0, 19);
        cleanLine[cleanDsName] = lineProperties;
    });
    this.line = cleanLine;

    // Save lineStore properties under dsName compatible names
    var cleanLineStore = {};
    _.each(config.lineStore, function (lineProperties, dsName) {
        // Merging defaults can only be done at runtime
        var cleanDsName = (dsName + '').replace(/[^a-zA-Z0-9_]/g, '_').substr(0, 19);
        cleanLineStore[cleanDsName] = lineProperties;
    });
    this.lineStore = cleanLineStore;

    // Smart options
    if (!this.rrdFile) {
        this.rrdFile = util.format('%s/%s-%s.rrd', this.name, os.hostname(), this.name);
    }
    if (this.rrdFile.substr(0, 1) !== '/') {
        this.rrdFile = this.rrdDir + '/' + this.rrdFile;
    }
    if (!this.pngFile) {
        this.pngFile = util.format('%s/%s-%s.png', this.name, os.hostname(), this.name);
    }
    if (this.pngFile.substr(0, 1) !== '/') {
        this.pngFile = this.pngDir + '/' + this.pngFile;
    }

    if (!this.rrdDir) {
        throw new Error('Please set the rrdDir');
    }
    if (!this.pngDir) {
        throw new Error('Please set the pngDir');
    }
}

RRD.prototype.update = function (series, cb) {
    var self = this;

    async.waterfall([
        function (callback) {
            // Mkdir
            var rrdDir = path.dirname(self.rrdFile);
            if (fs.existsSync(rrdDir)) {
                return callback(null);
            }

            self.cli.info(util.format('Creating directory %s', rrdDir));
            mkdirp(rrdDir, function (err) {
                if (err) {
                    return callback(err);
                }

                return callback(null);
            });
        },
        function (callback) {
            // Find info
            self.rrdtool.info(self.rrdFile, [], function (err, info) {
                if (err) {
                    return callback(err);
                }
                callback(null, info);
            });
        },
        function (info, callback) {
            // Create rrds if needed
            var values = [];
            var rrdCreateOptions = [];

            if (self.graphStore['rrdstep']) {
                rrdCreateOptions.push('-s ');
                rrdCreateOptions.push(parseInt(self.graphStore['rrdstep']));
            }

            series.forEach(function (item, lineIndex) {
                rrdCreateOptions.push(_.template('DS:{ dsName }:{ dsType }:{ heartBeat }:{ min }:{ max }')(self.getLineStore(item.dsName, lineIndex)));
                values.push(item.value);
            });

            rrdCreateOptions.push(_.template('RRA:{ consolidation }:{ xff }:{ step }:{ rows }')(self.graphStore));

            if (info === null) {
                // Info is null if the rrd didn't exist yet
                //first call will have the good data structure
                self.rrdtool.create(self.rrdFile, rrdCreateOptions, function (err, output) {
                    return callback(err, values);
                });
            } else {
                var datasourcesInRRD = _.keys(info.ds);

                var alreadyCB = false;
                series.forEach(function (item, seriesIndex) {
                    if (alreadyCB) {
                        return;
                    }
                    if (datasourcesInRRD.indexOf(item.dsName) == -1) {
                        //TODO: should we regenerate rrd?
                        alreadyCB = true;
                        return callback(new Error(util.format(
                            'Datasource doesn\'t contain source "%s", all dsNames: %s',
                            item.dsName,
                            datasourcesInRRD.join(', ')
                        )));
                    }
                });
                if (alreadyCB) {
                    return;
                }

                //reordering values to fit rrd structure
                values = [];

                datasourcesInRRD.forEach((dsName) => {
                    var hasIt = series.filter(e => e.dsName == dsName);
                    if (hasIt.length > 0) {
                        values.push(hasIt[0].value);
                    } else {
                        values.push('U');
                    }
                });

                return callback(null, values);
            }
        },
        function (values, callback) {
            // Update rrd with series
            self.rrdtool.update(self.rrdFile, new Date(), values, [], function (err, output) {
                callback(null);
            });
        }
    ], function (err) {
        cb(err);
    });
};

RRD.prototype.getLineStore = function (dsName, lineIndex) {
    var self = this;
    dsName = self.rrdtool.toDatasourceName(dsName);

    var lineStore = {};
    _.extend(
        lineStore,
        self.defaultLineStore,
        {
            vName: dsName + 'a',
            rrdFile: self.rrdFile,
        },
        self.lineStore[dsName],
        {
            dsName: dsName,
        }
    );

    return lineStore;
};

RRD.prototype.getLine = function (dsName, lineIndex) {
    var self = this;
    dsName = self.rrdtool.toDatasourceName(dsName);

    var line = {};
    _.extend(
        line,
        self.defaultLine,
        {
            vName: dsName + 'a',
            title: dsName,
            color: self.theme.LINES[lineIndex],
        },
        self.line[dsName]
    );

    return line;
};

RRD.prototype.grapher = function (cb) {
    var self = this;

    async.waterfall([
        //ensure directory is created
        function (callback) {
            // Mkdir
            var pngDir = path.dirname(self.pngFile);
            if (fs.existsSync(pngDir)) {
                return callback(null);
            }

            self.cli.info(util.format('Creating directory %s', pngDir));
            mkdirp(pngDir, function (err) {
                if (err) {
                    return callback(err);
                }

                return callback(null);
            });
        },
        //call info tool and create definitions
        function (callback) {
            self.rrdtool.info(self.rrdFile, [], function (err, info) {
                if (err) {
                    return callback(err);
                }

                // Leave out any graph object property that's not a true rrd graph parameter
                var rrdGraphOptions = [];

                var modifiedSettings = Object.assign({}, self.graph);
                if (info['ds']) {
                    modifiedSettings.height += 11 * Object.keys(info.ds).length
                }
                rrdGraphOptions.push(modifiedSettings);

                // Apply theme border/canvas/font colors
                _.each(self.theme, function (themeColor, themeKey) {
                    if (_.isString(themeColor)) {
                        rrdGraphOptions.push('--color');
                        rrdGraphOptions.push(themeKey + themeColor);
                    }
                });

                //fonts
                self.font.forEach(f => {
                    rrdGraphOptions.push('--font');
                    rrdGraphOptions.push(f);
                });

                //comment start
                rrdGraphOptions.push("COMMENT:\\\\t");
                rrdGraphOptions.push("COMMENT:Cur\\\\t");
                rrdGraphOptions.push("COMMENT:Min\\\\t");
                rrdGraphOptions.push("COMMENT:Avg\\\\t");
                rrdGraphOptions.push("COMMENT:Max\\\\t\\\\r");

                // Loop over each ds, merge params and push to rrdGraphOptions array
                _.keys(info.ds).forEach(function (dsName, lineIndex) {
                    var linestore = self.getLineStore(dsName, lineIndex);
                    var line = self.getLine(dsName, lineIndex);

                    rrdGraphOptions.push(_.template('DEF:avg_{ vName }={ rrdFile }:{ dsName }:AVERAGE')(linestore));
                    rrdGraphOptions.push(_.template('DEF:min_{ vName }={ rrdFile }:{ dsName }:MIN')(linestore));
                    rrdGraphOptions.push(_.template('DEF:max_{ vName }={ rrdFile }:{ dsName }:MAX')(linestore));
                    rrdGraphOptions.push(_.template('VDEF:vavg_{ vName }=avg_{ vName },AVERAGE')(linestore));
                    rrdGraphOptions.push(_.template('VDEF:vmin_{ vName }=min_{ vName },MINIMUM')(linestore));
                    rrdGraphOptions.push(_.template('VDEF:vmax_{ vName }=max_{ vName },MAXIMUM')(linestore));
                    rrdGraphOptions.push(_.template('VDEF:vlst_{ vName }=avg_{ vName },LAST')(linestore));

                    rrdGraphOptions.push(_.template('{ element }:avg_{ vName }{ color }:{ title }\\\\l')(line));
                    rrdGraphOptions.push("COMMENT:\\\\u");
                    rrdGraphOptions.push("COMMENT:\\\\t");
                    rrdGraphOptions.push(_.template("GPRINT:vlst_{ vName }:%6.2lf%s\\\\t")(linestore));
                    rrdGraphOptions.push(_.template("GPRINT:vmin_{ vName }:%6.2lf%s\\\\t")(linestore));
                    rrdGraphOptions.push(_.template("GPRINT:vavg_{ vName }:%6.2lf%s\\\\t")(linestore));
                    rrdGraphOptions.push(_.template("GPRINT:vmax_{ vName }:%6.2lf%s\\\\t")(linestore));
                    rrdGraphOptions.push("COMMENT:\\\\r");
                });

                callback(null, rrdGraphOptions);
            });
        },
        //call graphing itself
        function (rrdGraphOptions, callback) {
            self.rrdtool.graph(self.pngFile, rrdGraphOptions, function (err, output) {
                if (err) {
                    return callback(err);
                }

                callback(null);
            });
        }
    ], function (err) {
        cb(err);
    });
};
