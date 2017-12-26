const MuninNode = require('./lib/munin-node');

//dotenv config
require('dotenv').config();

var workDir = process.env.WORK_DIR || '.';
var options = {
    //If > 0, run a webserver on that port to browse graphs
    webPort: parseInt(process.env.WEB_PORT) || 0,
    //How many hosts to run at once
    concurrency: process.env.CONCURRENCY || 5,
    //Automatically write png files to png-dir
    autoWritePng: process.env.AUTO_PNG || 0,
    //RRD directory. Overrules workDir
    rrdDir: workDir + '/rrd',
    //Image / HTML directory. Overrules workDir
    pngDir: workDir + '/png',
    //update interval (5 minutes default)
    updateInterval: process.env.UPDATE_INTERVAL || 1000 * 60 * 5
}

class Metriks {
    constructor(config) {
        this.config = config;
        this.nodes = {};
        this.updatetimeout = null;
    }

    start() {
        this.nodes['test'] = new MuninNode({
            ip: '192.168.43.193',
            port: 4949
        });

        if (this.config.webPort > 0) {
            var WebServer = require('./lib/web-server').WebServer;
            var webServer = new WebServer(this.config);
            console.log(webServer);
            webServer.start();
        }

        //this.updatetimeout = setTimeout(this.periodicupdate.bind(this), this.config.updateInterval)
        this.periodicupdate();
    }

    periodicupdate() {
        //clearTimeout(this.updatetimeout);
        Object.keys(this.nodes).forEach(function (item) {
            console.log("Updating " + item);
            this.nodes[item].update(() => {
                console.log("Node processing finished")
            });
        }.bind(this));
    }
}

const metriks = new Metriks(options);
metriks.start();
