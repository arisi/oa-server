#!/usr/bin/env node

const fs = require('fs')
const https = require('https')
const jwt = require('jsonwebtoken')
const ws = require('websocket-stream')
const express = require('express')
const session = require('express-session')
const cors = require('cors');
const proxy = require('express-http-proxy');

const yargs = require('yargs')
const match = require('mqtt-match')
const tls = require('tls')
const os = require('os')
const sprintf = require('sprintf')
const path = require('path')
const dns = require('dns')
const Handlebars = require("handlebars");
const chokidar = require('chokidar');

const log = console.log.bind(console);

var apis = {}
var reqs = {}
var _id = "broker"

uuidv4 = () => {
  var result, i, j
  result = ''
  for (j = 0; j < 32; j++) {
    if (j == 8 || j == 12 || j == 16 || j == 20) result = result + '-'
    i = Math.floor(Math.random() * 16).toString(16).toUpperCase()
    result = result + i
  }
  return result
}

logger = s => {
  dd = new Date(stamp()).toISOString()
  var fn = `${argv.log_dir}/${dd.slice(0, 10)}.log`
  console.log(fn, dd + ';' + s)
  if (argv.log_dir)
    fs.appendFile(fn, dd + ';' + s + '\n', () => { })
}

const home_dir = os.homedir();
const pwd = process.cwd()

const state_fn = `${home_dir}/.oa/state.json`

const argv = yargs
  .command('mq11_broker.js', 'MQ11 MQTT Broker', {})
  .option('conf', {
    description: 'Config file to use',
    type: 'string',
    default: `${home_dir}/.oa/config.json`
  })
  .option('init_conf', {
    description: 'Create Template Config file to  ~/.oa/config.json',
    type: 'boolean'
  })
  .option('log_dir', {
    description: 'Logging directory, ""=> no logging',
    type: 'string',
    default: ""
  })
  .help()
  .alias('help', 'h').argv

if (argv.init_conf) {
  var p = path.join(home_dir, ".oa")
  var key_p = path.join(home_dir, ".oa/keys")
  var src = path.join(__dirname, "../config.json")
  var key_src = path.join(__dirname, "../keys")
  var target = path.join(p, "config.json")

  console.log("\nCreating template configuration");
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p)
    console.log("Created Path", p);
  } else {
    if (fs.existsSync(target)) {
      console.error("Error: Config file Already Exists,\nwill not overwrite:", target, "\n");
      process.exit(-1)
    }
  }
  if (!fs.existsSync(key_p)) {
    fs.mkdirSync(key_p)
    console.log("Created Path", key_p);
  }
  console.log("Copying Template Config", src, "=>", target);
  console.log("Open Arm Directory:", pwd);

  var c = JSON.parse(fs.readFileSync(src).toString())
  c.server.web_home = pwd
  fs.writeFileSync(target, JSON.stringify(c, null, 2))
  for (var dom of fs.readdirSync(key_src)) {
    var ps = path.join(key_src, dom)
    var pp = path.join(key_p, dom)
    console.log("Checking Domain Path", pp);
    if (!fs.existsSync(pp)) {
      fs.mkdirSync(pp)
      console.log("Created Path", pp);
    }
    console.log("Copying Keyfiles from domain", dom);
    for (var f of fs.readdirSync(ps)) {
      var ff = path.join(ps, f)
      var tt = path.join(key_p, dom, f)
      console.log("Copying Template Config", ff, "=>", tt);
      fs.copyFileSync(ff, tt)
    }
  }
}

save_state = () => {
  fs.writeFileSync(state_fn, JSON.stringify(users, null, 2))
}

process.on('SIGINT', function() {
  console.log('\nCaught interrupt signal -- saving state')
  save_state()
  process.exit()
})

