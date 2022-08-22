#!/usr/bin/env node

const sprintf = require('sprintf');
const fs = require("fs")
const JSON5 = require('json5');

var schema = {}

var stamp = () => {
  return Date.now()
}

var build_c_lib = (path) => {
  console.log("buildin clib to", path);

  s = ""
  h = ""
  s += `#include "mqttsn.h"\n\n`;
  s += `#include "gen_mqtt.h"\n\n`;
  //s += `#include "puts.h"\n\n`;
  s += "unsigned int mqttsn_seq = 0;\n";
  s += "\n";
  s += `void mqttsn_decode(int len, unsigned char *buf)\n{\n`
  s += `    int seq = mqttsn_get_bits(len, buf, 0, MQTTSN_seqlen);\n`;
  s += `    int id = mqttsn_get_bits(len, buf,  MQTTSN_seqlen, MQTTSN_idlen);\n`;
  //s += `    printf("id: %02X, seq: %02X\\n", id, seq);\n`
  s += `    switch (id)\n    {\n`
  w = "";
  h += "\n";
  h += `#define MQTTSN_idlen ${schema.config.idlen}\n`
  h += `#define MQTTSN_seqlen ${schema.config.seqlen}\n`
  h += "\n";
  h += "extern unsigned int mqttsn_seq;\n";
  h += "\n";
  for (const [key, msg] of Object.entries(schema.messages)) {
    h += `#define MQTTSN_MSG_ID_${key} 0x${sprintf("%02X", msg.id)}\n`
  }
  h += "\n";
  h += `void mqttsn_decode(int len, unsigned char *buf);\n`
  h += `void mqttsn_sender(int len, unsigned char *buf);\n`
  for (const [key, msg] of Object.entries(schema.messages)) {
    s += `    case ${sprintf("MQTTSN_MSG_ID_%s", key)}:\n`
    s += `    {\n`

    cb = `mqttsn_decoded_${key}(`
    w += `__attribute__ ((weak)) void ${cb}`;
    h += `void ${cb}`;
    var type = "unsigned int", wname = "seq"
    h += `${type} ${wname}, `;
    w += `${type} ${wname}, `;
    var i = 0;
    var bit_position = schema.config.idlen + schema.config.seqlen;
    cb += "seq, "
    for (p of msg.payload) {
      var type = "unsigned int"
      var name = p.name;
      var wname = p.name;
      if (p.size <= 8)
        type = "unsigned char"
      if (p.n)
        name = name + "[10]"
      if (p.n)
        wname = "*" + p.name
      if (i) {
        cb += ", "
        h += ", "
        w += ", "
      }
      cb += `${p.name}`;
      h += `${type} ${wname}`;
      w += `${type} ${wname}`;
      if (p.n) {
        if (typeof p.n == "string")
          s += `        ${type} ${name};\n`;
        else
          s += `        ${type} ${p.name}[${p.n}];\n`;
        s += `        for (int i = 0; i < ${p.n}; i++)\n`;
        s += `            ${p.name}[i] = mqttsn_get_bits(len, buf, ${bit_position} + ${p.size} * i, ${p.size});\n`;
        bit_position += p.size
      } else {
        s += `        ${type} ${name} = mqttsn_get_bits(len, buf, ${bit_position}, ${p.size});\n`;
        bit_position += p.size
      }
      i++;
    }
    cb += `)`;
    h += `);\n`;

    w += `) {\n`;
    w += `    (void)seq;\n`;
    for (p of msg.payload) {
      w += `    (void)${p.name};\n`;
    }

    /*
    w += `    puts("weak cb: '${key}'");\n`;
    w += `    puts_lf();\n`;
    for (p of msg.payload) {
      var size = 2
      if (p.size > 8)
        size = p.size / 8
      w += `    puts("${p.name}: ");\n`;
      if (p.n) {
        w += `    for (int i = 0; i < ${p.n}; i++)\n`;
        w += `        {\n`;
        w += `        puts_h((unsigned int)${p.name}[i], ${size});\n`;
        w += `        puts(" ");\n`;
        w += `        }\n`;
      } else
        w += `    puts_h(${p.name}, ${size});\n`;
      w += `    puts_lf();\n`;
    }
    */
    w += `};\n\n`;
    s += `        ${cb};\n`
    s += `    }\n`
    s += `    break;\n`
  }
  s += `    default:\n`
  s += `    break;\n`

  s += `    }\n`
  s += `}\n\n`
  s += `${w}\n`

  for (const [key, msg] of Object.entries(schema.messages)) {
    proto = `int mqttsn_encode_${key}(char *buf, int maxlen`;
    for (p of msg.payload) {
      var type = "unsigned int"
      var name = p.name;
      if (p.size <= 8)
        type = "unsigned char"
      else if (p.size <= 16)
        type = "unsigned short int"
      if (p.n)
        name = "*" + name
      proto += `, ${type} ${name}`;
    }
    proto += `)`;
    h += `${proto};\n`;
    s += `${proto}\n{\n`;
    s += `    int bit_counter = 0;\n\n`;
    var bit = 0;

    s += `    bit_counter += mqttsn_push_bits(buf, maxlen, bit_counter, MQTTSN_seqlen, mqttsn_seq);\n`;
    s += `    bit_counter += mqttsn_push_bits(buf, maxlen, bit_counter, MQTTSN_idlen, MQTTSN_MSG_ID_${key});\n`;
    s += `    mqttsn_seq = (mqttsn_seq + 1) & ((1 << MQTTSN_seqlen) - 1);\n`;
    for (p of msg.payload) {
      var type = "int"
      if (p.size <= 8)
        type = "unsigned char"
      else if (p.size <= 16)
        type = "unsigned short int"
      if (p.n) {
        s += `    for (int i = 0; i < ${p.n}; i++)\n`;
        s += `        bit_counter += mqttsn_push_bits(buf, maxlen, bit_counter, ${p.size}, ${p.name}[i]);\n`;
      } else {
        s += `    bit_counter += mqttsn_push_bits(buf, maxlen, bit_counter, ${p.size}, ${p.name});\n`;
      }
    }
    s += "\n    mqttsn_sender((bit_counter + 7) / 8, (void *)buf);\n"
    s += "\n    return (bit_counter + 7) / 8;\n"
    s += "}\n\n";
  }
  fs.writeFileSync(`${path}/gen_mqtt.c`, s);
  fs.writeFileSync(`${path}/gen_mqtt.h`, h);
  console.log("built",`${path}/gen_mqtt.c`);
}

