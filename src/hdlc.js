#!/usr/bin/env node

const sprintf = require('sprintf');
var crc = require("crc");

var FRAME_OCTET = 0x7E;
var ESCAPE_OCTET = 0x7D;
var INVERT_OCTET = 0x20;
escapeCharacter = false
framePosition = 0

dump = (head, bytes) => {
  process.stdout.write(head + ": ");
  for (b of bytes) {
    process.stdout.write(sprintf("<%02X> ", b & 0xff))
  }
  console.log("");
}

send = (rawFrame) => {
  var byte;
  var fcs;
  var buf = []
  sendchar = (b) => {
    buf.push(b & 0xff)
  }
  sendchar(FRAME_OCTET);
  for (var i = 0; i < rawFrame.length; i++) {
    byte = rawFrame[i];
    if (typeof byte == "string")
      byte = byte.charCodeAt(0)

    fcs = crc.crc16ccitt([byte], fcs);
    if ((byte === ESCAPE_OCTET) || (byte === FRAME_OCTET)) {
      sendchar(ESCAPE_OCTET);
      byte ^= INVERT_OCTET;
    }
    sendchar(byte);
  }

  byte = Buffer.from([fcs]).readInt8(0);
  if ((byte === ESCAPE_OCTET) || (byte === FRAME_OCTET)) {
    sendchar(ESCAPE_OCTET);
    byte ^= INVERT_OCTET;
  }
  sendchar(byte);

  byte = Buffer.from([fcs >> 8]).readInt8(0);
  if ((byte === ESCAPE_OCTET) || (byte === FRAME_OCTET)) {
    sendchar(ESCAPE_OCTET);
    byte ^= INVERT_OCTET;
  }
  sendchar(byte);

  sendchar(FRAME_OCTET);
  return buf
};

frame = (bytes) => {
  dump("frame", bytes)
}

var idle = [FRAME_OCTET, FRAME_OCTET]

var in_esc = false
var hbuf = []

var had_escape = false
got = (bytes, cb) => {
  for (var data of bytes) {
    if (true) {
      if (in_esc) {
        in_esc = false;
        data ^= INVERT_OCTET;
        hbuf.push(data)
        continue
      } else if (data === ESCAPE_OCTET) {
        in_esc = true;
        had_escape = true
        continue;
      }
    }
    if (data == FRAME_OCTET) {
      {
        if (hbuf.length == 0) {
          cb("PING")
        } else if (hbuf.length > 2) {
          var crcc = undefined
          for (b of  hbuf.slice(1, hbuf.length - 2))
            crcc = crc.crc16ccitt([b], crcc);
          var cc = ((hbuf[hbuf.length - 1] << 8) | (hbuf[hbuf.length - 2] & 0xff))
          if (crcc == cc || had_escape)
            cb(null, hbuf.slice(1, hbuf.length - 2));
          else
            cb("CRC", hbuf.slice(1, hbuf.length - 2), sprintf("%04X %04X len:%d", crcc||0, cc,hbuf.length));
          hbuf = []
          in_esc = false
          had_escape = false
          continue
        }
      }
    }
    hbuf.push(data)
  }
}

module.exports = {
  got,
  send,
  dump,
  idle,
}
