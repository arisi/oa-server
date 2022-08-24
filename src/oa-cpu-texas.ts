import { OaCpu } from "./oa-cpu";
const mqttsn = require("./mqttsn_lib.js")
const hdlc = require("./hdlc.js")


export class OaCpuTexas extends OaCpu {
  name: string = "TI"
  bauds: number[] = [115200];

  async probeFlash(): Promise<boolean> {
    return new Promise(async (res, err) => {
      console.log("probe ti flash", this.dev['path']);
      var cnt = 0;
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
        console.log("raw", msg);
        if (msg.length == 2 && msg[0]==0x00 && msg[1] == 0xcc)
          res(true)
        else
          res(false)
      })
    })
  }

  async probe(): Promise<boolean> {
    return new Promise(async (res, err) => {
      if (this.dev.vendorId == '0451' || this.dev.vendorId == '0403') {
        for (var baud of this.bauds) {
          console.log("probe ti", this.dev['path'], baud);
          if (await this.open()) {
            var ret = await this.probeMQTT()
            if (!ret) {
              console.log("mqtt not ok", this.dev['path']);
              ret = await this.probeFlash()
              if (!ret)
                console.log("flash not ok", this.dev['path']);
              else
                console.log("flash ok", this.dev['path']);
            } else
              console.log("mqtt ok", this.dev['path']);

            this.close()
            res(ret);
          }
        }
      }
      res(false)
    })
  }
}