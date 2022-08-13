#!/usr/bin/env node

import * as fs from 'fs';
import * as JSON5 from 'json5';
import * as sprintf from 'sprintf';
import { join } from 'path';

export class Builder {
  cpu_path: string = "../lib"
  hex = (v: number, len = 0) => {
    if (len)
      return sprintf(`%0${len}X`, v)
    else
      return sprintf(`%X`, v)

  }
  bheader = (jsons: string, path: string, comments: boolean = false) => {
    var prod = JSON5.parse(fs.readFileSync(jsons).toString())
    var fn: string = prod.cpu
    var fn2 = join(__dirname, `${this.cpu_path}/${fn}/${fn}.json5`)
    var conf = JSON5.parse(fs.readFileSync(fn2).toString())
    conf.modules = {}
    for (var f of conf.files) {
      fn2=join(__dirname, `${this.cpu_path}/${fn}/${f}.json5`)
      var o = JSON5.parse(fs.readFileSync(fn2).toString())
      for (var mx of Object.keys(o))
        conf.modules[mx] = o[mx]
    }

    var lib_h = "#include <stdint.h>\n\n"
    //lib_h += fs.readFileSync("util/lib_header.h").toString() + "\n"
    var lib = ""
    var lib_hh = ""
    var s = "" //fs.readFileSync("util/header.h").toString() + "\n"
    s += `#include "gen_struct.h"\n`
    s += `#pragma once\n`

    s += `\n// ${conf.n}\n`
    var fc = 0;
    console.log("conf", conf);

    for (var key of Object.keys(conf.config)) {
      var val = conf.config[key]
      if (typeof val === 'string')
        lib_h += `#define ${key.padEnd(16)} "${val}"\n`
      else
        lib_h += `#define ${key.padEnd(16)} 0x${this.hex(val, 8)}\n`
    }

    var tester = "" // fs.readFileSync("util/header.h").toString() + "\n"
    tester += `\n#include <stdio.h>\n`
    tester += `#include <string.h>\n`

    console.log("mods", conf.modules);
    for (var mod of Object.keys(conf.modules)) {
      if (!prod.modules[mod]) {
        continue;
      }
      tester += `#include "gen_${mod}.h"\n`
      lib += `#include "gen_${mod}.h"\n`
      lib_hh += `#include "gen_${mod}.h"\n`
    }
    tester += `int main()\n{\n`
    lib += "\n"
    var json = {}

    for (var mod of Object.keys(conf.modules)) {
      if (!prod.modules[mod]) {
        continue;
      }
      console.log("mod", mod);
      tester += `    printf("Testing ${fn}_${mod}.h\\n");\n`
      var es = ""
      var st = `typedef struct\n`
      st += `{\n`
      var bc = 0;
      var rlist = []
      for (var reg of Object.keys(conf.modules[mod].regs)) {
        r = conf.modules[mod].regs[reg]
        r.reg = reg
        rlist.push(r)
      }
      rlist = rlist.sort((a, b) => a.o - b.o)

      for (var r of rlist) {
        reg = r.reg
        var m:any = conf.modules[mod]
        if (bc != r.o) {
          st += `    uint8_t _f${fc++}[0x${this.hex(r.o - bc)}];\n`;
          bc = r.o;
        }
        if (Object.keys(r.d).length > 1 || r.d[Object.keys(r.d)[0]].bits.length != r.s * 8) {
          if (comments)
            st += `\n    /* ${r.n} */\n`
          st += `    union\n`
          st += `    {\n`
          st += `        volatile uint${r.s * 8}_t ${reg};\n`
          st += `        struct\n`
          st += `        {\n`
          var bit = 0;
          for (var d of Object.keys(r.d)) {
            var dd = r.d[d]
            var len = dd.bits.length
            if (dd.bits[0] != bit) {
              st += `            uint${r.s * 8}_t _f${fc++} : ${dd.bits[0] - bit};\n`;
              bit = dd.bits[0]
            }
            if (comments)
              st += `            /* ${dd.n} */\n`
            if (dd.v)
              st += `            volatile ${reg}_${d}_t ${d} : ${len};\n`;
            else
              st += `            volatile uint${r.s * 8}_t ${d} : ${len};\n`;
            if (comments)
              st += `\n`
            bit += len
            if (dd.v) {
              if (comments)
                es += `/* ${r.n} (${mod}) / ${dd.n} (${d}): */\n`

              es += `typedef enum {\n`;
              for (var v of dd.v) {
                if (comments && v.n)
                  es += `\n  /* ${v.n} */\n`;
                if (len > 1)
                  es += `  ${reg}_${d}_${v.key} = 0x${this.hex(v.v, 2)},\n`;
                else
                  es += `  ${reg}_${d}_${v.key} = ${v.v},\n`;
              }
              es += `} ${reg}_${d}_t;\n\n`
            }
          }
          st += `        };\n`
          st += `    };\n`
        } else {
          st += `    volatile uint${r.s * 8}_t ${reg};\n`
        }
        bc += r.s;
        for (var port of conf.modules[mod].n) {
          var name
          if (conf.modules[mod].p)
            for (var pin of conf.modules[mod].p) {
              a = conf.modules[mod].base + port * conf.modules[mod].nm + pin * conf.modules[mod].pm + r.o
              name = `${mod}${port}_PIN${pin}->${reg}`
              tester +=
                `    if (&(${name})!=${a})
          printf("%-20.20s: 0x%08X ERR: %08X\\n","${name}",&(${name}),&(${name})-${a});
      else
          printf("%-20.20s: 0x%08X OK\\n","${name}",&(${name}));\n`

            }
          else {
            var jname: string
            if (conf.modules[mod].n.length > 1 || conf.modules[mod].n[0] != 0) {
              name = `${mod}${port}->${reg}`
              jname = `${mod}${port}:${reg}`
            } else {
              name = `${mod}->${reg}`
              jname = `${mod}:${reg}`
            }
            var a = conf.modules[mod].base + port * conf.modules[mod].nm + r.o
            var d2 = {}
            for (var [key, dd2] of Object.entries(r.d).sort((a: any, b: any) => {
              return b[1].bits[0] - a[1].bits[0]
            }
            )) {
              d2[key] = {
                n: dd2['n'],
                rw: dd2['rw'],
                s: dd2['bits'].length,
                p: dd2['bits'][0],
              }
            }
            json[jname] = {
              n: r.n,
              s: r.s,
              a,
              page: r.page,
              d: d2,
            }
            tester +=
              `    if (&(${name})!=${a})
          printf("%-20.20s: 0x%08X ERR: %08X\\n","${name}",&(${name}),&(${name})-${a});
      else
          printf("%-20.20s: 0x%08X OK\\n","${name}",&(${name}));\n`
          }
        }
      }
      st += `} ${mod}_t;\n\n`
      a = conf.modules[mod].base

      if (conf.modules[mod].n.length == 1 && conf.modules[mod].n[0] == 0) {
        lib += `${mod}_t *${mod} = (${mod}_t *) 0x${this.hex(m.base, 8)};\n`;
        st += `extern ${mod}_t *${mod};\n`;
      } else {
        for (var port of conf.modules[mod].n) {
          if (conf.modules[mod].p) {
            if (prod.modules[mod].n.indexOf(port) == -1) {
              continue;
            }
            for (var pin of conf.modules[mod].p) {
              a = conf.modules[mod].base + port * conf.modules[mod].nm + pin * conf.modules[mod].pm
              //s += doregs(mod, `${mod}_${port}_${pin}`, a, mod)
              lib += `${mod}_t *${mod}${port}_PIN${pin} = (${mod}_t *) 0x${this.hex(a, 8)};\n`;
              st += `extern ${mod}_t *${mod}${port}_PIN${pin};\n`;
            }
          }
          else {
            if (prod.modules[mod].n.indexOf(port) == -1) {
              continue;
            }
            a = conf.modules[mod].base + port * conf.modules[mod].nm
            lib += `${mod}_t *${mod}${port} = (${mod}_t *) 0x${this.hex(a, 8)};\n`;
            st += `extern ${mod}_t *${mod}${port};\n`;
          }
        }
      }
      var sh = ""
      sh += `#pragma once\n`
      sh += `\n/* ${conf.n} ${mod}: ${m.name} */\n\n`
      var si = `#include "rt0s.h"\n`
      if (es != "")
        si += `#include "gen_${mod}_enums.h"\n`
      si += `\n`

      fs.writeFileSync(`${path}/gen_${mod}.h`, sh + si + st)
      if (es != "")
        fs.writeFileSync(`${path}/gen_${mod}_enums.h`, sh + es)
    }
    tester += "}\n"
    fs.writeFileSync(`${path}/gen.json5`, JSON5.stringify(json, null, 2))

    fs.writeFileSync(`${path}/hw.c`, lib)
    fs.writeFileSync(`${path}/hw.h`, lib_hh)
    fs.writeFileSync(`${path}/rt0s.h`, lib_h)
  }
}