try {
  var conf = JSON.parse(fs.readFileSync(argv.conf)).server
  var web_conf = JSON.parse(fs.readFileSync(argv.conf)).web
} catch (error) {
  console.error(`Config file ${argv.conf} missing`)
  process.exit(-1)
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
  realPublished: (client, packet) => {
    if (packet && 'payload' in packet) {
      id = client ? client.id : client
    }
    // console.log("YESYSYSYSYS",packet.payload.length);
  }
}
if (conf.persistence) {
  switch (conf.persistence.type) {
    case 'redis':
      const aedesPersistenceRedis = require('aedes-persistence-redis')
      aconf.persistence = aedesPersistenceRedis({
        port: conf.persistence.port,
        host: conf.persistence.host,
        family: 4,
        password: conf.persistence.password,
        db: conf.persistence.db,
        maxSessionDelivery: 100,
        packetTTL: function(packet) {
          return 10
        }
      })
      console.log(
        `Using Redis for persistance at ${conf.persistence.host}:${conf.persistence.port} db:${conf.persistence.db}`
      )
      break
    default:
      console.error(`Unknown persistance: ${conf.persistence.type} -- No Persistance!`)
  }
} else console.log('No persistance!')
var aedes = require('aedes')(aconf)

const { stamp } = require('rt0s_js')
var start_time = stamp()

// aedes.authorizePublish = (client, packet, cb) => {
//   id = client ? client.id : client
//   console.log("authorizePublish",packet,id);
//   cb(null)
// }

var cons = {}
var users = {}
var user_stats = {}

aedes.on('client', function(client) {
})

aedes.on('ping', function(pac, client) {
  id = client ? client.id : client
  if (id in cons) {
    cons[id].pings += 1
    cons[id].last_ping = stamp()
  } else console.error('ping from nowhere?', id)
})

aedes.on('publish', (packet, client) => {
  if (packet.topic.match("/ind/.+")) {
    id = client ? client.id : client
    if (id) {
      try {
        var s = packet.payload.toString();
        var obj = JSON.parse(s);

        console.log("DUH", id, obj, cons[id]);
        cons[id].indications[JSON.parse(obj).topic]= JSON.parse(obj)

      } catch (error) {
        console.log("err",error);
      }
    }
  }
})

aedes.on('clientDisconnect', function(client) {
  id = client ? client.id : client
  console.log('Client Disconnected: \x1b[31m' + id + '\x1b[0m', 'to broker', aedes.id)
  if (id in cons && cons[id].username in users) {
    cons[id].socket.connected -= 1
    users[cons[id].username].sessions -= 1
    delete cons[id]
    send_ind_state()
  } else
    console.log("dico with unknown id", id);
})

var registerAPI = (path, descr, args, cb) => {
  apis[path] = { f: cb, descr, args }
}

onMessageReply = (packet, cb) => {
  if (packet.cmd == 'publish') {
    try {
      obj = JSON.parse(packet.payload.toString())
    } catch (error) {
      console.log("bad payload", packet.payload.toString());
    }
    topic = packet.topic
    console.log('mq11 got reply packet', packet, obj)
    if (obj['mid'] in reqs) {
      var r = reqs[obj['mid']];
      r.done = true;
      if (r.cb) r.cb(null, obj.reply);
    }
  }
}

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

onMessageInd = (packet, cb) => {
    var m = packet.payload.toString();
    try {
      var msg = JSON.parse(m)
      console.log("INDDD", m, Object.keys(msg), msg);
    } catch (error) {
      console.log("Bad payload", m);
      return;
    }

}

onMessage = (packet, cb) => {
  if (packet.cmd == 'publish') {
    var m = packet.payload.toString();
    try {
      msg = JSON.parse(m)
    } catch (error) {
      console.log("Bad payload", m);
      return;
    }
    topic = packet.topic
    console.log('mq11 got packet', packet, msg)

    if (msg['req']['args'][0] in apis) {
      var api = apis[msg['req']['args'][0]]
      var reply = api['f'](msg)

      if (reply == null) {
        console.log('api will reply later')
        return
      }
      msg['reply'] = reply
    } else {
      msg['reply'] = {
        error: "no api '${msg['req']['args'][0]}' at '${_id}'"
      }
    }
    aedes.publish({
      topic: `/up/${msg['src']}/${msg['mid']}`,
      payload: JSON.stringify(msg, null, 2)
    })
  }
  cb()
}
aedes.subscribe(`/dn/${_id}/+`, onMessage, () => {
  console.log('mq11 subscribed api calls')
})

// aedes.subscribe(`/ind/#`, onMessageInd, () => {
//   console.log('mq11 subscribed ind')
// })

aedes.subscribe(`/up/${_id}/+`, onMessageReply, () => {
  console.log('mq11 subscribed req reply')
})

