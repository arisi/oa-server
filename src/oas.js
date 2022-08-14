#!/usr/bin/env node
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var fs = require('fs');
var https = require('https');
var jwt = require('jsonwebtoken');
var ws = require('websocket-stream');
var express = require('express');
var session = require('express-session');
var cors = require('cors');
var proxy = require('express-http-proxy');
var yargs = require('yargs');
var match = require('mqtt-match');
var tls = require('tls');
var os = require('os');
var sprintf = require('sprintf');
var path = require('path');
var dns = require('dns');
var apis = {};
var reqs = {};
var _id = "broker";
var uuidv4 = function () {
    var result, i, j;
    result = '';
    for (j = 0; j < 32; j++) {
        if (j == 8 || j == 12 || j == 16 || j == 20)
            result = result + '-';
        i = Math.floor(Math.random() * 16).toString(16).toUpperCase();
        result = result + i;
    }
    return result;
};
var logger = function (s) {
    var dd = new Date(stamp()).toISOString();
    var fn = "".concat(argv.log_dir, "/").concat(dd.slice(0, 10), ".log");
    console.log(fn, dd + ';' + s);
    if (argv.log_dir)
        fs.appendFile(fn, dd + ';' + s + '\n', function () { });
};
var home_dir = os.homedir();
var pwd = process.cwd();
var state_fn = "".concat(home_dir, "/.oa/state.json");
var argv = yargs
    .command('mq11_broker.js', 'MQ11 MQTT Broker', {})
    .option('conf', {
    description: 'Config file to use',
    type: 'string',
    "default": "".concat(home_dir, "/.oa/config.json")
})
    .option('init_conf', {
    description: 'Create Template Config file to  ~/.oa/config.json',
    type: 'boolean'
})
    .option('log_dir', {
    description: 'Logging directory, ""=> no logging',
    type: 'string',
    "default": ""
})
    .help()
    .alias('help', 'h').argv;
if (argv.init_conf) {
    var p = path.join(home_dir, ".oa");
    var key_p = path.join(home_dir, ".oa/keys");
    var src = path.join(__dirname, "../config.json");
    var key_src = path.join(__dirname, "../keys");
    var target = path.join(p, "config.json");
    console.log("\nCreating template configuration");
    if (!fs.existsSync(p)) {
        fs.mkdirSync(p);
        console.log("Created Path", p);
    }
    else {
        if (fs.existsSync(target)) {
            console.error("Error: Config file Already Exists,\nwill not overwrite:", target, "\n");
            process.exit(-1);
        }
    }
    if (!fs.existsSync(key_p)) {
        fs.mkdirSync(key_p);
        console.log("Created Path", key_p);
    }
    console.log("Copying Template Config", src, "=>", target);
    console.log("Open Arm Directory:", pwd);
    var c = JSON.parse(fs.readFileSync(src).toString());
    c.server.web_home = pwd;
    fs.writeFileSync(target, JSON.stringify(c, null, 2));
    for (var _i = 0, _a = fs.readdirSync(key_src); _i < _a.length; _i++) {
        var dom = _a[_i];
        var ps = path.join(key_src, dom);
        var pp = path.join(key_p, dom);
        console.log("Checking Domain Path", pp);
        if (!fs.existsSync(pp)) {
            fs.mkdirSync(pp);
            console.log("Created Path", pp);
        }
        console.log("Copying Keyfiles from domain", dom);
        for (var _b = 0, _c = fs.readdirSync(ps); _b < _c.length; _b++) {
            var f = _c[_b];
            var ff = path.join(ps, f);
            var tt = path.join(key_p, dom, f);
            console.log("Copying Template Config", ff, "=>", tt);
            fs.copyFileSync(ff, tt);
        }
    }
}
var save_state = function () {
    fs.writeFileSync(state_fn, JSON.stringify(users, null, 2));
};
process.on('SIGINT', function () {
    console.log('\nCaught interrupt signal -- saving state');
    save_state();
    process.exit();
});
try {
    var conf = JSON.parse(fs.readFileSync(argv.conf)).server;
    var web_conf = JSON.parse(fs.readFileSync(argv.conf)).web;
}
catch (error) {
    console.error("Config file ".concat(argv.conf, " missing"));
    process.exit(-1);
}
console.log("Using config from:", argv.conf);
if (argv.log_dir)
    console.log("Logging to directory:", argv.log_dir);
else
    console.log("not Logging");