var seq_cnt = 0

var encode = (payload) => {
  var bits = []
  var my_seq = seq_cnt
  var sch = schema.messages[payload.topic]
  for (b = 0; b < schema.config.seqlen; b++) {
    bits.push(seq_cnt & (1 << b) ? 1 : 0)
  }
  seq_cnt += 1
  if (seq_cnt > 63)
    seq_cnt = 0
  for (b = 0; b < schema.config.idlen; b++) {
    bits.push(sch.id & (1 << b) ? 1 : 0)
  }
  for (p of sch.payload) {
    var val = payload[p.name];
    var len = 0
    if (p.n != undefined) {
      if (typeof val == "string") {
        var data = [];
        for (var i = 0; i < val.length; i++) {
          data.push(val.charCodeAt(i));
        }
        val = data
      }
      if (typeof val != "object") {
        console.error("no array???", val);
        continue;
      }
      if (typeof p.n == "string")
        len = payload[p.n]
      else
        len = val.length;
    }
    if (len > 0) {
      //console.log("len", len);
      for (i = 0; i < len; i++) {
        v = val[i]
        for (b = 0; b < p.size; b++) {
          bits.push(v & (1 << b) ? 1 : 0)
        }
      }

    } else {
      for (b = 0; b < p.size; b++) {
        bits.push(val & (1 << b) ? 1 : 0)
      }
    }
  }
  var bytes = Math.ceil(bits.length / 8)
  var ret = []
  for (byte = 0; byte < bytes; byte++) {
    var val = 0
    for (bit = 0; bit < 8 && bit + byte * 8 < bits.length; bit++) {
      var pos = bit + byte * 8;
      if (bits[pos])
        val |= 1 << bit
    }
    ret.push(val)
  }
  return [my_seq, ret]
}

var decode = (s) => {
  bits = [], bc = 0
  for (byte of s) {
    for (bit = 0; bit < 8; bit++) {
      bits[bc++] = (byte >> bit) & 1
    }
  }
  var pick = (size) => {
    var ret = 0;
    var i;
    for (i = 0; i < size; i++) {
      ret += bits.shift() * (1 << i)
    }
    if (ret < 0)
      ret += 0x100000000
    return ret
  }
  var seq = pick(schema.config.seqlen)
  var id = pick(schema.config.idlen)
  if (schema.ids[id]) {
    var msg = schema.messages[schema.ids[id]]
    //console.log("msg: ", schema.ids[id], msg.payload);
    var payload = {
      topic: schema.ids[id],
      seq,
    }
    for (p of msg.payload) {
      var len = 0
      if (p.n != undefined) {
        if (typeof p.n == "string")
          len = payload[p.n]
        else
          len = p.n;
      }
      if (len) {
        payload[p.name] = []
        var i
        for (i = 0; i < len; i++)
          payload[p.name].push(pick(p.size));
      } else
        payload[p.name] = pick(p.size);
    }
    return payload
  }
  console.log("bad msg id: ", id, s);
  return {error: "bad msg id"}
}

init = (schema_fn) => {
  try {
    schema = JSON5.parse(fs.readFileSync(schema_fn).toString())
    schema.ids = []
    for (const [key, msg] of Object.entries(schema.messages)) {
      schema.ids[msg.id] = key
    }
    return schema;
  } catch (error) {
    return null;
  }
}

module.exports = {
  init,
  decode,
  build_c_lib,
  encode,
}
