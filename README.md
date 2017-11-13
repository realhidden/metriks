# Metriks

metriks.io is a time-series graphing tool that runs on servers. if you can output a number, metriks will create a beautiful graph for you.
it builds on top of 'ancient' `rrdtool` which has proven to work well in production. metriks tries to limit infrastructural dependencies and features in order to provide a robust and pleasant experience for simple graphing needs.

plugins can be written in any language, or you can directly start graphing by tapping into metriks with node:

```javascript
// metriks is under development, plugins work but the following API is still under discussion:
var metriks = require('metriks');
var graph   = metriks.create('df');
graph.log({'/dev/sda1', '50%'});
```

## Features

 - Builds on `rrdtool`. The network industry standard of saving time-series data to disk with a constant storage footprint.
 - Builds on `nodejs` for optimal concurrency and the ability to run a server without dealing with cgi-bin, etc.
 - Minimal dependencies. If you have node.js/npm working, all you need is `aptitude install rrdtool` and you're ready to go
 - Writes RRDs & images to disk, so it works when everything else is down.
 - Idempotent. Metriks will create graphs that don't exist, and generally be eager to get you results.
 - Trivial to add graphs. It should Just Work by default. Write a plugin file in any language. If it outputs a single number, metriks will graph it for you. You can optionally output configuration strings like `# config.interval: 60` or `# graph.title: Load average` to finetune behavior. Newlines (`\n`) separate graph lines. Other whitespaces separate graph label from value. See the [load plugin](https://github.com/kvz/metriks/blob/master/plugins/load.sh) for an example how to plot 3 load lines: 1 minute, 5 minute, 15 minute averages.
 - Can send out alerts when metrics go outside boundaries

Metriks is basic. If you want advanced, there are plenty other good options out there like graphite, mrtg, observium, cacti, gnuplot, munin, influxdb, or (paid) librato. You may also want to have a look at druid, riemann and grafana.
However **Metriks will never**:

 - Require you to deal with a flurry of perl modules / cgi-bin / xml / apache / java / tomcat / etc
 - Impose steep learning curves
 - Require a central piece of intelligence. Metriks runs distributed. Results can be aggregated centrally but are then saved as static html / json / images on e.g. S3.
 - Require networked components to be available to do it's job (in favor of graphing locally, optionally aggregating & uploading to e.g. S3)
 - Get in your way
 - Ask for your money

## Example

Here we'll add a simple graph with response times to different nameservers that looks like this:

![kvz-imac-home-4 local-ping 1](https://f.cloud.github.com/assets/26752/2184319/a854bf90-97bd-11e3-9d78-8ba0b7178952.png)

To achieve this, open a text file `./plugins/ping.sh`, `chmod +x` it, and make it say:

```bash
echo "# config.interval: 60"
echo "# graph.title: Ping resolving nameservers"
echo "# graph.verticalLabel: Roundtrip in ms"

for server in 8.8.8.8 4.2.2.2 208.67.222.222 172.16.0.23; do
  echo "ip_${server} $(ping -c 4 ${server} |tail -1 |awk '{print $4}' |cut -d '/' -f 2)"
done
```

## Options

If you want to keep your plugin files outside of the Metriks source directory, simply point metriks to your own plugin dir via:

```bash
metriks --plugin-dir ~/metriks/plugins
```

By default, metriks writes rrds files to `~/metriks/rrd` and images to `~/metriks/png`. But you can change that with

```bash
metriks --rrd-dir /var/lib/rrd
metriks --png-dir /var/www/graphs
```

Metriks contains an simple webserver so you can browse the `png` dir via:

```bash
metriks --web-port 8000
```

If you don't want to automatically build png files but are only interested in gathering data in rrd, use

```bash
metriks --auto-write-png false
```

If you want metriks to automatically upload to S3, use:

```bash
metriks --auto-upload-s3 true
```

Metriks will look for the following environment variables to do the s3 upload:

```bash
export METRIKS_S3_KEY=ABCDABCDABCDABCDABCD
export METRIKS_S3_SECRET=abcdabcdabcdabcdabcdabcdabcdabcdabcdabcd
export METRIKS_S3_BUCKET=metriks.example.com
```

The default permission is `public-read`, so be careful with that.

## Plugins

### Configuration

You can echo any of these in your `plugin.sh` to change behavior of metriks, here are the defaults so you might as well set none of these, and get the same results:

```bash
# config->interval  : 60
# config->enabled   : true

# graphStore->consolidation: 'AVERAGE'
# graphStore->xff          : 0.5
# graphStore->step         : 1
# graphStore->rows         : 300

# graph->width        : 1000
# graph->height       : 600
# graph->watermark    : 'kvz.io'
# graph->font         : 'DEFAULT:10:Inconsolata'
# graph->tabwidth     : 20
# graph->border       : 2
# graph->zoom         : 1
# graph->fullSizeMode : true
# graph->dynamicLabels: true
# graph->slopeMode    : true
# graph->end          : 'now'
# graph->start        : 'end-120000s'
# graph->verticalLabel: ''

# lineStore->${dsName}->dsType       : 'GAUGE'
# lineStore->${dsName}->heartBeat    : 600
# lineStore->${dsName}->min          : 'U'
# lineStore->${dsName}->max          : 'U'

# line->${dsName}->title        : '${dsName}'
# line->${dsName}->color        : '#44B824FF' .. '#3A96D0FF'
# line->${dsName}->element      : 'LINE1'
# line->${dsName}->consolidation: 'AVERAGE'
```

## Todo

Metriks is still in early stages of development, here's what needs to be done still:

 - [ ] Offer an API that so that you can programatically add values in Nodejs programs. e.g. `require('metriks').graph('df').addSeries([{'/': '50%'}])`
 - [ ] Offer *some* way to pipe data into it. I think STDIN vs using webserver as a dependency for that to accommodate decentralized / local preference
   - Should already create a graph without the need to define a plugin or run a daemon
   - Hence should trigger graph->upload
   - Just check if graph hasn't been written in the last 60 seconds to avoid overhead
   - Idea: I think this should be a separate tool.js that requires metriks and uses it's api to handle this. Vs having metriks support the stdin & configuration problems that come with that. More flexibel. Cleaner main program.
 - [ ] Checkout smokeping sources and try to build a plugin very similar to it. This should expose some limitations and make it more usable in different environments after fixing those. See [smokeping.md](smokeping.md).
 - [ ] Example plugin: top-10 memory heavy processes (may require "Dynamically expand ds" first)
 - [ ] Example plugins: http://word.bitly.com/post/74839060954/ten-things-to-monitor?h=2
 - [ ] Generate an index page/json of rrd/images. Maybe we can leverage existing `connect` webserver to write html to disk
 - [ ] Aggregate datasources into 1 graph using glob (maybe a separate process that uses s3 as source, can do indexes, aggegates, cleaning up old graphs)
 - [ ] Support for max & min values and a way to communicate problems to the outside world
 - [ ] Dynamically expand ds using rrdtool dump / import. It's hard, see http://stackoverflow.com/questions/13476226/adding-new-datasource-to-an-existing-rrd
 - [ ] More unit test coverage
 - [ ] Show min, max, avg for every ds on every graph by default
 - [ ] Write metriks version & datetime as watermark to every png
 - [ ] Should we ship an `upstart` file so people can daemonize/respawn/log metriks easily on ubuntu? [Yes](https://twitter.com/purefan/status/435409309858414592). Probably just output a possible config, and let the end user pipe/copy paste/change it, rather than writing to `/etc`
 - [ ] Ship Inconsolate or pick different widely-available font
 - [ ] Upgrade dependencies (async)
 - [x] Don't crash the main process on plugin fatals.
 - [x] Handle knox throwing: ECONNRESET. See https://github.com/LearnBoost/knox/issues/198
 - [x] Upload to s3 as a step after rrd -> graph -> upload
 - [x] Rename configs. some `graph` to `store`. `graph->lines` to `lines`.
 - [x] Support for `graph->lines->*->` for config that applies to all datasources
 - [x] More advanced rrd types (COUNTER vs GAUGE, ability to add a custom step, AREA graphs) as req in [#1](https://github.com/kvz/metriks/issues/1)
 - [x] Example plugin: network traffic
 - [x] Switch to `->` as a nesting delimiter. People will want to use `.` for IPs and such
 - [x] One theme object to determine colorscheme
 - [x] config nested per line. so `line.0.color` vs `lineColors.0`
 - [x] Install bin globally
 - [x] Add example section to readme with screenshots and plugin code
 - [x] Configurable line titles vs hardcoded ds name
 - [x] Upgrade flat once [this](https://github.com/hughsk/flat/issues/6) bug has been resolved. Until then, prefix all ds keys with a letter.
 - [x] Offer an optional webserver via e.g. [send](https://github.com/visionmedia/send) so you can browse through the generated pngs
 - [x] _.findWhere
 - [x] Refactoring: Plugin
 - [x] Refactoring: pluginmanager
 - [x] Refactoring: rrdtool
 - [x] Refactoring: cli
 - [x] Retire thong.tmpl for _.template
 - [x] Retire thong.sprintf for util.format
 - [x] Retire commander for cli
 - [x] Visually show integration test
 - [x] One integration test
 - [x] Test cases
 - [x] Explodetree/flatten, use it for plug-in config (linecolour slice to array) and rrdtool info
 - [x] _.isNumeric
 - [x] Librato colors
 - [x] Graph options need to be interpretted
 - [x] Configurable y-axis
 - [x] Lose rrd.js over rrdtool.js
 - [x] Async.parallel jobs
 - [x] Support for .go plugins

## Prerequisites

I'm assuming you already have [node 0.8+](http://nodejs.org/download/) and
[Git](http://git-scm.com/downloads) available.

### OSX

To run rrdtool on OSX you'll need [XQuartz](http://xquartz.macosforge.org).
Then via [Homebrew](http://brew.sh/):

```bash
brew install rrdtool coreutils
```

coreutils is required for `timeout`, used in integration tests.

### Ubuntu

```bash
aptitude install rrdtool
```

## Install


### Globally

```bash
npm install -g metriks
```

### Development

```bash
git clone https://github.com/kvz/metriks.git
cd metriks
npm install
```

## Run

With debug output, and a built-in webserver to browse resulting png graphs on port 8000

```bash
./bin/metriks --debug --web-port 8000
```

## Test

```bash
make test
```

## License

[MIT LICENSE](LICENSE)


## Sponsor development

<!-- badges/ -->
[![Gittip donate button](http://img.shields.io/gittip/kvz.png)](https://www.gittip.com/kvz/ "Sponsor the development of metriks via Gittip")
[![Flattr donate button](http://img.shields.io/flattr/donate.png?color=yellow)](https://flattr.com/submit/auto?user_id=kvz&url=https://github.com/kvz/metriks&title=metriks&language=&tags=github&category=software "Sponsor the development of metriks via Flattr")
[![PayPal donate button](http://img.shields.io/paypal/donate.png?color=yellow)](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=kevin%40vanzonneveld%2enet&lc=NL&item_name=Open%20source%20donation%20to%20Kevin%20van%20Zonneveld&currency_code=USD&bn=PP-DonationsBF%3abtn_donate_SM%2egif%3aNonHosted "Sponsor the development of metriks via Paypal")
[![BitCoin donate button](http://img.shields.io/bitcoin/donate.png?color=yellow)](https://coinbase.com/checkouts/19BtCjLCboRgTAXiaEvnvkdoRyjd843Dg2 "Sponsor the development of metriks via BitCoin")
<!-- /badges -->