// aedes.subscribe('/bc/mysql/+', onMessageMysql, () => {
//   console.log('mq11 subscribed req reply')
// })

aedes.authenticate = function(client, username, password, callback) {
  var s = false
  var ok = false

  id = client ? client.id : client
  pw = ''
  if (password) pw = password.toString('utf8')
  if (username) username = username.toString('utf8')

  console.log('Client Connecting: \x1b[33m' + id + '\x1b[0m', ': ', username, pw)

  console.log(client.conn.remoteAddress)
  console.log(client.conn.servername)

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
    servername: client.conn.servername,
    indications: {},
  }
  if (client.req) {
    cons[id].remoteAddress = client.req.ari.remoteAddress
    cons[id].servername = client.req.ari.servername
  }

  console.log("USER IS OK", username, pw);
  send_ind_state()
  callback(null, true)
}

// addTopic('#', (client, sub) => {
//   id = client ? client.id : client

//   return true
// })

const certs = {}
const { exec } = require('child_process')

console.log(`Open Arm Server Starting.. `)

init_users = () => {
  try {
    olds = JSON.parse(fs.readFileSync(state_fn))
  } catch (error) {
    olds = {}
  }
  for (var p in conf.users) {
    pub_bytes = 0
    pub_messages = 0
    sub_bytes = 0
    sub_messages = 0
    since = stamp()
    if (conf.users[p].username in olds) {
      pub_bytes = olds[conf.users[p].username].pub_bytes
      pub_messages = olds[conf.users[p].username].pub_messages
      sub_bytes = olds[conf.users[p].username].sub_bytes || 0
      sub_messages = olds[conf.users[p].username].sub_messages || 0
      since = olds[conf.users[p].username].since
    }
    users[conf.users[p].username] = {
      pub_bytes: pub_bytes,
      pub_messages: pub_messages,
      sub_bytes: sub_bytes,
      sub_messages: sub_messages,
      since: since,
      sessions: 0
    }
    user_stats[conf.users[p].username] = {
      pubs: [],
      subs: []
    }
  }
}
init_users()

const options = {
  SNICallback: (servername, cb) => {
    var ok = hostcheck(servername)
    if (!ok) {
      console.log("bad url at tls", servername)
      cb(null)
      return;
    }
    key_fn = `${conf.acme_home}/${servername}/${servername}.key`.replace('~', home_dir)
    cer_fn = `${conf.acme_home}/${servername}/fullchain.cer`.replace('~', home_dir)
    if (!fs.existsSync(key_fn)) {
      console.error(`*** no tls file for ${servername} ${key_fn} at ${__dirname}`)
    }
    if (!fs.existsSync(cer_fn)) {
      console.error(`*** no tls files for ${servername} ${cer_fn} at ${__dirname}`)
    }
    if (!(servername in certs)) {
      try {
        certs[servername] = tls.createSecureContext({
          key: fs.readFileSync(key_fn),
          cert: fs.readFileSync(cer_fn)
        })
      } catch (error) {
        console.log('no tls', servername)
      }
    }
    const ctx = certs[servername]
    if (!ctx) {
      console.log(`Not found SSL certificate for host: ${servername}`)
    }
    if (cb) {
      cb(null, ctx)
    } else {
      return ctx
    }
  }
}

var hostcheck = (h) => {
  var hits = conf.urls.filter(a => h.match(`${a}$`))
  return (hits.length > 0)
}

var build_index = (site) => {
  var s = ""

  var tags = []
  var tag = (t, obj, body) => {
    var o = ""
    if (obj)
      for (k of Object.keys(obj)) {
        o += ` ${k}="${obj[k]}"`;
      }
    if (['html', 'head', 'body'].indexOf(t) != -1) {
      s += `<${t}>\n`
      tags.push(t)
    } else if (['script', 'input'].indexOf(t) != -1) {
      s += `<${t}${o}>`
      if (body)
        s += body;
      s += `</${t}>\n`
    } else
      s += `<${t}${o}>\n`
  }
  var ctag = () => {
    s += `</${tags.pop()}>\n`
  }
  tag("html")
  tag("head")
  var scripts = [
    "https://cdnjs.cloudflare.com/ajax/libs/sprintf/1.1.2/sprintf.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/handlebars.js/4.7.7/handlebars.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/mqtt/4.3.7/mqtt.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/json5/2.2.1/index.min.js",
    "https://cdn.jsdelivr.net/npm/oa-server/cdn/rt0s_web.js",
    "https://cdnjs.cloudflare.com/ajax/libs/require.js/2.3.6/require.min.js",
    "oaf.js"
  ]
  for (var script of scripts)
    tag("script", { src: script })
  tag("link", { rel: 'preload', href: 'conf.json', as: 'fetch', type: "application/json", crossorigin: "anonymous" })
  var p = path.join(conf.web_home, site.static, "dynamic")
  var preloads = fs.readdirSync(p)
  for (var preload of preloads)
    tag("link", { rel: 'preload', href: preload, as: 'fetch', type: "text/html", crossorigin: "anonymous" })
  tag("script", {}, `\nwindow.preloads=${JSON.stringify(preloads, null, 2)};\n`)
  ctag()
  tag("body")
  ctag()
  ctag()
  return s;
}

