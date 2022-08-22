#!/usr/bin/env node

const SerialPort = require('serialport').SerialPort
const { SerialPortStream } = require('@serialport/stream')
const { autoDetect } = require('@serialport/bindings-cpp')
const binding = autoDetect()
const { DelimiterParser } = require('@serialport/parser-delimiter')
const { ReadlineParser } = require('@serialport/parser-readline')
const readline = require('readline');
const sprintf = require('sprintf');
const yargs = require('yargs');
const srec = require('./srec');
const util = require('./util');
const mqttsn = require("./mqttsn_lib.js")
const hdlc = require("./hdlc.js")
const JSON5 = require('json5');
const fs = require('fs');
const Rt0s = require("./rt0s_node.js").Rt0s

var onChange = async (s:boolean) => {
  if (s)
    console.log("ONLINE");
  else
    console.log("OFFLINE");
}
var reqs:any = {}

var hdlc_pings = 0
var hdlc_ping_stamp = 0
const ACK = 0xCC
const NACK = 0x33
const BAUDS = 115200
var logf = false

var phase = 1;
var port: any
var cmd_in_progress: any = null
var cmd_in_buf: any = []
var cmd_res:any
var cmd_err:any
var cmd_timeout:number
var init_res:any = null
var term_on = false
var hdlc_on = false

var MCU = null
var MCUS = [
  {
    id: 0x00F00230, name: "CC2652",
    flash_start: 0, flash_size: 0x00058000, flash_block: 0x2000,
    ram_start: 0x20000000, ram_size: 0x14000
  },
]

const argv = yargs
  .option('port', {
    alias: 'p',
    description: 'Port to Use',
    type: 'string'
  })
  .option('cmd', {
    alias: 'c',
    description: 'Commands to run',
    type: 'string'
  })
  .option('quiet', {
    alias: 'q',
    description: 'Suppress Console Prints',
    type: 'boolean'
  })
  .option('debug', {
    alias: 'd',
    description: 'Debug HDLC Protocol',
    type: 'boolean'
  })
  .option('log', {
    description: 'Log File Name',
    type: 'string'
  })
  .option('client_id', {
    description: 'MQTT Client ID',
    type: 'string',
    default: 'DUT'
  })
  .option('schema', {
    description: 'JSON Schema of MQTT Messages',
    type: 'string',
  })
  .help()
  .alias('help', 'h').argv;

if (argv.log) {
  fs.writeFileSync(argv.log + ".txt", "")
  fs.writeFileSync(argv.log + ".r.txt", "")
  logf = fs.openSync(argv.log + ".txt", "w")
}
var schema = mqttsn.init(argv.schema)

var mq = new Rt0s("mqtt://localhost:1884", argv.client_id, "arska", "zilakka", onChange)


var do_cmd_dmp = async (args:any) => {
  var ret = await do_cmd("MEMORY_READ", args);
  util.dump(false, args.a, ret.d)
}

var do_cmd_dmpw = async (args:any) => {
  var ret = await do_cmd("MEMORY_READW", args);
  util.dumpw(false, args.a, ret.d)
}

var do_cmd_stat = async () => {
  var ret = await do_cmd("STATUS");
  switch (ret.status) {
    case 0x40:
      break
    case 0x41:
      console.log("Unknown Command");
      break
    case 0x42:
      console.log("Invalid Command");
      break
    case 0x43:
      console.log("Invalid Address");
      break
    case 0x44:
      console.log("Flash Fail");
      break
    default:
      console.log(`Unknown Status: ${ret.status}`);
      break
  }
  return ret.status == 0x040
}

var do_cmd_help = () => {
  for (var c of Object.keys(COMMANDS).sort()) {
    if (COMMANDS[c].hide)
      continue
    var s = c + " "
    for (var a of COMMANDS[c].args) {
      if (a.hide)
        continue
      s += `${a.n}=${"default" in a ? a.default : ""} `
    }
    console.log(s);
  }
}

var port_write = (data: any, info?: string ) => {
  if (hdlc_on && argv.debug) {
    logger("W", data, info)
  }
  port.write(data)
}

