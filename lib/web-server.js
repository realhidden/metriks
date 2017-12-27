var _ = require('underscore');
var util = require('util');
var join = require('path').join;
var fs = require('fs');
var resolve = require('path').resolve;

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
        res.header('Content-Type', 'text/html');
        res.end(allFiles.map(function (e) {
            var name = resolve(e).substr(resolve(self.pngDir).length);
            if (name.indexOf(".png") == -1) {
                return;
            }
            return "<img src='" + name + "' width='300'/><br/>";
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
