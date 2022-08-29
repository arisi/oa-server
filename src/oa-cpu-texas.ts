import { OaCpu } from "./oa-cpu";
const mqttsn = require("./mqttsn_lib.js")
const hdlc = require("./hdlc.js")
const sprintf = require('sprintf');
const Rt0s = require("./rt0s_node.js").Rt0s
const srec = require('./srec');
const fs = require('fs');
const path = require('path');

export class OaCpuTexas extends OaCpu {
  name: string = "TI"
  bauds: number[] = [115200];
  cmd_in_progress: any = false;
  cmd_timeout: any;
  cmd_in_buf: any = [];
  cmd_res: any = null;
  cmd_err: any = null;
  ACK = 0xCC
  NACK = 0x33
  MCUS = [
    {
      id: 0x00F00230, name: "CC2652",
      flash_start: 0, flash_size: 0x00058000, flash_block: 0x2000,
      ram_start: 0x20000000, ram_size: 0x14000
    },
  ]


  COMMANDS: any = {

    DOWNLOAD: { b: 0x21, args: [{ n: "a", size: 4 }, { n: "n", size: 4 }], ret: [], hide: true },
    STATUS: { b: 0x23, args: [], ret: [{ n: "status", size: 1 }] },
    SEND_DATA: { b: 0x24, args: [{ n: "d", size: 1, array: true }], ret: [], hide: true },
    reset: { b: 0x25, args: [], ret: [] },
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
  }

