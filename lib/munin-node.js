const async = require('async');
const connectToServer = require('./munin');
const RRD = require('./rrd').RRD;
const fs = require('fs');

const muninversionRegexp = /munins node on (.*) version: (.*)\n/g;

/*
my $range_colour  = "22ff22";
my $single_colour = "00aa00";
my %times = (
	"hour"  => "end-4000s",  # (i.e. -1h6m40s)
	"day"   => "end-2000m",  # (i.e. -33h20m)
	"week"  => "end-12000m", # (i.e. -8d13h20m)
	"month" => "end-48000m", # (i.e. -33d8h)
	"year"  => "end-400d",
	"pinpoint"  => "unused_value",
);

my %resolutions = (
	"hour"  => "10",
	"day"   => "300",
	"week"  => "1500",
	"month" => "7200",
	"year"  => "86400"
);

push @rrd_gfx, "COMMENT:\\t";
	push @rrd_gfx, "COMMENT:Cur\\t";
	push @rrd_gfx, "COMMENT:Min\\t";
	push @rrd_gfx, "COMMENT:Avg\\t";
	push @rrd_gfx, "COMMENT:Max\\t\\r";

# Handle .sum
		if ($_sum) {
			# .sum is just a alias + cdef shortcut, an exemple is :
			#
			# inputtotal.sum \
			#            ups-5a:snmp_ups_ups-5a_current.inputcurrent \
			#            ups-5b:snmp_ups_ups-5b_current.inputcurrent
			# outputtotal.sum \
			#            ups-5a:snmp_ups_ups-5a_current.outputcurrent \
			#            ups-5b:snmp_ups_ups-5b_current.outputcurrent
			#
			my @sum_items = split(/ +/, $_sum);
			my @sum_items_generated;
			my $sum_item_idx = 0;
			for my $sum_item (@sum_items) {
				my $sum_item_rrdname = "s_" . $sum_item_idx . "_" . $_rrdname;
				push @sum_items_generated, $sum_item_rrdname;

				# Get the RRD from the $sum_item
				my ($sum_item_rrdfile, $sum_item_rrdfield, $sum_item_lastupdated)
					= get_alias_rrdfile($dbh, $sum_item);


				push @rrd_sum, "DEF:avg_$sum_item_rrdname=" . $sum_item_rrdfile . ":" . $sum_item_rrdfield . ":AVERAGE";
				push @rrd_sum, "DEF:min_$sum_item_rrdname=" . $sum_item_rrdfile . ":" . $sum_item_rrdfield . ":MIN";
				push @rrd_sum, "DEF:max_$sum_item_rrdname=" . $sum_item_rrdfile . ":" . $sum_item_rrdfield . ":MAX";

				# The sum lastupdated is the latest of its parts.
				if (! $_lastupdated || $_lastupdated < $sum_item_lastupdated) {
					$_lastupdated = $sum_item_lastupdated;
				}
			} continue {
				$sum_item_idx ++;
			}

			# Now, the real meat. The CDEF SUMMING.
			# The initial 0 is because you have to have an initial value when chain summing
			for my $t (qw(min avg max)) {
				# Yey... a nice little MapReduce :-)
				my @s = map { $t . "_" . $_ } @sum_items_generated;
				my $cdef_sums = join(",+,", @s);
				push @rrd_sum, "CDEF:$t". "_r_" . "$_rrdname=0," . $cdef_sums . ",+";
			}
		}

		my $real_rrdname = $_rrdcdef ? "r_$_rrdname" : $_rrdname;
		if (! $_sum) {
			push @rrd_def, "DEF:avg_$real_rrdname=" . $_rrdfile . ":" . $_rrdfield . ":AVERAGE";
			push @rrd_def, "DEF:min_$real_rrdname=" . $_rrdfile . ":" . $_rrdfield . ":MIN";
			push @rrd_def, "DEF:max_$real_rrdname=" . $_rrdfile . ":" . $_rrdfield . ":MAX";
		}

		# Handle an eventual cdef
		if ($_rrdcdef) {
			# Populate the CDEF dictionary, to be able to swosh it at the end.
			# As it will enable to solve inter-field CDEFs.
			$rrd_cdefs{$_rrdname}->{_rrdcdef} = $_rrdcdef;
			$rrd_cdefs{$_rrdname}->{real_rrdname} = $real_rrdname;
		}


		# Handle the (LINE|AREA)STACK munin extensions
		$_drawtype = $field_number ? "STACK" : "AREA" if $_drawtype eq "AREASTACK";
		$_drawtype = $field_number ? "STACK" : "LINE" if $_drawtype eq "LINESTACK";

		# Override a STACK to LINE if it's the first field
		$_drawtype = "LINE" if $_drawtype eq "STACK" && ! $field_number;

		# If this field is the negative of another field, we don't draw it anymore
		# ... But we did still want to compute the related DEF & CDEF
		next if $_has_negative;

		push @rrd_gfx, "$_drawtype:avg_$_rrdname#$_color:$_label$_drawstyle\\l";

		# Legend
		push @rrd_vdef, "VDEF:vavg_$_rrdname=avg_$_rrdname,AVERAGE";
		push @rrd_vdef, "VDEF:vmin_$_rrdname=min_$_rrdname,MINIMUM";
		push @rrd_vdef, "VDEF:vmax_$_rrdname=max_$_rrdname,MAXIMUM";

		push @rrd_vdef, "VDEF:vlst_$_rrdname=avg_$_rrdname,LAST";

		"--title", "$graph_title - $title",
		"--watermark", "Munin " . $Munin::Common::Defaults::MUNIN_VERSION,
		"--imgformat", $format,
		"--start", $start,
		"--slope-mode",



                '--width', $width,
                '--height', $height,

		"--border", "0",

	# Optional header args
	push @rrd_header, "--vertical-label", $graph_vlabel if $graph_vlabel;

	# Sparklines
	push @rrd_header, "--only-graph" if $cgi->url_param("only_graph");
 */

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
            cap: [],
            heartbeat: 60
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

    _parseConfig(configlines) {
        var ret = {
            graphStore: {
                consolidation: 'AVERAGE',
                xff: 0.5,
                step: 1,
                rows: 300,
                rrdstep: this.nodeinfo.heartbeat
            },
            graph: {
                width: 495,
                height: 254,
                watermark: 'metriks',
                border: '0',
                zoom: 2,
                fullSizeMode: true,
                dynamicLabels: true,
                slopeMode: true,
                end: 'now',
                start: 'end-120000s',
                verticalLabel: '',
            }, lines: {}
        };

        configlines.forEach((line) => {

            //graph_
            if (line.substr(0, 6) == "graph_") {
                var subline = line.substr(6);
                subline = [subline.substr(0, subline.indexOf(" ")), subline.substr(subline.indexOf(" ") + 1)];
                //fixup values
                if (subline[0] == 'vlabel') {
                    subline[0] = 'verticalLabel';
                }

                //ignore unimplemented stuff
                //TODO: fix these
                if (['category','order','total','scale','info','period','printf'].indexOf(subline[0]) != -1) {
                    return;
                }

                //expand args
                if (subline[0] == 'args') {
                    //TODO: fix this
                    return;

                    var extraparams = subline[1].split("--");
                    extraparams.forEach((ep) => {
                        if (ep.length == 0) {
                            return;
                        }

                        ep = [ep.substr(0, ep.indexOf(" ")), ep.substr(ep.indexOf(" ") + 1)];
                        ret.graph[ep[0]] = ep[1];
                    })

                    //stop processing this args
                    return;
                }

                ret.graph[subline[0]] = subline[1];
                return;
            }

            var subline = line;
            subline = [subline.substr(0, subline.indexOf(" ")), subline.substr(subline.indexOf(" ") + 1)];

            //this is a line
            if (subline[0].indexOf(".") == -1) {
                return console.log("Cannot understand: " + line);
            }
            var lineconf = subline[0].split(".");

            console.log(subline[0], ' -> ', lineconf);

            if (!ret.lines[lineconf[0]]) {
                ret.lines[lineconf[0]] = {
                    dsType: 'GAUGE',
                    heartBeat: this.nodeinfo.heartbeat,
                    min: 'U',
                    max: 'U',
                    title: lineconf[0]
                };
            }

            //fix data
            switch (lineconf[1]) {
                case 'label':
                    lineconf[1] = 'title';
                    break;
                case 'type':
                    lineconf[1] = 'dsType';
                    break;
            }

            //put data in its place
            ret.lines[lineconf[0]][lineconf[1]] = subline[1];
        });

        return ret;
    }

    _parseValues(valuelines) {
        var ret = [];

        valuelines.forEach((line) => {
            var subline = line;
            subline = [subline.substr(0, subline.indexOf(" ")), subline.substr(subline.indexOf(" ") + 1)];

            //this is a line
            if (subline[0].indexOf(".") == -1) {
                return console.log("Cannot understand: " + line);
            }
            var lineconf = subline[0].split(".");

            ret.push({
                dsName: lineconf[0],
                value: subline[1]
            })
        });

        return ret;
    }

    _updateRRD(config, cb) {
        async.eachSeries(Object.keys(this.modules), (mname, mcb) => {
            var configVars = this._parseConfig(this.modules[mname].config);
            var valueVars = this._parseValues(this.modules[mname].values);
            /*
            this.defaultGraphStore = {
                consolidation: 'AVERAGE',
                xff          : 0.5,
                step         : 1,
                rows         : 300,
            };

            this.defaultGraph = {
                width        : 1000,
                height       : 600,
                watermark    : 'kvz.io',
                font         : 'DEFAULT:10:Inconsolata',
                tabwidth     : 20,
                border       : 2,
                zoom         : 1,
                fullSizeMode : true,
                dynamicLabels: true,
                slopeMode    : true,
                end          : 'now',
                start        : 'end-120000s',
                verticalLabel: '',
            };

            this.defaultLineStore = {
                dsType       : 'GAUGE',
                heartBeat    : 600,
                min          : 'U',
                max          : 'U',
            };

            this.defaultLine = {
                element: 'LINE1',
            };*/
            console.log(configVars,valueVars);
            var rrd = new RRD({
                rrdDir: config.rrdDir,
                pngDir: config.pngDir,

                name: mname,
                graph: configVars.graph,
                graphStore: configVars.graphStore,
                line: configVars.lines,
                lineStore: configVars.lines,
            });

            console.log(configVars.lines,valueVars);

            rrd.update(valueVars, (err) => {
                if (err){
                    console.log(err);
                }
                rrd.grapher((err) => {
                    console.log("Grapher finished: " + err);
                    //mcb(err);
                    //ignore errors
                    mcb();
                });
            })
        }, (finalerr) => {
            console.log('RRD update done: ' + finalerr);
            cb(finalerr);
        });
    }

    update(config, cb) {
        if (this.isprocessing == true) {
            return cb('still processing');
        }

        /*this.modules = JSON.parse(fs.readFileSync('munin.json'));
        this._updateRRD(config, cb);
        return;*/

        this.isprocessing = true;

        async.series([
            (mcb) => {
                console.log("Version update");
                this._versionUpdate(mcb)
            },
            (mcb) => {
                console.log("Module list update");
                this._modulelistUpdate(mcb);
            },
            (mcb) => {
                console.log("Module config update");
                this._moduleconfigUpdate(mcb);
            },
            (mcb) => {
                console.log("Module value update");
                this._valuesUpdate(mcb);
            },
            (mcb) => {
                console.log("RRD update");
                this._updateRRD(config, mcb);
            }
        ], (finalerr) => {
            //fs.writeFileSync('munin.json', JSON.stringify(this.modules));
            if (finalerr) {
                console.log("Final error: " + finalerr);
            }
            this.isprocessing = false;
            cb();
        });
    }
}

module.exports = MuninNode;