var do_cmd_init = () => {
  return new Promise(async (res, err) => {
    rl.prompt(false)
    console.log(".. press RESET...");
    phase = 0;
    cmd_in_progress = null
    port_write(Buffer.from([0x55, 0x55]))
    init_res = res
  })
}

var do_cmd_flash = async (args:any) => {
  var srec_data:any,ret
  try {
    srec_data = srec.read(args.fn);
  } catch (error) {
    console.log("Cannot Open Srec File: ", args.fn);
    return
  }
  await do_cmd("erase", {});
  console.log("Erased..");
  var b, tot = 0
  for (b of srec_data.blocks) {
    process.stdout.write(sprintf("%08X:%02X %3d%% \r", b[0], b[1].length, (100 * tot) / srec_data.tot));
    ret = await do_cmd("DOWNLOAD", { a: b[0], n: b[1].length });
    ret = await do_cmd("SEND_DATA", { d: b[1] });
    tot += b[1].length
  }
  console.log(`Flashed ${tot} bytes from ${sprintf("0x%08X", srec_data.min_a)} to ${sprintf("0x%08X", srec_data.max_a)}`);

  ret = await do_cmd("cfg", { id: 0x0b, value: 0xc5 });
  ret = await do_cmd("cfg", { id: 0x0c, value: 15 }); // sets pin for bootloader activation
  ret = await do_cmd("cfg", { id: 0x0d, value: 1 });  // and state
  ret = await do_cmd("cfg", { id: 0x01, value: 0 });  // vec base
  await do_cmd_dmpw({ a: 0, n: 12 })
  console.log("\nConfigured for boot..");
  await do_cmd_dmpw({ a: 0x00057FD0, n: 8 })
}


var do_cmd:any

var do_cmd_term = async (args:any) => {
  return new Promise(async (res, err) => {
    do_cmd("reset", {});
    console.log("----------------- to Terminal Mode:\n");
    setTimeout(() => {
      term_on = true;
      hdlc_on = false;
    }, 10)
  })
}

var do_cmd_hdlc = async () => {
  return new Promise(async (res) => {
    //  do_cmd("reset", {});
    console.log("----------------- to HDLC Mode:\n");
    //setTimeout(() => {
    hdlc_on = true;
    term_on = false;
    hdlc_pings = 0
    hdlc_ping_stamp = 0
    //}, 1)
    res(null)
  })
}

var COMMANDS:any = {
  ping: { b: 0x20, args: [], ret: [] },
  dmp: { f: do_cmd_dmp, args: [{ n: "a", size: 4 }, { n: "n", size: 4, default: 0x10 }] },
  dmpw: { f: do_cmd_dmpw, args: [{ n: "a", size: 4 }, { n: "n", size: 4, default: 0x10 }] },
  '?': { f: do_cmd_help, args: [] },
  init: { f: do_cmd_init, args: [] },
  stat: { f: do_cmd_stat, args: [] },
  term: { f: do_cmd_term, args: [] },
  hdlc: { f: do_cmd_hdlc, args: [] },
  flash: { f: do_cmd_flash, args: [{ n: "fn", string: true }] },
  q: { f: () => { process.exit(0) }, args: [] },
  DOWNLOAD: { b: 0x21, args: [{ n: "a", size: 4 }, { n: "n", size: 4 }], ret: [], hide: true },
  STATUS: { b: 0x23, args: [], ret: [{ n: "status", size: 1 }] },
  SEND_DATA: { b: 0x24, args: [{ n: "d", size: 1, array: true }], ret: [], hide: true },
  reset: { b: 0x25, args: [], ret: [] },
  //SECTOR_ERASE: { b: 0x26, args: [{ n: "a", size: 4 }], ret: [] },
  //CRC32: { b: 0x27, args: [{ n: "a", size: 4 }, { n: "n", size: 4 }, { n: "repeat", size: 4 }], ret: [] },
  ID: { b: 0x28, args: [], ret: [{ n: "id", size: 4 }] },
  MEMORY_READ: {
    b: 0x2A, args: [{ n: "a", size: 4 }, { n: "type", size: 1, default: 0 }, { n: "n", size: 1, max: 0xfd }],
    ret: [{ n: "d", size: 1, array: true },], hide: true
  },
  MEMORY_READW: {
    b: 0x2A, args: [{ n: "a", size: 4 }, { n: "type", size: 1, default: 1 }, { n: "n", size: 1, max: 0x3f }],
    ret: [{ n: "d", size: 4, array: true },], hide: true
  },
  wrt: {
    b: 0x2B, args: [{ n: "a", size: 4 }, { n: "type", size: 1, default: 0, hide: true }, { n: "d", size: 1, array: true }],
    ret: []
  },
  wrtw: {
    b: 0x2B, args: [{ n: "a", size: 4 }, { n: "type", size: 1, default: 1, hide: true }, { n: "d", size: 4, array: true }],
    ret: []
  },
  erase: { b: 0x2C, args: [], ret: [] },
  cfg: { b: 0x2D, args: [{ n: "id", size: 4 }, { n: "value", size: 4 }], ret: [] },
  //DOWNLOAD_CRC: { b: 0x2F, args: [] }
}