var start_services = () => {
  conf.sockets.forEach(s => {
    s.connected = 0
    switch (s.protocol) {
      case 'http':
        {
          var app = express()
          //app.use('/.well-known', express.static('.well-known'))
          //app.use('/.well-known', proxy('localhost:9999'))
          app.use((req, res, next) => {
            if (!("hostname" in req)) {
              res.end()
              return
            }
            if (typeof req.hostname != "string") {
              res.end()
              return
            }

            if (!hostcheck(req.hostname)) {
              res.end()
              return
            }
            if (req.hostname.match(/\d+\.\d+\.\d+\.\d+/) || req.hostname.match(/::ffff:\d+\.\d+\.\d+\.\d+/)) {
              res.end()
              return
            }
            if (req.path.match(/\.php$/) || req.path.match(/\.aspx$/)) {
              res.end()
              return
            }
            var ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
            dns.reverse(ip, function(err, result) {
              logger(`rd;;${s.protocol};${req.hostname};${req.path};${ip};0;${result || ''}`)
            })
            //res.redirect(('https://' + req.hostname + req.path + req.url + ":" + s.https_port).replace("://",""))
            res.redirect(('https://' + req.hostname + req.path + req.url))
          })
          app.listen(s.port, () => {
            if (s.urls)
              Object.keys(s.urls).forEach(u => {
                console.log(`.. listening ${s.protocol}://${u}:${s.port}`)
              })
            else
              console.log(`.. listening ${s.protocol}://*:${s.port}`)
          })
        }
        break
      case 'https':
        {
          var app = express()
          app.set('trust proxy', 1) // trust first proxy
          app.use(cors());
          app.use(function(req, res, next) {
            res.header("Access-Control-Allow-Origin", "*");
            res.header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            next();
          });
          app.use(
            session({
              secret: 'keyboard cat',
              resave: false,
              saveUninitialized: true,
              genid: function(req) {
                var id = uuidv4()
                return id
              },
              cookie: { secure: true, maxAge: 600000 }
            })
          )
          app.use((req, res, next) => {
            if (req.path.match(/\.php$/) || req.path.match(/\.aspx$/)) {
              res.end()
              return
            }
            if (!("hostname" in req)) {
              res.end()
              return
            }

            if (req.hostname.match(/\d+\.\d+\.\d+\.\d+/) || req.hostname.match(/::ffff:\d+\.\d+\.\d+\.\d+/)) {
              console.log('ip crap', req.hostname)
              res.end()
              return
            }
            var ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
            if (ip.slice(0, 7) == '::ffff:') ip = ip.slice(7)
            hit = false
            for (i = 0; i < s.sites.length && !hit; i++) {
              site = s.sites[i]
              for (j = 0; j < site.urls.length && !hit; j++) {
                if (req.hostname == site.urls[j]) {
                  hit = site
                }
              }
            }
            if (!hit) {
              for (i = 0; i < s.sites.length && !hit; i++) {
                site = s.sites[i]
                for (j = 0; j < site.urls.length && !hit; j++) {
                  if (req.hostname.match(site.urls[j])) {
                    hit = site
                  }
                }
              }
            }
            if (hit) {
              var p = req.path == '/' ? '/index.html' : req.path
              var fn = `${hit.static}/${p}`
              var full_fn = path.join(conf.web_home, fn)
              var ext = fn.split(".").pop();
              var base = fn.substr(0, fn.length - ext.length - 1);
              //console.log("ext", ext, base);
              res.header('sid', req.sessionID)
              if (p == '/conf.json') {
                obj = {
                  site: hit.name,
                  sid: req.sessionID,
                  ...web_conf,
                }
                if ('conf' in hit) {
                  obj = {
                    ...hit.conf,
                    ...obj
                  }
                }
                res.send(JSON.stringify(obj, null, 2))
              } else if (p == '/index.html' && !fs.existsSync(full_fn)) {
                res.send(build_index(hit))
                return;
              } else if (fs.existsSync(full_fn)) {
                var size = fs.statSync(full_fn).size
                dns.reverse(ip, function(err, result) {
                  logger(
                    `ok;${req.sessionID};${hit.name};${s.protocol};${req.hostname};${req.path};${ip};${size};${result ||
                    ''}`
                  )
                })
                res.sendFile(fn, { root: conf.web_home })
              } else {
                var pext = p.split(".").pop();
                var pbase = p.substr(0, p.length - pext.length - 1);
                var html_fn = path.join(conf.web_home, hit.static, "dynamic", p)
                //console.log("dyn html?", html_fn);
                if (fs.existsSync(html_fn)) {
                  res.sendFile(html_fn)
                  return
                }
                if (ext == 'html') {
                  var hb_fn = path.join(conf.web_home, hit.static, "dynamic", pbase + ".hbs")
                  //console.log("dyn", hb_fn);
                  if (fs.existsSync(hb_fn)) {
                    var ss = fs.readFileSync(hb_fn);
                    const template = Handlebars.compile(ss.toString());
                    res.send(template({ name: "Nils" }));
                    return;
                  }
                }
                res.sendStatus(404)
                dns.reverse(ip, function(err, result) {
                  logger(
                    `nf;${req.sessionID};;${hit.name};${s.protocol};${req.hostname};${req.path};${ip};0;${result || ''}`
                  )
                })
              }
            } else {
              res.sendStatus(404)
              dns.reverse(ip, function(err, result) {
                logger(`nd;${req.sessionID};;;${s.protocol};${req.hostname};${req.path};${ip};0;${result || ''}`)
              })
            }
          })
          var httpsServer = https.createServer(options, app)
          httpsServer.listen(s.port, () => {
            s.sites.forEach(u => {
              u.urls.forEach(uu => {
                console.log(`.. listening ${s.protocol}://${uu}:${s.port}`)
              })
              var p = path.join(conf.web_home, u.static, "dynamic")

              var update = (p, event, u, path) => {
                var fn = path.substr(p.length + 1)
                var payload = ""
                if (event != 'deleted')
                  payload = fs.readFileSync(path).toString()
                var obj = {
                  event,
                  fn,
                  payload
                }
                var topic = `/ind/site_${u.name}/updates`
                aedes.publish({
                  topic,
                  payload: JSON.stringify(obj),
                  retain: false,
                })
              }

              chokidar.watch(p, {
                ignored: /(^|[\/\\])\../, // ignore dotfiles
                persistent: true
              })
                .on('error', (error) => log(`Watcher error: ${error}`))
                .on('ready', () => log(`.. watching ${p}`))
                .on('raw', (event, path, details) => { // internal
                  if (details.type == 'file')
                    switch (event) {
                      case 'created':
                      case 'modified':
                        update(p, event, u, path);
                        break;
                      case 'deleted':
                        update(p, event, u, path);
                        break;
                      case 'moved':
                        if (fs.existsSync(path)) {
                          update(p, 'created', u, path);
                        } else {
                          update(p, 'deleted', u, path);
                        }
                        break;
                      default:
                        log('Raw event info:', event, path, details);
                    }
                  else
                    log('non-file Raw event info:', event, path, details);
                });

            })
          })
        }
        break
      case 'mqtt':
        {
          const server = require('net').createServer(aedes.handle)
          server.listen(s.port, () => {
            console.log(`.. listening ${s.protocol}://${s.url}:${s.port}`)
          })
        }
        break
      case 'mqtts':
        {
          const sserver = require('tls').createServer(options, aedes.handle)
          sserver.listen(s.port, () => {
            console.log(`.. listening ${s.protocol}://${s.url}:${s.port}`)
          })
        }
        break
      case 'ws':
        {
          const httpServer = require('http').createServer()
          const server = require('net').createServer(aedes.handle)
          verifyWsClient = (info, cb) => {
            info.req.ari = {
              remoteAddress: info.req.connection.remoteAddress,
              remotePort: info.req.connection.remotePort,
              localPort: info.req.connection.localPort,
              protocol: 'ws'
            }
            cb(true)
          }
          ws.createServer({ server: httpServer, verifyClient: verifyWsClient }, aedes.handle)
          httpServer.listen(s.port, function() {
            console.log(`.. listening ${s.protocol}://${s.url}:${s.port}`)
          })
        }
        break
      case 'wss':
        {
          verifyWsClient = (info, cb) => {
            info.req.ari = {
              remoteAddress: info.req.connection.remoteAddress,
              remotePort: info.req.connection.remotePort,
              localPort: info.req.connection.localPort,
              servername: info.req.client.servername,
              protocol: 'wss'
            }
            // console.log(info.req.ari);
            cb(true)
          }
          const httpServers = https.createServer(options)
          const ws_server = ws.createServer({ server: httpServers, verifyClient: verifyWsClient }, aedes.handle)
          httpServers.listen(s.port, function() {
            console.log(`.. listening ${s.protocol}://${s.url}:${s.port}`)
          })
        }
        break
      default:
        break
    }
  })
}

