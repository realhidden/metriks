const async = require('async');
const connectToServer = require('./munin');

const muninversionRegexp = /munins node on (.*) version: (.*)\n/g;

class MuninNode {
    /**
     * Config should contain:
     *  - ip
     *  - port
     */
    constructor(config) {
        this.config = config;
        this.isprocessing = false;
        this.modules = {};
        this.nodeinfo = {
            name: '',
            version: '',
            cap: []
        };
    }

    _versionUpdate(cb) {
        connectToServer(this.config['ip'], parseInt(this.config['port']), (err, comm) => {
            //on connect something goes wrong
            if (err) {
                return cb(err);
            }

            comm("version", (err, res) => {
                if (err) {
                    return;
                }

                var ver = muninversionRegexp.exec(res);
                if (ver) {
                    this.nodeinfo.name = ver[1];
                    this.nodeinfo.version = ver[2];
                } else {
                    console.error('Cannot get munin version from: ' + res);
                }

                comm("cap", (err, res) => {
                    if (err) {
                        return;
                    }

                    if (res.length > 4) {
                        this.nodeinfo.cap = res.substr(4).replace("\n", "").split(" ");
                    } else {
                        console.error('Cannot get munin cap from: ' + res);
                    }

                    comm("quit", (err, res) => {
                        console.log(this.nodeinfo);
                    });
                });
            });
        }, () => {
            //disconnect
            return cb();
        });
    }

    _modulelistUpdate(cb) {
        connectToServer(this.config['ip'], parseInt(this.config['port']), (err, comm) => {
            //on connect something goes wrong
            if (err) {
                return cb(err);
            }

            comm("list", (err, res) => {
                if (err) {
                    return;
                }

                if (res.length == 0) {
                    console.error('Cannot retrive module list from munin');
                } else {
                    var modulelist = res.replace("\n", "").split(" ");

                    //match module list from client to current list
                    Object.keys(this.modules).forEach((mname) => {
                        if (modulelist.indexOf(mname) == -1) {
                            //module was removed
                            delete this.modules[mname];
                        }
                    });

                    modulelist.forEach((mname) => {
                        if (!this.modules[mname]) {
                            //new module
                            this.modules[mname] = {
                                config: null,
                                values: null
                            }
                        }
                    });

                    console.log(modulelist)
                }

                comm("quit", (err, res) => {
                    console.log(this.modules);
                });
            });
        }, () => {
            //disconnect
            return cb();
        });
    }

    _moduleconfigUpdate(cb) {
        async.eachSeries(Object.keys(this.modules), (mname, mcb) => {
            connectToServer(this.config['ip'], parseInt(this.config['port']), (err, comm) => {
                if (err) {
                    //ignore connection error for one module config
                    return mcb();
                }

                comm("config " + mname, (err, res) => {
                    if (err) {
                        return;
                    }

                    res = res.substr(0, res.length - 3);
                    this.modules[mname].config = res.split("\n");
                    comm("quit", (err, res) => {
                        //silence
                    });
                });
            }, () => {
                //disconnect
                return mcb();
            });
        }, (finalerr) => {
            console.log(this.modules);
            cb(finalerr);
        });
    }

    _valuesUpdate(cb) {
        async.eachSeries(Object.keys(this.modules), (mname, mcb) => {
            connectToServer(this.config['ip'], parseInt(this.config['port']), (err, comm) => {
                if (err) {
                    //ignore connection error for one module config
                    return mcb();
                }

                comm("fetch " + mname, (err, res) => {
                    if (err) {
                        return;
                    }

                    res = res.substr(0, res.length - 3);
                    this.modules[mname].values = res.split("\n");
                    comm("quit", (err, res) => {
                        //silence
                    });
                });
            }, () => {
                //disconnect
                return mcb();
            });
        }, (finalerr) => {
            console.log(this.modules);
            cb(finalerr);
        });
    }

    update(cb) {
        if (this.isprocessing == true) {
            return cb('still processing');
        }

        this.isprocessing = true;

        async.series([
            (cb) => {
                this._versionUpdate(cb)
            },
            (cb) => {
                this._modulelistUpdate(cb);
            },
            (cb) => {
                this._moduleconfigUpdate(cb);
            },
            (cb) => {
                this._valuesUpdate(cb);
            }
        ], (finalerr) => {
            if (finalerr) {
                console.log("Final error: " + finalerr);
            }
            this.isprocessing = false;
            cb();
        });
    }
}

module.exports = MuninNode;