process.stdin.on('data', (chunk) => {
  if (term_on)
    port_write(Buffer.from([chunk[0]]))
})

var do_term_in = (ch:number) => {
  process.stdout.write((String.fromCharCode(ch)))
}

var log_start:number = 0
var log_prev:number = 0

var logger = (verb:string , data:any , info?:string ) => {
  if (!argv.debug)
    return
  if (verb == "R") {
    var s = ""
    for (var ch of data) {
      s += sprintf("%02X ", ch)
      if (ch == 0x7e)
        s += "\n"
    }
    fs.write(logf, s, () => {
      fs.fdatasync(logf, () => { })
    })
  }
  var now = util.stamp()
  if (log_start == 0) {
    log_start = now
    log_prev = now
  }
  s = sprintf("%7.3f %7.3f %s:", (now - log_start) / 1000, (now - log_prev) / 1000, verb)
  for (ch of data)
    s += sprintf("%02X ", ch)
  if (info)
    s += info
  //console.log(s);
  if (argv.log) {
    fs.write(logf, s + "\n", () => {
      fs.fdatasync(logf, () => { })
    })

  }
  log_prev = now
}

var do_hdlc_in = (data:any) => {
  //decode here
  hdlc.got(data, (err:any, frame:any, info:any) => {
    //console.log("got frame from dut", err, frame);
    if (err) {
      if (err == "PING") {
        //console.log("HDLC PING");
        hdlc_pings += 1
        hdlc_ping_stamp = util.stamp()
        return;
      } else {
        var msg = mqttsn.decode(frame)
        logger("Z", frame, "bad crc: " + info + ": " + JSON.stringify(msg))
        return;
      }
    }
    msg = mqttsn.decode(frame)
    logger("H", frame, JSON.stringify(msg) + " " + info)
    if ((msg.rseq >= 0) && (reqs[msg.rseq]) && (!msg.watch_index)) { //todo: skip 0-rseq values ?
      //console.log("hit", reqs[msg.rseq]);
      mq.reply(reqs[msg.rseq], msg)
      delete (reqs[msg.rseq])
    } else {
      if (msg.topic) {
        if (msg.topic == "log") {
          var s = ""
          for (var c of msg.data)
            s += String.fromCharCode(c)
          console.log(`>${msg.level}>${s}`);
        }
        mq.send_ind(msg.topic, msg)
      }
    }
  })
  //process.stdout.write((String.fromCharCode(ch)))
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: ']',
});