// stamp = () => {
//   return (new Date).getTime();
// }
var aconf = {
    realPublished: function (client, packet) {
        if (packet && 'payload' in packet) {
            var id = client ? client.id : client;
        }
        // console.log("YESYSYSYSYS",packet.payload.length);
    }
};
if (conf.persistence) {
    switch (conf.persistence.type) {
        case 'redis':
            var aedesPersistenceRedis = require('aedes-persistence-redis');
            aconf.persistence = aedesPersistenceRedis({
                port: conf.persistence.port,
                host: conf.persistence.host,
                family: 4,
                password: conf.persistence.password,
                db: conf.persistence.db,
                maxSessionDelivery: 100,
                packetTTL: function (packet) {
                    return 10;
                }
            });
            console.log("Using Redis for persistance at ".concat(conf.persistence.host, ":").concat(conf.persistence.port, " db:").concat(conf.persistence.db));
            break;
        default:
            console.error("Unknown persistance: ".concat(conf.persistence.type, " -- No Persistance!"));
    }
}
else
    console.log('No persistance!');
var aedes = require('aedes')(aconf);
var stamp = require('rt0s_js').stamp;
var start_time = stamp();
// aedes.authorizePublish = (client, packet, cb) => {
//   id = client ? client.id : client
//   console.log("authorizePublish",packet,id);
//   cb(null)
// }
var cons = {};
var users = {};
var user_stats = {};
aedes.on('client', function (client) {
});
aedes.on('ping', function (pac, client) {
    var id = client ? client.id : client;
    if (id in cons) {
        cons[id].pings += 1;
        cons[id].last_ping = stamp();
    }
    else
        console.error('ping from nowhere?', id);
});
// aedes.on('publish', (packet, client) => {
//   if (!packet.topic.match("/bc/.+")) {
//     id = client ? client.id : client
//     var s=packet.payload.toString()
//     packet.payload= ""
//     console.log("PUB",id, packet.topic,s);
//   }
// })
aedes.on('clientDisconnect', function (client) {
    var id = client ? client.id : client;
    console.log('Client Disconnected: \x1b[31m' + id + '\x1b[0m', 'to broker', aedes.id);
    if (id in cons && cons[id].username in users) {
        cons[id].socket.connected -= 1;
        users[cons[id].username].sessions -= 1;
        delete cons[id];
        send_ind_state();
    }
    else
        console.log("dico with unknown id", id);
});
var registerAPI = function (path, descr, args, cb) {
    apis[path] = { f: cb, descr: descr, args: args };
};
var onMessageReply = function (packet, cb) {
    if (packet.cmd == 'publish') {
        try {
            var obj = JSON.parse(packet.payload.toString());
        }
        catch (error) {
            console.log("bad payload", packet.payload.toString());
        }
        var topic = packet.topic;
        console.log('mq11 got reply packet', packet, obj);
        if (obj['mid'] in reqs) {
            var r = reqs[obj['mid']];
            r.done = true;
            if (r.cb)
                r.cb(null, obj.reply);
        }
    }
};
// onMessageMysql = (packet, cb) => {
//   if (packet.cmd == 'publish') {
//     obj = JSON.parse(packet.payload.toString())
//     topic = packet.topic.split("/")
//     //console.log('mq11 got MYSQL broadcast ', topic[3], obj)
//     if (obj.db == "user") {
//       console.log("reload users ******************", topic[3], obj._id);
//     }
//   }
// }
var onMessage = function (packet, cb) {
    if (packet.cmd == 'publish') {
        var m = packet.payload.toString();
        try {
            var msg = JSON.parse(m);
        }
        catch (error) {
            console.log("Bad payload", m);
            return;
        }
        var topic = packet.topic;
        console.log('mq11 got packet', packet, msg);
        if (msg['req']['args'][0] in apis) {
            var api = apis[msg['req']['args'][0]];
            var reply = api['f'](msg);
            if (reply == null) {
                console.log('api will reply later');
                return;
            }
            msg['reply'] = reply;
        }
        else {
            msg['reply'] = {
                error: "no api '${msg['req']['args'][0]}' at '${_id}'"
            };
        }
        aedes.publish({
            topic: "/up/".concat(msg['src'], "/").concat(msg['mid']),
            payload: JSON.stringify(msg, null, 2)
        });
    }
    cb();
};
aedes.subscribe("/dn/".concat(_id, "/+"), onMessage, function () {
    console.log('mq11 subscribed api calls');
});
aedes.subscribe("/up/".concat(_id, "/+"), onMessageReply, function () {
    console.log('mq11 subscribed req reply');
});
// aedes.subscribe('/bc/mysql/+', onMessageMysql, () => {
//   console.log('mq11 subscribed req reply')
// })
aedes.authenticate = function (client, username, password, callback) {
    var s = false;
    var ok = false;
    var id = client ? client.id : client;
    var pw = '';
    if (password)
        pw = password.toString('utf8');
    if (username)
        username = username.toString('utf8');
    console.log('Client Connecting: \x1b[33m' + id + '\x1b[0m', ': ', username, pw);
    console.log(client.conn.remoteAddress);
    console.log(client.conn.servername);
    // if (s.connected + 1 > s.max_connected) {
    //   console.log(
    // 		'too many socket connections: \x1b[31m' + (client ? client.id : client) + '\x1b[0m',
    // 		'user',
    // 		username,
    // 		'pw',
    // 		pw,
    // 		`${s.connected + 1} > ${s.max_connected}`
    // 	)
    //   var error = new Error(`too many connections ${s.connected + 1} > ${s.max_connected}`)
    //   error.returnCode = 3
    //   callback(error, false)
    //   return
    // }
    cons[id] = {
        socket: s,
        pings: 0,
        last_ping: 0,
        username: username,
        password: pw,
        pubs: [],
        pub_bytes: 0,
        pub_messages: 0,
        sub_bytes: 0,
        sub_messages: 0,
        last_pub: 0,
        last_sub: 0,
        connected: stamp(),
        remoteAddress: client.conn.remoteAddress,
        servername: client.conn.servername
    };
    if (client.req) {
        cons[id].remoteAddress = client.req.ari.remoteAddress;
        cons[id].servername = client.req.ari.servername;
    }
    console.log("USER IS OK", username, pw);
    send_ind_state();
    callback(null, true);
};
// addTopic('#', (client, sub) => {
//   id = client ? client.id : client
//   return true
// })
var certs = {};
var exec = require('child_process').exec;
console.log("Open Arm Server Starting.. ");
var init_users = function () {
    var olds;
    try {
        olds = JSON.parse(fs.readFileSync(state_fn));
    }
    catch (error) {
        olds = {};
    }
    for (var p in conf.users) {
        var pub_bytes = 0;
        var pub_messages = 0;
        var sub_bytes = 0;
        var sub_messages = 0;
        var since = stamp();
        if (conf.users[p].username in olds) {
            pub_bytes = olds[conf.users[p].username].pub_bytes;
            pub_messages = olds[conf.users[p].username].pub_messages;
            sub_bytes = olds[conf.users[p].username].sub_bytes || 0;
            sub_messages = olds[conf.users[p].username].sub_messages || 0;
            since = olds[conf.users[p].username].since;
        }
        users[conf.users[p].username] = {
            pub_bytes: pub_bytes,
            pub_messages: pub_messages,
            sub_bytes: sub_bytes,
            sub_messages: sub_messages,
            since: since,
            sessions: 0
        };
        user_stats[conf.users[p].username] = {
            pubs: [],
            subs: []
        };
    }
};
init_users();
var options = {
    SNICallback: function (servername, cb) {
        var ok = hostcheck(servername);
        if (!ok) {
            console.log("bad url at tls", servername);
            cb(null);
            return;
        }
        var key_fn = "".concat(conf.acme_home, "/").concat(servername, "/").concat(servername, ".key").replace('~', home_dir);
        var cer_fn = "".concat(conf.acme_home, "/").concat(servername, "/fullchain.cer").replace('~', home_dir);
        if (!fs.existsSync(key_fn)) {
            console.error("*** no tls file for ".concat(servername, " ").concat(key_fn, " at ").concat(__dirname));
        }
        if (!fs.existsSync(cer_fn)) {
            console.error("*** no tls files for ".concat(servername, " ").concat(cer_fn, " at ").concat(__dirname));
        }
        if (!(servername in certs)) {
            try {
                certs[servername] = tls.createSecureContext({
                    key: fs.readFileSync(key_fn),
                    cert: fs.readFileSync(cer_fn)
                });
            }
            catch (error) {
                console.log('no tls', servername);
            }
        }
        var ctx = certs[servername];
        if (!ctx) {
            console.log("Not found SSL certificate for host: ".concat(servername));
        }
        if (cb) {
            cb(null, ctx);
        }
        else {
            return ctx;
        }
    }
};
var hostcheck = function (h) {
    var hits = conf.urls.filter(function (a) { return h.match("".concat(a, "$")); });
    return (hits.length > 0);
};
var start_services = function () {
    conf.sockets.forEach(function (s) {
        s.connected = 0;
        switch (s.protocol) {
            case 'http':
                {
                    var app = express();
                    //app.use('/.well-known', express.static('.well-known'))
                    //app.use('/.well-known', proxy('localhost:9999'))
                    app.use(function (req, res, next) {
                        if (!("hostname" in req)) {
                            res.end();
                            return;
                        }
                        if (typeof req.hostname != "string") {
                            res.end();
                            return;
                        }
                        if (!hostcheck(req.hostname)) {
                            res.end();
                            return;
                        }
                        if (req.hostname.match(/\d+\.\d+\.\d+\.\d+/) || req.hostname.match(/::ffff:\d+\.\d+\.\d+\.\d+/)) {
                            res.end();
                            return;
                        }
                        if (req.path.match(/\.php$/) || req.path.match(/\.aspx$/)) {
                            res.end();
                            return;
                        }
                        var ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
                        dns.reverse(ip, function (err, result) {
                            logger("rd;;".concat(s.protocol, ";").concat(req.hostname, ";").concat(req.path, ";").concat(ip, ";0;").concat(result || ''));
                        });
                        res.redirect('https://' + req.hostname + req.path + req.url + ":" + s.https_port);
                    });
                    app.listen(s.port, function () {
                        if (s.urls)
                            Object.keys(s.urls).forEach(function (u) {
                                console.log(".. listening ".concat(s.protocol, "://").concat(u, ":").concat(s.port));
                            });
                        else
                            console.log(".. listening ".concat(s.protocol, "://*:").concat(s.port));
                    });
                }
                break;
            case 'https':
                {
                    var app = express();
                    app.set('trust proxy', 1); // trust first proxy
                    app.use(cors());
                    app.use(function (req, res, next) {
                        res.header("Access-Control-Allow-Origin", "*");
                        res.header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
                        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
                        next();
                    });
                    app.use(session({
                        secret: 'keyboard cat',
                        resave: false,
                        saveUninitialized: true,
                        genid: function (req) {
                            var id = uuidv4();
                            return id;
                        },
                        cookie: { secure: true, maxAge: 600000 }
                    }));
                    app.use(function (req, res, next) {
                        if (req.path.match(/\.php$/) || req.path.match(/\.aspx$/)) {
                            res.end();
                            return;
                        }
                        if (!("hostname" in req)) {
                            res.end();
                            return;
                        }
                        if (req.hostname.match(/\d+\.\d+\.\d+\.\d+/) || req.hostname.match(/::ffff:\d+\.\d+\.\d+\.\d+/)) {
                            console.log('ip crap', req.hostname);
                            res.end();
                            return;
                        }
                        var ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
                        if (ip.slice(0, 7) == '::ffff:')
                            ip = ip.slice(7);
                        var hit = false;
                        for (var i = 0; i < s.sites.length && !hit; i++) {
                            var site = s.sites[i];
                            for (var j = 0; j < site.urls.length && !hit; j++) {
                                if (req.hostname == site.urls[j]) {
                                    hit = site;
                                }
                            }
                        }
                        if (!hit) {
                            for (i = 0; i < s.sites.length && !hit; i++) {
                                site = s.sites[i];
                                for (j = 0; j < site.urls.length && !hit; j++) {
                                    if (req.hostname.match(site.urls[j])) {
                                        hit = site;
                                    }
                                }
                            }
                        }
                        if (hit) {
                            var p = req.path == '/' ? '/index.html' : req.path;
                            var fn = "".concat(hit.static, "/").concat(p);
                            var full_fn = path.join(conf.web_home, fn);
                            res.header('sid', req.sessionID);
                            if (p == '/conf.json') {
                                var obj = __assign({ site: hit.name, sid: req.sessionID }, web_conf);
                                if ('conf' in hit) {
                                    obj = __assign(__assign({}, hit.conf), obj);
                                }
                                res.send(JSON.stringify(obj, null, 2));
                            }
                            else if (fs.existsSync(full_fn)) {
                                var size = fs.statSync(full_fn).size;
                                dns.reverse(ip, function (err, result) {
                                    logger("ok;".concat(req.sessionID, ";").concat(hit.name, ";").concat(s.protocol, ";").concat(req.hostname, ";").concat(req.path, ";").concat(ip, ";").concat(size, ";").concat(result ||
                                        ''));
                                });
                                res.sendFile(fn, { root: conf.web_home });
                            }
                            else {
                                res.sendStatus(404);
                                dns.reverse(ip, function (err, result) {
                                    logger("nf;".concat(req.sessionID, ";;").concat(hit.name, ";").concat(s.protocol, ";").concat(req.hostname, ";").concat(req.path, ";").concat(ip, ";0;").concat(result || ''));
                                });
                            }
                        }
                        else {
                            res.sendStatus(404);
                            dns.reverse(ip, function (err, result) {
                                logger("nd;".concat(req.sessionID, ";;;").concat(s.protocol, ";").concat(req.hostname, ";").concat(req.path, ";").concat(ip, ";0;").concat(result || ''));
                            });
                        }
                    });
                    var httpsServer = https.createServer(options, app);
                    httpsServer.listen(s.port, function () {
                        s.sites.forEach(function (u) {
                            u.urls.forEach(function (uu) {
                                console.log(".. listening ".concat(s.protocol, "://").concat(uu, ":").concat(s.port));
                            });
                        });
                    });
                }
                break;
            case 'mqtt':
                {
                    var server = require('net').createServer(aedes.handle);
                    server.listen(s.port, function () {
                        console.log(".. listening ".concat(s.protocol, "://").concat(s.url, ":").concat(s.port));
                    });
                }
                break;
            case 'mqtts':
                {
                    var sserver = require('tls').createServer(options, aedes.handle);
                    sserver.listen(s.port, function () {
                        console.log(".. listening ".concat(s.protocol, "://").concat(s.url, ":").concat(s.port));
                    });
                }
                break;
            case 'ws':
                {
                    var httpServer = require('http').createServer();
                    var server = require('net').createServer(aedes.handle);
                    var verifyWsClient = function (info, cb) {
                        info.req.ari = {
                            remoteAddress: info.req.connection.remoteAddress,
                            remotePort: info.req.connection.remotePort,
                            localPort: info.req.connection.localPort,
                            protocol: 'ws'
                        };
                        cb(true);
                    };
                    ws.createServer({ server: httpServer, verifyClient: verifyWsClient }, aedes.handle);
                    httpServer.listen(s.port, function () {
                        console.log(".. listening ".concat(s.protocol, "://").concat(s.url, ":").concat(s.port));
                    });
                }
                break;
            case 'wss':
                {
                    verifyWsClient = function (info, cb) {
                        info.req.ari = {
                            remoteAddress: info.req.connection.remoteAddress,
                            remotePort: info.req.connection.remotePort,
                            localPort: info.req.connection.localPort,
                            servername: info.req.client.servername,
                            protocol: 'wss'
                        };
                        // console.log(info.req.ari);
                        cb(true);
                    };
                    var httpServers = https.createServer(options);
                    var ws_server = ws.createServer({ server: httpServers, verifyClient: verifyWsClient }, aedes.handle);
                    httpServers.listen(s.port, function () {
                        console.log(".. listening ".concat(s.protocol, "://").concat(s.url, ":").concat(s.port));
                    });
                }
                break;
            default:
                break;
        }
    });
};
start_services();
var check_certs = function () {
    for (var k in conf.urls) {
        var url = conf.urls[k];
        var key_fn = "".concat(conf.acme_home, "/").concat(url, "/").concat(url, ".key").replace('~', home_dir);
        var cer_fn = "".concat(conf.acme_home, "/").concat(url, "/fullchain.cer").replace('~', home_dir);
        if (!fs.existsSync(key_fn) || !fs.existsSync(cer_fn)) {
            //cmd = `/home/arisi/.acme.sh/acme.sh --standalone --issue -d ${url} --server letsencrypt`
            console.error("no tls files for ".concat(url, " ").concat(key_fn, " ").concat(cer_fn));
        }
        else {
            try {
                certs[url] = tls.createSecureContext({
                    key: fs.readFileSync(key_fn),
                    cert: fs.readFileSync(cer_fn)
                });
            }
            catch (error) {
                console.error('no tls for -- request', url, error);
                // exec(cmd, (error, stdout, stderr) => {
                //   if (error) {
                //     console.log(`error: ${error.message}`)
                //     return
                //   }
                //   if (stderr) {
                //     console.log(`stderr: ${stderr}`)
                //     return
                //   }
                // 	// console.log(`stdout: ${stdout}`);
                //   console.log('did cert ok for', url)
                //   try {
                //     certs[url] = tls.createSecureContext({
                //       key: fs.readFileSync(`/home/arisi/.acme.sh/${url}/${url}.key`),
                //       cert: fs.readFileSync(`/home/arisi/.acme.sh/${url}/fullchain.cer`)
                //     })
                //   } catch (error) {
                //     console.error('could not build tls for ', url)
                //   }
                // })
            }
        }
    }
};
setInterval(check_certs, 60000);
check_certs();
// setInterval(() => {
//   now = stamp()
//   for (var c in users) {
//     dlist = []
//     for (var p in user_stats[c].pubs) {
//       if (now - user_stats[c].pubs[p].stamp > 1000 * window) dlist.unshift(p)
//     }
//     dlist.forEach(p => {
//       user_stats[c].pubs.splice(p, 1)
//     })
//     dlist = []
//     for (var p in user_stats[c].subs) {
//       if (now - user_stats[c].subs[p].stamp > 1000 * window) dlist.unshift(p)
//     }
//     dlist.forEach(p => {
//       user_stats[c].subs.splice(p, 1)
//     })
//     users[c].sub_rate = user_stats[c].subs.length / window
//     users[c].pub_rate = user_stats[c].pubs.length / window
//   }
// }, 1000)
var old_cpu_usage;
var send_ind_state = function () {
    var usage = process.cpuUsage(old_cpu_usage);
    var musage = process.memoryUsage();
    old_cpu_usage = usage;
    var obj = __assign(__assign({ users: users, cons: cons, pid: process.pid, now: stamp(), start_time: start_time }, usage), musage);
    aedes.publish({
        topic: '/ind/broker/state',
        payload: JSON.stringify(obj, null, 2),
        retain: true
    });
};
setInterval(function () {
    save_state();
    send_ind_state();
}, 30000);
registerAPI('ping', "Ping", [], function (msg) {
    console.log('WE WERE PINGED - AND PONGED BACK');
    return { pong: true };
});
registerAPI("api", "Get API", [], function (msg) {
    var ret = [];
    for (var _i = 0, _a = Object.keys(apis); _i < _a.length; _i++) {
        var c = _a[_i];
        ret.push({
            cmd: c,
            descr: apis[c].descr,
            args: apis[c].args
        });
    }
    return ret;
});
registerAPI('token', "Get JWT Tokens", [], function (msg) {
    console.log('TOKEN REQ', msg, cons[msg.src]);
    var token = false;
    if (msg.src in cons) {
        token = jwt.sign({ u: cons[msg.src].username, iat: Math.floor(Date.now() / 1000) - 30 }, conf.jwt_secret, { expiresIn: '100h' });
    }
    return { token: token };
});
// setInterval(() => {
//   console.log("OLDS:", conf.users);
//   req("mysql",["select","user",["_id","username","password","acl_id","rate","max_sessions","active"],{},{}],{}, (err,ret) => {
//     if (err)
//       console.error("DUH -- USERS ERRS",err);
//     else {
//       if (ret.results) {
//         for (u of ret.results) {
//           console.log("YEE GOT USER:",u);
//           var ok = conf.users.find(user => user.username == u[1])
//           if (ok) {
//             console.log("it is old one:",ok.username);
//           } else {
//             console.log("it is a new one:");
//             var p=conf.users.push({username :u[1]})
//             p -= 1
//             console.log('init', conf.users[p].username)
//             users[conf.users[p].username] = {
//               pub_bytes: pub_bytes,
//               pub_messages: pub_messages,
//               sub_bytes: sub_bytes,
//               sub_messages: sub_messages,
//               since: since,
//               sessions: 0
//             }
//             user_stats[conf.users[p].username] = {
//               pubs: [],
//               subs: []
//             }
//           }
//         }
//       }
//     }
//   })
// },5000);
setInterval(function () {
    for (var k in reqs) {
        var r = reqs[k];
        var now = stamp();
        if (r.done)
            delete reqs[k];
        else if (now > r.sent + r.timeout) {
            if (r.retries > r.tries) {
                r.tries += 1;
                r.obj.resend = r.tries;
                console.log('resend', r);
                //publish(`/dn/${r.obj.target}/${r.obj.mid}`, r.obj);
                aedes.publish({
                    topic: "/dn/".concat(r.obj.target, "/").concat(r.obj.mid),
                    payload: JSON.stringify(r.obj, null, 2)
                });
                r.sent = now;
            }
            else {
                if (r.cb)
                    r.cb('timeout');
                r.done = true;
            }
        }
    }
}, 1000);
