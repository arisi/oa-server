#!/usr/bin/env node

const sprintf = require('sprintf');
var crc = require("crc");
import { EventEmitter } from "events";

export declare interface HDLC {
  on(event: 'frame', listener: (payload: any) => void): this;
  //on(event: 'ping', listener: () => void): this;
}
export class HDLC extends EventEmitter {
  FRAME_OCTET = 0x7E;
  ESCAPE_OCTET = 0x7D;
  INVERT_OCTET = 0x20;
  escapeCharacter = false
  framePosition = 0
  in_esc = false
  had_escape = false
  hbuf: any = []

  constructor() {
    super()
  }

  static dump(head: string, bytes: any) {
    process.stdout.write(head + ": ");
    for (var b of bytes) {
      process.stdout.write(sprintf("<%02X> ", b & 0xff))
    }
    console.log("");
  }

  send(rawFrame: any) {
    var byte;
    var fcs;
    var buf: any = []
    var sendchar = (b: any) => {
      buf.push(b & 0xff)
    }
    sendchar(this.FRAME_OCTET);
    for (var i = 0; i < rawFrame.length; i++) {
      byte = rawFrame[i];
      if (typeof byte == "string")
        byte = byte.charCodeAt(0)

      fcs = crc.crc16ccitt([byte], fcs);
      if ((byte === this.ESCAPE_OCTET) || (byte === this.FRAME_OCTET)) {
        sendchar(this.ESCAPE_OCTET);
        byte ^= this.INVERT_OCTET;
      }
      sendchar(byte);
    }

    byte = Buffer.from([fcs]).readInt8(0);
    if ((byte === this.ESCAPE_OCTET) || (byte === this.FRAME_OCTET)) {
      sendchar(this.ESCAPE_OCTET);
      byte ^= this.INVERT_OCTET;
    }
    sendchar(byte);

    byte = Buffer.from([fcs >> 8]).readInt8(0);
    if ((byte === this.ESCAPE_OCTET) || (byte === this.FRAME_OCTET)) {
      sendchar(this.ESCAPE_OCTET);
      byte ^= this.INVERT_OCTET;
    }
    sendchar(byte);

    sendchar(this.FRAME_OCTET);
    return buf
  };

  got(bytes: any) {
    for (var data of bytes) {
      if (true) {
        if (this.in_esc) {
          this.in_esc = false;
          data ^= this.INVERT_OCTET;
          this.hbuf.push(data)
          continue
        } else if (data === this.ESCAPE_OCTET) {
          this.in_esc = true;
          this.had_escape = true
          continue;
        }
      }
      if (data == this.FRAME_OCTET) {
        {
          if (this.hbuf.length == 0) {
            this.emit('ping');
          } else if (this.hbuf.length > 2) {
            var crcc = undefined
            for (var b of this.hbuf.slice(1, this.hbuf.length - 2))
              crcc = crc.crc16ccitt([b], crcc);
            var cc = ((this.hbuf[this.hbuf.length - 1] << 8) | (this.hbuf[this.hbuf.length - 2] & 0xff))
            if (crcc == cc || this.had_escape) {
              this.emit('frame', this.hbuf.slice(1, this.hbuf.length - 2));
            } else
              console.log("CRC", this.hbuf.slice(1, this.hbuf.length - 2), sprintf("%04X %04X len:%d", crcc || 0, cc, this.hbuf.length));
            this.hbuf = []
            this.in_esc = false
            this.had_escape = false
            continue
          }
        }
      }
      this.hbuf.push(data)
    }
  }
  init() {
    this.hbuf = []
  }
}