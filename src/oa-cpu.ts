
const SerialPort = require('serialport').SerialPort
const { SerialPortStream } = require('@serialport/stream')
const { autoDetect } = require('@serialport/bindings-cpp')
const binding = autoDetect()
const { DelimiterParser } = require('@serialport/parser-delimiter')
const { ReadlineParser } = require('@serialport/parser-readline')
const sprintf = require('sprintf');
const fs = require('fs');
const mqttsn = require("./mqttsn_lib.js")

import { HDLC } from "./hdlc";
import { EventEmitter } from "events";

export declare interface OaCpu {
  on(event: 'mqtt', listener: (payload: any) => void): this;
  on(event: 'raw', listener: (payload: any) => void): this;
}
export class OaCpu extends EventEmitter {
  name: string = "?";
  dev: any = null;
  port: any = null;
  baud: number = 115200;
  mode: string = '?'
  logf: any = false
  log = true
  debug = true
  log_start:number = 0
  log_prev: number = 0
  schema: any;
  hdlc: any;
  mq: any;


  static stamp() {
    return (new Date).getTime()
  }

  set_mode(newmode: string) {
    if (this.mode != newmode) {
      console.log("set_mode", this.dev['path'], this.mode,"=>", newmode);
      this.mode = newmode;
    }
  }

  logger(verb: string, data: any, info?: string) {
    if (!this.debug)
      return
    if (verb == "R") {
      var s = ""
      for (var ch of data) {
        s += sprintf("%02X ", ch)
        if (ch == 0x7e)
          s += "\n"
      }
      fs.write(this.logf, s, () => {
        fs.fdatasync(this.logf, () => { })
      })
    }
    var now = OaCpu.stamp()
    if (this.log_start == 0) {
      this.log_start = now
      this.log_prev = now
    }
    s = sprintf("%7.3f %7.3f %s:", (now - this.log_start) / 1000, (now - this.log_prev) / 1000, verb)
    for (ch of data)
      s += sprintf("%02X ", ch)
    if (info)
      s += info
    //console.log(s);
    if (this.log) {
      fs.write(this.logf, s + "\n", () => {
        fs.fdatasync(this.logf, () => { })
      })

    }
    this.log_prev = now
  }


  write(data: any, info?: string) {
    this.logger("W", data, info)
    this.port.write(data)
  }

  constructor(dev: any) {
    super()
    this.dev = dev
    this.logf = fs.openSync("loki.txt", "w")
    this.schema = mqttsn.init("mban_mqtt.json5")
    this.hdlc = new HDLC()
  }

  async probeMQTT(): Promise<boolean> {
    return new Promise(async (res, err) => {
      this.set_mode('PROBE-MQTT');
      this.hdlc.init()
      var a: any, buf: any;
      var obj
      obj = {topic: 'ping', data:[1,2,3], data_len:3};
      [a, buf] = mqttsn.encode(this.schema, obj)
      var timer = setTimeout(() => {
        res(false)
      }, 1500);
      this.on('mqtt', (msg) => {
        clearTimeout(timer)
        if (msg.topic == 'pong')
          res(true)
        else
          res(false)
      });
      var frame = this.hdlc.send(Buffer.from(buf))
      this.write(Buffer.from(frame))
    })
  }

  async open(baud: number = 115200): Promise<boolean> {
    return new Promise((res) => {
      this.port = new SerialPortStream({
        binding,
        path: this.dev['path'],
        baudRate: baud,
        parity: 'none',
        stopBits: 1
      });
      this.port.on('error', (err: any) => {
        console.log(err);
        console.error("Bad port", this.dev['path']);
        res(false)
      });
      this.port.on('open', (err: any) => {
        //console.error("Opened port", this.dev['path']);
        res(true)
      });
      this.hdlc.on('frame', (frame:any) => {
        var msg = mqttsn.decode(this.schema, frame)
        this.emit('mqtt', msg);
      })
      this.on('raw', (msg) => {
        console.log("RAW", msg, this.mode);

      })
      this.port.on('readable', () => {
        var d: any;
        try {
          d = this.port.read();
        } catch (error) {
          //console.error("port lost");
          return;
        }

        if (d) {
          if (this.debug) {
            this.logger("R", d)
          }
          this.emit('raw', d);

          this.hdlc.got(d)
        }
      })
    })
  }

  close() {
    if (this.port)
      this.port.close();
    this.port = null;
  }

  async probe(): Promise<boolean> {
    return new Promise((res) => {
      res(false)
    })
  }

}