var main = async (pfn: string) => {
  if (!argv.quiet)
    console.log(`\nTI CC2652 Bootloader on Port ${pfn} with ${BAUDS} Bauds`);
  port = new SerialPortStream({
    binding,
    path: pfn,
    baudRate: BAUDS,
    parity: 'none',
    stopBits: 1
  });
  port.on('error', function (err: any) {
    console.log(err);
    console.error("Bad port", pfn);
    process.exit(1)
  });
  //const parser = port.pipe(new DelimiterParser({ delimiter: 0x7e }))
  //const parser = port.pipe(new delimiter({ delimiter: '\n' }));
  /*const parser = port.pipe(new ReadlineParser({ delimiter: 0x7e }));
  parser.on('data', (data) => {
    console.log('dataReady', data);
  });*/

  var check_buf = () => {
    var blen = cmd_in_buf.length
    if (cmd_in_buf[0] == NACK && blen) {
      console.log("NACK");
    } else if (blen == 1 && cmd_in_buf[0] == ACK && cmd_in_progress.ret.length == 0) {
      cmd_in_progress = null
      cmd_res([])
    } else if (blen > 2 && cmd_in_buf[0] == ACK && blen) {
      var len = cmd_in_buf[1];
      if (blen == len + 1) {
        var crc = cmd_in_buf[2];
        cmd_in_buf.shift()
        cmd_in_buf.shift()
        cmd_in_buf.shift()
        var check = 0
        for (var d of cmd_in_buf)
          check += d
        check = check & 0xff
        var ret:any = [...cmd_in_buf]
        cmd_in_buf = []
        if (check != crc) {
          cmd_err("crc error")
          return
        }
        var p = 0, obj:any = { raw: ret }
        for (var r of cmd_in_progress.ret) {
          if (r.size == 1) {
            if (r.array) {
              obj[r.n] = []
              for (var i = p; i < ret.length; i++) {
                obj[r.n].push(ret[p])
                p += 1
              }
            } else {
              obj[r.n] = ret[p];
              //obj[`${r.n}_hex`] = sprintf("0x%02X", obj[r.n]);
              p += 1
            }
          } else if (r.size == 4) {
            if (r.array) {
              obj[r.n] = []
              for (i = p; i < ret.length / 4; i++) {
                obj[r.n].push(ret[p] + ret[p + 1] * 0x100 + ret[p + 2] * 0x10000 + ret[p + 3] * 0x1000000)
                p += 4
              }
            } else {
              obj[r.n] = ret[p] + ret[p + 1] * 0x100 + ret[p + 2] * 0x10000 + ret[p + 3] * 0x1000000
              obj[`${r.n}_hex`] = sprintf("0x%08X", obj[r.n]);
              p += r.size;
            }
          }
        }
        cmd_in_progress = null
        port_write(Buffer.from([ACK]))
        cmd_res(obj)
      }
    }
  }

  port.on('readable', () => {
    var d = port.read();
    if (d) {
      if (d.length != 2 && hdlc_on && argv.debug) {
        logger("R", d)
      }
      if (hdlc_on) {
        do_hdlc_in(d)
      }
      for (var b of d) {
        if (term_on) {
          do_term_in(b)
        } else if (cmd_in_progress) {
          if (cmd_in_buf.length || b) {
            cmd_in_buf.push(b)
            check_buf()
          }
        } else
          if (b == 0x33) {
            // console.log("NAK");
          }
          else if (b == 0xcc) {
            if (phase == 0) {
              console.log("..Inited ok, ready");
              phase = 1;
              if (init_res)
                init_res(true)
              init_res = null
            } else if (cmd_in_progress) {
              phase = 2;
            }
          }
      }
    }
  })

  mq.registerAPI('send', "Sends a message to DUT", [], (msg:any) => {
    console.log("send...", msg.req.args[1]);
    //line = JSON5.parse('{topic:"read8", address:0, data_len:4}')
    var id:string, buf
    [id, buf] = mqttsn.encode(msg.req.args[1])
    var check = mqttsn.decode(buf)
    var frame = hdlc.send(Buffer.from(buf))
    port_write(Buffer.from(frame))

    //return { sent: true };
    reqs[id] = msg
    return null;
  });
  mq.registerAPI('hdlc_status', "Get HDLC Status", [], (msg:any) => {
    return { active: hdlc_on, pings: hdlc_pings, stamp: hdlc_ping_stamp };
  });
  mq.registerAPI('ping', "Ping and get HDLC Status", [], (msg:any) => {
    return { active: hdlc_on, pings: hdlc_pings, stamp: hdlc_ping_stamp };
  });
  mq.registerAPI('mod_flash', "Flash a Module", ['srec'], async (msg:any) => {
    console.log("flashin module", msg['req']['args']);
    var srec_fn = msg['req']['args'][1]['srec']
    var srec_data:any = srec.read(srec_fn);
    if (srec_data.error) {
      return (srec_data);
    }
    if (srec_data.tot == 0) {
      return ({ 'error': `Empty SREC contents: '${srec_fn}'` });
    }
    console.log("flashin:", srec_fn);
    console.log(sprintf("from:  0x%08X", srec_data.min_a));
    console.log(sprintf("from:  0x%08X", srec_data.min_a));
    console.log(sprintf("bytes: %d", srec_data.tot));
    var ok = true
    for (var blk of srec_data.blocks) {
      console.log(sprintf("f:0x%08X", blk[0]));
      var ret = await mq.req("tif", ['write8', { address: blk[0], data_len: blk[1].length, data: blk[1] }], {})
      if (!ret.success) {
        console.log("failed", ret);
        ok = false
        break
      }
    }
    console.log("Written");
    return { 'done': ok, "written": srec_data.tot };
    return { done: false };
  });
  if (schema && 'messages' in schema)
    var value: any
    var key:string
    for ([key, value] of Object.entries(schema.messages)) {
      if (value.direction == 'down') {
        //console.log(`msg '${key}':`, value);
        var args = []
        for (var p of value.payload)
          args.push(p.name)
        mq.registerAPI(key, value.descr, args, (msg:any) => {
          var obj = {
            topic: msg.req.args[0],
            ...msg.req.args[1],
          }
          //console.log("got api call:", msg, obj);
          var [id, s] = mqttsn.encode(obj)
          var check = mqttsn.decode(s)
          //console.log("check:", msg, id, s);
          var buf = hdlc.send(Buffer.from(s))
          port_write(Buffer.from(buf), JSON.stringify(check))
          reqs[id] = msg
          return null
        })
      }
    }


  var do_line = async (line: string) => {
    if (term_on) {
      if (line != "q" && line != "hdlc")
        return
    }
    if (hdlc_on) {
      if (line != "q" && line != "term") {

        //line = JSON5.parse('{topic:"read8", address:0x0,data_len:4}')
        line = JSON5.parse(line)
        var a, buf
        [a, buf] = mqttsn.encode(line)
        var check = mqttsn.decode(buf)
        var frame = hdlc.send(Buffer.from(buf))
        port_write(Buffer.from(frame))
        return
      }
    }
    line = line.trim()
    if (line == "") {
      rl.prompt(true)
      return
    }
    var p = line.split(" ")
    var cmd = p.shift()
    var args:any = {}
    for (a of p) {
      var pp = a.split("=")
      if (pp[1].indexOf(",") == -1) {
        if (pp[1][0] != '"')
          args[pp[0]] = parseInt(pp[1], 16)
        else
          args[pp[0]] = pp[1].substr(1, pp[1].length - 2)
      } else {
        args[pp[0]] = []
        for (var ppp of pp[1].split(","))
          args[pp[0]].push(parseInt(ppp, 16))
      }
    }
    try {
      var ret = await do_cmd(cmd, args);
      if (cmd != 'init' && line != "hdlc") {
        var ok = await do_cmd_stat()
        if (!ok)
          console.error("Bad Status")
        if (ret)
          console.log(">", ret);
      }
    } catch (error) {
      console.error("ERROR:", error);
    }
  }

  rl.on('line', async (line:string) => {
    await do_line(line)
    rl.prompt(true)
  })

  do_cmd = async (cmd?:string, args?:any) => {
    if (hdlc_on)
      console.log("do_cmd", cmd, args);
    if (!cmd)
      return
    return new Promise(async (res, err) => {
      var c
      if (cmd_in_progress)
        err("busy")
      else if (c = COMMANDS[cmd]) {
        if (c.f) {
          try {
            var ret = await c.f(args)
            res(ret)
          } catch (error) {
            err(error)
          }
          return
        }
        var data = [c.b]
        for (var a of c.args) {
          var v = null
          if (a.n in args)
            v = args[a.n]
          else if ("default" in a)
            v = a.default
          else {
            err(`Argument "${a.n}" Missing`)
            return
          }
          if ("max" in a) {
            if (v > a.max) {
              err(`Argument "${a.n}" Too big: ${sprintf("0x%02X", v)} > ${sprintf("0x%02X", a.max)}`)
              return
            }
          }
          if (a.size == 1) {
            if (a.array) {
              for (var aa of v) {
                data = data.concat([aa])
              }
            } else
              data = data.concat([v])
          } else if (a.size == 4) {
            if (a.array) {
              for (aa of v) {
                data = data.concat([aa & 0xff, (aa >> 8) & 0xff, (aa >> 16) & 0xff, aa >> 24])
                // array used only as write data -- there LSB order
              }
            } else
              data = data.concat([v >> 24, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff])
          }
        }
        var crc = 0
        for (var b of data)
          crc += b
        var len = 2 + data.length
        var out = [len, crc & 0xff].concat(data)
        cmd_in_progress = c
        cmd_in_buf = []
        cmd_res = res
        cmd_err = err
        cmd_timeout = util.stamp() + 1000;
        port_write(Buffer.from(out))
        if (cmd == "reset") { // no point waiting -- it will not respond
          cmd_in_progress = null
          res(null)
          return
        }
      }
      else
        err(`Bad Command: "${cmd}"`)
    })
  }

  setInterval(async () => {
    var now = util.stamp()
    if (cmd_in_progress && cmd_timeout < now) {
      cmd_err = "time-out"
      cmd_in_progress = null
    }
    if (phase == 0) {
      try {
        port_write(Buffer.from([0x55]))
      } catch (error) {
        console.log("duh");
      }
    }
  }, 100)

  var do_probe = (ret:any) => {
    MCU = MCUS.find(mcu => mcu.id == ret.id)
    if (!argv.quiet) {
      console.log(`\nFound MCU:\n JEDEC_ID : ${ret.id_hex}`);
      if (MCU) {
        console.log(` NAME : "${MCU.name}"`);
        console.log(` FLASH_SIZE : ${sprintf("0x%08X", MCU.flash_size)}`);
        console.log(` FLASH_BLOCK: ${sprintf("0x%08X", MCU.flash_block)}, ${MCU.flash_size / MCU.flash_block} BLOCKS`);
        console.log(` RAM_START : ${sprintf("0x%08X", MCU.ram_start)}`);
        console.log(` RAM_SIZE : ${sprintf("0x%08X", MCU.ram_size)}`);
      } else
        console.log(`NOT SUPPORTED TYPE\n`);
    }
  }
  var ret = false
  if (argv.cmd == "term" || argv.cmd == "hdlc") {
    await do_line(argv.cmd);
    //process.exit(0)
  } else {
    try {
      await do_cmd("ID", {});
    } catch (error) {
      await do_cmd_init()
      await do_cmd("ID", {});
    }
    do_probe(ret)
    if (argv.cmd) {
      await do_line(argv.cmd);
      process.exit(0)
    }
  }
  rl.prompt(true);
}

(async () => {
  if (argv.port) {
    main(argv.port)
  }
  else {
    try {
      const serialList = await SerialPort.list();
      var pfn = null
      for (var p of serialList) {
        if (p.vendorId == '0451' || p.vendorId == '0403') {
          if (pfn) {
            console.log("\nMultiple serial ports:\n");
            for (var p of serialList) {
              if (p.vendorId == '0451' || p.vendorId == '0403') {
                console.log(p.path);
              }
            }
            console.log("\nPlease select one with argument --port=\n");
            process.exit(1)
          }
          pfn = p.path
        }
      }
      if (pfn)
        main(pfn)
      else {
        console.log("No serial port found");
        process.exit(1)
      }
    } catch (e) {
      console.log(e);
    }
  }
})()