start_services()

check_certs = () => {
  for (k in conf.urls) {
    var url = conf.urls[k]
    var key_fn = `${conf.acme_home}/${url}/${url}.key`.replace('~', home_dir)
    var cer_fn = `${conf.acme_home}/${url}/fullchain.cer`.replace('~', home_dir)
    if (!fs.existsSync(key_fn) || !fs.existsSync(cer_fn)) {
      //cmd = `/home/arisi/.acme.sh/acme.sh --standalone --issue -d ${url} --server letsencrypt`
      console.error(`no tls files for ${url} ${key_fn} ${cer_fn}`)
    } else {
      try {
        certs[url] = tls.createSecureContext({
          key: fs.readFileSync(key_fn),
          cert: fs.readFileSync(cer_fn)
        })
      } catch (error) {
        console.error('no tls for -- request', url, error)
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
}
setInterval(check_certs, 60000)
check_certs()

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

var old_cpu_usage

var send_ind_state = () => {
  var usage = process.cpuUsage(old_cpu_usage)
  var musage = process.memoryUsage()
  old_cpu_usage = usage
  var obj = {
    topic: "state",
    users: users,
    cons: cons,
    pid: process.pid,
    now: stamp(),
    start_time: start_time,
    ...usage,
    ...musage
  }
  aedes.publish({
    topic: '/ind/broker/state',
    payload: JSON.stringify(obj),
    retain: true,
  })
}

setInterval(() => {
  save_state()
  send_ind_state()
}, 30000)

registerAPI('ping', "Ping", [], msg => {
  console.log('WE WERE PINGED - AND PONGED BACK')
  return { pong: true }
})

registerAPI("api", "Get API", [], (msg) => {
  var ret = []
  for (var c of Object.keys(apis)) {
    ret.push({
      cmd: c,
      descr: apis[c].descr,
      args: apis[c].args,
    })
  }
  return ret;
})

registerAPI('token', "Get JWT Tokens", [], msg => {
  console.log('TOKEN REQ', msg, cons[msg.src])

  var token = false
  if (msg.src in cons) {
    token = jwt.sign({ u: cons[msg.src].username, iat: Math.floor(Date.now() / 1000) - 30 }, conf.jwt_secret, { expiresIn: '100h' })
  }
  return { token: token }
})


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

setInterval(() => {
  for (var k in reqs) {
    var r = reqs[k];
    const now = stamp();
    if (r.done) delete reqs[k];
    else if (now > r.sent + r.timeout) {
      if (r.retries > r.tries) {
        r.tries += 1;
        r.obj.resend = r.tries;
        console.log('resend', r);
        //publish(`/dn/${r.obj.target}/${r.obj.mid}`, r.obj);
        aedes.publish({
          topic: `/dn/${r.obj.target}/${r.obj.mid}`,
          payload: JSON.stringify(r.obj, null, 2)
        })

        r.sent = now;
      } else {
        if (r.cb) r.cb('timeout');
        r.done = true;
      }
    }
  }
}, 1000);