var _ = require('underscore');
var connect = require('connect');
var util = require('util');
var join = require('path').join;
var fs = require('fs');

function rreaddirSync(dir) {
    var files = fs.readdirSync(dir).map(function (f) {
        return join(dir, f)
    });
    var allFiles = [];
    files.forEach(function (f) {
        if (!fs.statSync(f).isDirectory()) {
            allFiles.push(f);
            return;
        }
        allFiles = allFiles.concat(rreaddirSync(f));
    });
    return allFiles;
}

exports.WebServer = WebServer;


function WebServer(config) {
    this.webPort = 8000;
    this.pngDir = '';
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
    _.extend(this, config);
}

WebServer.prototype.start = function () {
    var self = this;
    var express = require('express');
    var server = express();

    server.use(express.static(self.pngDir));
    server.use('/', function (req, res, next) {
        var allFiles = rreaddirSync(self.pngDir);
        console.log(allFiles);
        res.end(allFiles.map(function (e) {
            var name = e.substr(self.pngDir.length);
            if (name.indexOf(".png") == -1) {
                return;
            }
            return "<a href='" + name + "'>" + name + "</a><br/>";
        }).join("\n"));
    });
    server.listen(self.webPort, function () {
        self.cli.info(util.format(
            'Serving %s on port %s',
            self.pngDir,
            self.webPort
        ));
    });
};
