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

//var mysql = require('mysql');

//var mysql_con = undefined

apis = {}
reqs = {};

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

var _id = "broker"

var req = (target, msg, options, cb) => {
  var obj = {
    mid: uuidv4(),
    src: _id,
    target: target,
    req: { args: msg },
  };
  reqs[obj['mid']] = {
    obj: obj,
    cb: (err, ret) => {
      if (err)
        console.log("req cb wrapper ERR:", err);
      else if ("error" in ret) {
        console.log('wrapper got error from mysql', ret.error)
      }
      cb(err, ret);
    },
    done: false,
    created: stamp(),
    sent: stamp(),
    tries: 1,
    retries: 'retries' in options ? options.tries : 1,
    timeout: 'timeout' in options ? options.timeout : 3000,
  };
  //publish(`/dn/${target}/${obj['mid']}`, obj);
  aedes.publish({
    topic: `/dn/${target}/${obj['mid']}`,
    payload: JSON.stringify(obj, null, 2)
  })
};

logger = s => {
  dd = new Date(stamp()).toISOString()
  var fn = `${argv.log_dir}/${dd.slice(0, 10)}.log`
  console.log(fn, dd + ';' + s)
  if (argv.log_dir)
    fs.appendFile(fn, dd + ';' + s + '\n', () => { })
}

const home_dir = os.homedir();

const state_fn = `${home_dir}/.rt0s/state.json`

const argv = yargs
  .command('mq11_broker.js', 'MQ11 MQTT Broker', {})
  .option('conf', {
    description: 'Config file to use',
    type: 'string',
    default: `${home_dir}/.rt0s/config.json`
  })
  .option('log_dir', {
    description: 'Logging directory, ""=> no logging',
    type: 'string',
    default: ""
  })
  .help()
  .alias('help', 'h').argv

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

var cert = fs.readFileSync('keys/dummy_pub.key')
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

// aedes.on('publish', (packet, client) => {
//   if (!packet.topic.match("/bc/.+")) {
//     id = client ? client.id : client
//     var s=packet.payload.toString()
//     packet.payload= ""

//     console.log("PUB",id, packet.topic,s);
//   }
// })

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
  apis[path] = { f: cb, descr, args}
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

onMessage = (packet, cb) => {
  if (packet.cmd == 'publish') {
    var m = packet.payload.toString();
    try {
      msg = JSON.parse(m)
    } catch (error) {
      console.log("Bad payload",m);
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
    servername: client.conn.servername
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
    key_fn = `${conf.acme_home}/${servername}/${servername}.key`
    cer_fn = `${conf.acme_home}/${servername}/fullchain.cer`
    if (!fs.existsSync(key_fn)) {
      console.error(`*** no tls file for ${servername} ${key_fn} at ${ __dirname }`)
    }
    if (!fs.existsSync(cer_fn)) {
      console.error(`*** no tls files for ${servername} ${cer_fn} at ${ __dirname }`)
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
            res.redirect('https://' + req.hostname +req.path + req.url+ ":" + s.https_port)
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
                return id // use UUIDs for session IDs
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
              } else if (fs.existsSync(fn)) {
                var size = fs.statSync(fn).size
                dns.reverse(ip, function(err, result) {
                  logger(
                    `ok;${req.sessionID};${hit.name};${s.protocol};${req.hostname};${req.path};${ip};${size};${result ||
                    ''}`
                  )
                })
                res.sendFile(fn, { root: '.' })
              } else {
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
    var key_fn = `${conf.acme_home}/${url}/${url}.key`
    var cer_fn = `${conf.acme_home}/${url}/fullchain.cer`
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
    payload: JSON.stringify(obj, null, 2),
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
  var ret=[]
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