var net = require('net');

function connectToServer(host, port, cb, disconnectcb) {
    var alldata = '';
    var oneliner = true;
    var client = new net.Socket();

    client.setNoDelay(true);

    var currentcb = null;

    var commFunction = function (toSend, cb) {
        //interrupt the prev callback
        if (currentcb) {
            currentcb('err');
        }
        currentcb = cb;
        alldata = "";

        //is the command a munin oneliner
        oneliner = (['cap', 'list', 'version', 'quit'].indexOf(toSend) != -1);

        client.write(toSend + '\r\n');
    }

    // this is a dummy callback for the first answer
    currentcb = function (err, line) {
        //first callback is created by the sytem itself
        if (err) {
            currentcb = null;
            return cb(err);
        }

        //TODO: for the "line" we have a welcome message here

        //first callback will give back the communication function to caller
        cb(err, commFunction);
    }

    client.connect(port, host, function () {
        console.log('Connected to ' + host);
    });

    var sendAnyway = null;
    client.on('data', function (chunk) {
        alldata += chunk.toString();

        //timeout for one munin call
        if (sendAnyway != null) {
            clearTimeout(sendAnyway);
            sendAnyway = null;
        }

        //is it a one liner
        if ((oneliner) && (alldata.substr(alldata.length - 1, 1) == "\n")) {
            var olddata = alldata;
            alldata = "";
            var needcb = currentcb;
            currentcb = null;
            if (needcb) {
                needcb(0, olddata);
            }
            return;
        }

        if (alldata.substr(alldata.length - 3, 3) == "\n.\n") {
            var olddata = alldata;
            alldata = "";
            var needcb = currentcb;
            currentcb = null;
            if (needcb) {
                needcb(0, olddata);
            }
            return;
        }

        //handle timeout for one call
        if (sendAnyway == null) {
            sendAnyway = setTimeout(function () {
                sendAnyway = null;
                var olddata = alldata;
                alldata = "";
                var needcb = currentcb;
                currentcb = null;
                if (needcb) {
                    needcb(0, olddata);
                }
                return;
            }, 5000);
        }
    });

    client.on('close', function () {
        var needcb = currentcb;
        currentcb = null;
        if (needcb) {
            needcb(0);
        }
        if (disconnectcb) {
            disconnectcb();
        }
    })

    client.on('error', function (e) {
        var needcb = currentcb;
        currentcb = null;
        if (needcb) {
            needcb(e);
        }
    });
}

module.exports = connectToServer;

/*
connectToServer('192.168.43.193', 4949, function (err, comm) {
    comm("version", function (err, res) {
        console.log(res);
        comm("list", function (err, res) {
            console.log(res);
            comm("quit", function (err, res) {
                console.log(res);
            });
        });
    });
});
 */