  check_buf() {
    var blen = this.cmd_in_buf.length
    if (this.cmd_in_buf[0] == this.NACK && blen) {
      console.log("NACK");
    } else if (blen == 1 && this.cmd_in_buf[0] == this.ACK && this.cmd_in_progress.ret.length == 0) {
      this.cmd_in_progress = null
      this.cmd_res([])
    } else if (blen > 2 && this.cmd_in_buf[0] == this.ACK && blen) {
      var len = this.cmd_in_buf[1];
      if (blen == len + 1) {
        var crc = this.cmd_in_buf[2];
        this.cmd_in_buf.shift()
        this.cmd_in_buf.shift()
        this.cmd_in_buf.shift()
        var check = 0
        for (var d of this.cmd_in_buf)
          check += d
        check = check & 0xff
        var ret: any = [...this.cmd_in_buf]
        this.cmd_in_buf = []
        if (check != crc) {
          this.cmd_err("crc error")
          return
        }
        var p = 0, obj: any = { raw: ret }
        for (var r of this.cmd_in_progress.ret) {
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
        this.cmd_in_progress = null
        this.write(Buffer.from([this.ACK]))
        this.cmd_res(obj)
      }
    }
  }

  dump(title: any, a: any, d: any) {
    if (title && title != "")
      process.stdout.write(`${title}:`);
    var i = 0
    var s = ""
    var aok = a != null
    if (!aok) a = 0
    if (aok)
      if ((a % 0x10) != 0) {
        process.stdout.write(sprintf("\n%08X: ", a - (a % 0x10)));
        for (var j = 0x10 - (a % 0x10); j < 0x10; j++) {
          process.stdout.write(sprintf(" "));
          s += " "
        }
      }
    for (var c of d) {
      if (((i + a) % 0x10) == 0) {
        process.stdout.write(sprintf(" %s\n", s));
        if (aok)
          process.stdout.write(sprintf("%08X: ", a + i));
        s = ""
      }
      process.stdout.write(sprintf("%02X ", c))
      if (this.isprint(c))
        s += String.fromCharCode(c)
      else if (c == 0xff)
        s += " "
      else
        s += "."
      i++
    }
    var z = ((a + d.length) % 0x10)

    if (z)
      for (var j = z; j < 0x10; j++) {
        s = " " + s
      }
    console.log(" " + s);
  }
  dumpw(title: any, a: any, d: any) {
    if (title && title != "")
      process.stdout.write(`${title}:`);
    var i = 0
    var aok = a != null
    if (!aok) a = 0
    if (aok) {
      if ((a % 0x10) != 0) {
        process.stdout.write(sprintf("\n%08X: ", a - (a % 0x10)));
        for (var j = 0x10 - (a % 0x10); j < 0x10; j += 4) {
          process.stdout.write(sprintf(" "));
        }
      }
    }
    for (var c of d) {
      if (((i + a) % 0x10) == 0) {
        process.stdout.write(sprintf("\n"));
        if (aok)
          process.stdout.write(sprintf("%08X: ", a + i));
      }
      process.stdout.write(sprintf("%08X ", c))
      i += 4
    }
    console.log("");
  }


  async do_cmd_dmp(args: any) {
    var ret:any = await this.do_cmd("MEMORY_READ", args);
    this.dump(false, args.a, ret.d)
  }

  async do_cmd_dmpw(args: any) {
    var ret:any = await this.do_cmd("MEMORY_READW", args);
    this.dumpw(false, args.a, ret.d)
  }

  async do_cmd(cmd: string, args: any) {
    return new Promise(async (res, err) => {
      var c
      if (this.cmd_in_progress)
        err("busy")
      else if (c = this.COMMANDS[cmd]) {
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
        this.cmd_in_progress = c
        this.cmd_in_buf = []
        this.cmd_res = res
        this.cmd_err = err
        this.cmd_timeout = OaCpu.stamp() + 1000;
        this.write(Buffer.from(out))
        if (cmd == "reset") { // no point waiting -- it will not respond
          this.cmd_in_progress = null
          res(null)
          return
        }
      }
      else
        err(`Bad Command: "${cmd}"`)
    })
  }

  async probeFlash(): Promise<boolean> {
    return new Promise(async (res, err) => {
      var cnt = 0;
      this.set_mode('PROBE-FLASH');
      var timer = setInterval(() => {
        if (cnt++ < 5)
          this.write(Buffer.from([0x55, 0x55]))
        else {
          clearTimeout(timer)
          res(false)
        }
      }, 100);
      var handler = (msg: any) => {
        clearTimeout(timer)
        console.log("raw at probeFlash", msg);
        this.removeListener('raw', handler)
        if (msg.length == 2 && msg[0] == 0x00 && msg[1] == 0xcc) {
          res(true)
        } else
          res(false)
      }
      this.on('raw', handler);
    })
  }

  onChange = async (s: boolean) => {
    if (s) {
      console.log("ONLINE ti");
    } else
      console.log("OFFLINE ti");
  }

  async probe(): Promise<boolean> {
    return new Promise(async (res, err) => {
      // accept Future Technology Devices International, Ltd FT232 Serial (UART) IC or TI
      if (this.dev.vendorId == '0451' || this.dev.vendorId == '0403') {
        for (var baud of this.bauds) {
          if (await this.open()) {
            var ret = await this.probeMQTT()
            if (!ret) {
              if (this.dev.vendorId == '0451') {
                ret = await this.probeFlash()
                if (!ret) {
                  this.set_mode('?');
                  this.close()
                } else {
                  this.set_mode('FLASH');
                  this.on('raw', (msg) => {
                    console.log("FRAW", msg, this.mode);
                    var b: any
                    for (b of msg) {
                      if (this.cmd_in_progress) {
                        if (this.cmd_in_buf.length || b) {
                          this.cmd_in_buf.push(b)
                          this.check_buf()
                        }
                      }
                    }
                  })
                  var id: any = await this.do_cmd("ID", {});
                  console.log("f id", id);
                  var MCU = this.MCUS.find(mcu => mcu.id == id.id)
                  console.log(`\nFound MCU:\n JEDEC_ID : ${id.id_hex}`);
                  if (MCU) {
                    this.cpu = MCU.name;
                    console.log(` NAME : "${MCU.name}"`);
                    console.log(` FLASH_SIZE : ${sprintf("0x%08X", MCU.flash_size)}`);
                    console.log(` FLASH_BLOCK: ${sprintf("0x%08X", MCU.flash_block)}, ${MCU.flash_size / MCU.flash_block} BLOCKS`);
                    console.log(` RAM_START : ${sprintf("0x%08X", MCU.ram_start)}`);
                    console.log(` RAM_SIZE : ${sprintf("0x%08X", MCU.ram_size)}`);
                  } else
                    console.log(`NOT SUPPORTED TYPE\n`);

                  this.mq = new Rt0s("mqtt://localhost:1884", this.client_id(), "arska", "zilakka", this.onChange)



                  this.mq.registerAPI('flash', "Flash ", ['srec'], async (msg: any) => {
                    var srec_fn = msg['req']['args'][1]['srec']
                    var srec_data: any, ret
                    try {
                      srec_data = srec.read(srec_fn);
                    } catch (error) {
                      return ({ 'error': "Cannot Open Srec File: " });
                    }
                    await this.do_cmd("erase", {});
                    console.log("Erased..");
                    var b, tot = 0
                    for (b of srec_data.blocks) {
                      process.stdout.write(sprintf("%08X:%02X %3d%% \r", b[0], b[1].length, (100 * tot) / srec_data.tot));
                      ret = await this.do_cmd("DOWNLOAD", { a: b[0], n: b[1].length });
                      ret = await this.do_cmd("SEND_DATA", { d: b[1] });
                      tot += b[1].length
                    }
                    console.log(`Flashed ${tot} bytes from ${sprintf("0x%08X", srec_data.min_a)} to ${sprintf("0x%08X", srec_data.max_a)}`);

                    ret = await this.do_cmd("cfg", { id: 0x0b, value: 0xc5 });
                    ret = await this.do_cmd("cfg", { id: 0x0c, value: 15 }); // sets pin for bootloader activation
                    ret = await this.do_cmd("cfg", { id: 0x0d, value: 1 });  // and state
                    ret = await this.do_cmd("cfg", { id: 0x01, value: 0 });  // vec base
                    await this.do_cmd_dmpw({ a: 0, n: 12 })
                    console.log("\nConfigured for boot..");
                    await this.do_cmd_dmpw({ a: 0x00057FD0, n: 8 })
                  })


                  this.mq.registerAPI('mod_flash', "Flash a Module", ['srec'], async (msg: any) => {
                    console.log("flashin module", msg['req']['args']);
                    var srec_fn = msg['req']['args'][1]['srec']
                    var srec_data: any = srec.read(srec_fn);
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
                      // fix name
                      var ret = await this.mq.req("tif", ['write8', { address: blk[0], data_len: blk[1].length, data: blk[1] }], {})
                      if (!ret.success) {
                        console.log("failed", ret);
                        ok = false
                        break
                      }
                    }
                    console.log("Written");
                    return { 'done': ok, "written": srec_data.tot };
                  });
                }
              }
            } else {
              this.set_mode('MQTT');
              this.mq = new Rt0s(this.conf.client.mqtt, this.client_id(), this.conf.client.username, this.conf.client.password, this.onChange);
              //this.mq = new Rt0s("mqtt://localhost:1884", this.client_id(), "arska", "zilakka", this.onChange)
              this.on('mqtt', (msg) => {
                console.log("MQTT:::", msg);
                if ((msg.rseq >= 0) && (this.reqs[msg.rseq]) && (!msg.watch_index)) {
                  console.log("hit", this.reqs[msg.rseq], msg);
                  this.mq.reply(this.reqs[msg.rseq], msg)
                  delete (this.reqs[msg.rseq])
                } else {
                  if (msg.topic) {
                    if (msg.topic == "log") {
                      var s = ""
                      for (var c of msg.data)
                        s += String.fromCharCode(c)
                      console.log(`>${msg.level}>${s}`);
                      fs.appendFileSync(path.join("log","loki"),s)
                    }
                    this.mq.send_ind(msg.topic, msg)
                  }
                }
              })
              // direct call feature with promise to self?
              // var [id, buf] = mqttsn.encode(this.schema, { topic: 'ident', level: 1 })
              // var frame = this.hdlc.send(Buffer.from(buf))
              // this.write(Buffer.from(frame))
              // this.reqs[id] = frame
              this.mq.registerAPI('send', "Sends a message to DUT", [], (msg:any) => {
                console.log("send...", msg.req.args[1]);
                //line = JSON5.parse('{topic:"read8", address:0, data_len:4}')
                var id, buf
                [id, buf] = mqttsn.encode(this.schema,msg.req.args[1])
                //check = mqttsn.decode(buf)
                var frame = this.hdlc.send(Buffer.from(buf))
                this.write(Buffer.from(frame))

                //return { sent: true };
                this.reqs[id] = msg
                return null;
              });

              if (this.schema && 'messages' in this.schema)
                var value: any
              var key: string
              for ([key, value] of Object.entries(this.schema.messages)) {
                if (value.direction == 'down' || value.direction == 'both') {
                  //console.log(`msg '${key}':`, value);
                  var args = []
                  for (var p of value.payload)
                    args.push(p.name)
                  this.mq.registerAPI(key, value.descr, args, (msg: any) => {
                    var obj = {
                      topic: msg.req.args[0],
                      ...msg.req.args[1],
                    }
                    //console.log("got api call:", msg, obj);
                    var [id, s] = mqttsn.encode(this.schema, obj)
                    //var check = mqttsn.decode(s)
                    //console.log("check:", msg, id, s);
                    var buf = this.hdlc.send(Buffer.from(s))
                    this.write(Buffer.from(buf)) //, JSON.stringify(check))
                    this.reqs[id] = msg
                    return null
                  })
                }
              }
            }
            res(ret);
          }
        }
      }
      res(false)
    })
  }
}