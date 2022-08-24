import { OaCpu } from "./oa-cpu";
const mqttsn = require("./mqttsn_lib.js")
const hdlc = require("./hdlc.js")
const sprintf = require('sprintf');
const Rt0s = require("./rt0s_node.js").Rt0s

export class OaCpuTexas extends OaCpu {
  name: string = "TI"
  bauds: number[] = [115200];
  cmd_in_progress: any = false;
  cmd_timeout: any;
  cmd_in_buf = [];
  cmd_res:any = null;
  cmd_err: any = null;
  ACK = 0xCC
  NACK = 0x33

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
        var ret:any = [...this.cmd_in_buf]
        this.cmd_in_buf = []
        if (check != crc) {
          this.cmd_err("crc error")
          return
        }
        var p = 0, obj:any = { raw: ret }
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

  async do_cmd(cmd:string, args:any) {
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
      this.on('raw', (msg) => {
        clearTimeout(timer)
        //console.log("raw", msg);
        if (msg.length == 2 && msg[0] == 0x00 && msg[1] == 0xcc)
          res(true)
        else
          res(false)
      })
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
      if (this.dev.vendorId == '0451' || this.dev.vendorId == '0403') {
        for (var baud of this.bauds) {
          if (await this.open()) {
            var ret = await this.probeMQTT()
            if (!ret) {
              ret = await this.probeFlash()
              if (!ret) {
                this.set_mode('?');
                this.close()
              } else {
                this.set_mode('FLASH');
                this.mq = new Rt0s("mqtt://localhost:1884", "tif", "arska", "zilakka", this.onChange)
              }
            } else {
              this.set_mode('MQTT');
              this.mq = new Rt0s("mqtt://localhost:1884", "ti", "arska", "zilakka", this.onChange)
            }
            res(ret);
          }
        }
      }
      res(false)
    })
  }
}