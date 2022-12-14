
const Rt0s = require("./rt0s_node.js").Rt0s
import { EventEmitter } from "events";
import { SerialPort } from "serialport";
const fs = require('fs');
const path = require('path');
const os = require('os');

export declare interface OaSerial {
  on(event: 'found', listener: (name: any) => void): this;
  on(event: 'lost', listener: (name: any) => void): this;
}
export class OaSerial extends EventEmitter {
  first_online: boolean = true
  mq: any
  devices: any = {}
  tick: number = 0;
  conf: any;
  home_dir = os.homedir();
  pwd = process.cwd()

  onChange = async (s: boolean) => {
    if (s) {
      console.log("ONLINE");
      if (this.first_online)
        this.poller();
      this.first_online = true;
    } else
      console.log("OFFLINE");
  }
  constructor(client_id: string) {
    super()
    var fn = path.join(this.home_dir, ".oa", "config.json");
    this.conf = JSON.parse(fs.readFileSync(fn))
    console.log("usin conf", fn, this.conf.client);

    this.mq = new Rt0s(this.conf.client.mqtt, client_id, this.conf.client.username, this.conf.client.password, this.onChange)
  }

  poller = async () => {
    const serialList = await SerialPort.list();
    for (var p of serialList) {
      if (!(p.path in this.devices)) {
        this.devices[p.path] = {
          ...p,
          tick: this.tick,
          found: this.tick,
        }
        this.emit('found', this.devices[p.path]);
      } else {
        this.devices[p.path]['tick'] = this.tick
      }
    }

    for (var key of Object.keys(this.devices)) {
      if (key in this.devices) {
        var d = this.devices[key];
        if (d.tick != this.tick) {
          this.emit('lost', d);
          delete this.devices[key];
        }
      }
    }
    this.tick += 1;
    setTimeout(() => {
      this.poller()
    }, 1000);
  }
}