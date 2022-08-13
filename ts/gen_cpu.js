#!/usr/bin/env node
"use strict";
exports.__esModule = true;
exports.Builder = void 0;
var fs = require("fs");
var JSON5 = require("json5");
var sprintf = require("sprintf");
var path_1 = require("path");
var Builder = /** @class */ (function () {
    function Builder() {
        var _this = this;
        this.cpu_path = "../lib";
        this.hex = function (v, len) {
            if (len === void 0) { len = 0; }
            if (len)
                return sprintf("%0".concat(len, "X"), v);
            else
                return sprintf("%X", v);
        };
        this.bheader = function (jsons, path, comments) {
            if (comments === void 0) { comments = false; }
            var prod = JSON5.parse(fs.readFileSync(jsons).toString());
            var fn = prod.cpu;
            var fn2 = (0, path_1.join)(__dirname, "".concat(_this.cpu_path, "/").concat(fn, "/").concat(fn, ".json5"));
            var conf = JSON5.parse(fs.readFileSync(fn2).toString());
            conf.modules = {};
            for (var _i = 0, _a = conf.files; _i < _a.length; _i++) {
                var f = _a[_i];
                fn2 = (0, path_1.join)(__dirname, "".concat(_this.cpu_path, "/").concat(fn, "/").concat(f, ".json5"));
                var o = JSON5.parse(fs.readFileSync(fn2).toString());
                for (var _b = 0, _c = Object.keys(o); _b < _c.length; _b++) {
                    var mx = _c[_b];
                    conf.modules[mx] = o[mx];
                }
            }
            var lib_h = "#include <stdint.h>\n\n";
            //lib_h += fs.readFileSync("util/lib_header.h").toString() + "\n"
            var lib = "";
            var lib_hh = "";
            var s = ""; //fs.readFileSync("util/header.h").toString() + "\n"
            s += "#include \"gen_struct.h\"\n";
            s += "#pragma once\n";
            s += "\n// ".concat(conf.n, "\n");
            var fc = 0;
            console.log("conf", conf);
            for (var _d = 0, _e = Object.keys(conf.config); _d < _e.length; _d++) {
                var key = _e[_d];
                var val = conf.config[key];
                if (typeof val === 'string')
                    lib_h += "#define ".concat(key.padEnd(16), " \"").concat(val, "\"\n");
                else
                    lib_h += "#define ".concat(key.padEnd(16), " 0x").concat(_this.hex(val, 8), "\n");
            }
            var tester = ""; // fs.readFileSync("util/header.h").toString() + "\n"
            tester += "\n#include <stdio.h>\n";
            tester += "#include <string.h>\n";
            console.log("mods", conf.modules);
            for (var _f = 0, _g = Object.keys(conf.modules); _f < _g.length; _f++) {
                var mod = _g[_f];
                if (!prod.modules[mod]) {
                    continue;
                }
                tester += "#include \"gen_".concat(mod, ".h\"\n");
                lib += "#include \"gen_".concat(mod, ".h\"\n");
                lib_hh += "#include \"gen_".concat(mod, ".h\"\n");
            }
            tester += "int main()\n{\n";
            lib += "\n";
            var json = {};
            for (var _h = 0, _j = Object.keys(conf.modules); _h < _j.length; _h++) {
                var mod = _j[_h];
                if (!prod.modules[mod]) {
                    continue;
                }
                console.log("mod", mod);
                tester += "    printf(\"Testing ".concat(fn, "_").concat(mod, ".h\\n\");\n");
                var es = "";
                var st = "typedef struct\n";
                st += "{\n";
                var bc = 0;
                var rlist = [];
                for (var _k = 0, _l = Object.keys(conf.modules[mod].regs); _k < _l.length; _k++) {
                    var reg = _l[_k];
                    r = conf.modules[mod].regs[reg];
                    r.reg = reg;
                    rlist.push(r);
                }
                rlist = rlist.sort(function (a, b) { return a.o - b.o; });
                for (var _m = 0, rlist_1 = rlist; _m < rlist_1.length; _m++) {
                    var r = rlist_1[_m];
                    reg = r.reg;
                    var m = conf.modules[mod];
                    if (bc != r.o) {
                        st += "    uint8_t _f".concat(fc++, "[0x").concat(_this.hex(r.o - bc), "];\n");
                        bc = r.o;
                    }
                    if (Object.keys(r.d).length > 1 || r.d[Object.keys(r.d)[0]].bits.length != r.s * 8) {
                        if (comments)
                            st += "\n    /* ".concat(r.n, " */\n");
                        st += "    union\n";
                        st += "    {\n";
                        st += "        volatile uint".concat(r.s * 8, "_t ").concat(reg, ";\n");
                        st += "        struct\n";
                        st += "        {\n";
                        var bit = 0;
                        for (var _o = 0, _p = Object.keys(r.d); _o < _p.length; _o++) {
                            var d = _p[_o];
                            var dd = r.d[d];
                            var len = dd.bits.length;
                            if (dd.bits[0] != bit) {
                                st += "            uint".concat(r.s * 8, "_t _f").concat(fc++, " : ").concat(dd.bits[0] - bit, ";\n");
                                bit = dd.bits[0];
                            }
                            if (comments)
                                st += "            /* ".concat(dd.n, " */\n");
                            if (dd.v)
                                st += "            volatile ".concat(reg, "_").concat(d, "_t ").concat(d, " : ").concat(len, ";\n");
                            else
                                st += "            volatile uint".concat(r.s * 8, "_t ").concat(d, " : ").concat(len, ";\n");
                            if (comments)
                                st += "\n";
                            bit += len;
                            if (dd.v) {
                                if (comments)
                                    es += "/* ".concat(r.n, " (").concat(mod, ") / ").concat(dd.n, " (").concat(d, "): */\n");
                                es += "typedef enum {\n";
                                for (var _q = 0, _r = dd.v; _q < _r.length; _q++) {
                                    var v = _r[_q];
                                    if (comments && v.n)
                                        es += "\n  /* ".concat(v.n, " */\n");
                                    if (len > 1)
                                        es += "  ".concat(reg, "_").concat(d, "_").concat(v.key, " = 0x").concat(_this.hex(v.v, 2), ",\n");
                                    else
                                        es += "  ".concat(reg, "_").concat(d, "_").concat(v.key, " = ").concat(v.v, ",\n");
                                }
                                es += "} ".concat(reg, "_").concat(d, "_t;\n\n");
                            }
                        }
                        st += "        };\n";
                        st += "    };\n";
                    }
                    else {
                        st += "    volatile uint".concat(r.s * 8, "_t ").concat(reg, ";\n");
                    }
                    bc += r.s;
                    for (var _s = 0, _t = conf.modules[mod].n; _s < _t.length; _s++) {
                        var port = _t[_s];
                        var name;
                        if (conf.modules[mod].p)
                            for (var _u = 0, _v = conf.modules[mod].p; _u < _v.length; _u++) {
                                var pin = _v[_u];
                                a = conf.modules[mod].base + port * conf.modules[mod].nm + pin * conf.modules[mod].pm + r.o;
                                name = "".concat(mod).concat(port, "_PIN").concat(pin, "->").concat(reg);
                                tester +=
                                    "    if (&(".concat(name, ")!=").concat(a, ")\n          printf(\"%-20.20s: 0x%08X ERR: %08X\\n\",\"").concat(name, "\",&(").concat(name, "),&(").concat(name, ")-").concat(a, ");\n      else\n          printf(\"%-20.20s: 0x%08X OK\\n\",\"").concat(name, "\",&(").concat(name, "));\n");
                            }
                        else {
                            var jname;
                            if (conf.modules[mod].n.length > 1 || conf.modules[mod].n[0] != 0) {
                                name = "".concat(mod).concat(port, "->").concat(reg);
                                jname = "".concat(mod).concat(port, ":").concat(reg);
                            }
                            else {
                                name = "".concat(mod, "->").concat(reg);
                                jname = "".concat(mod, ":").concat(reg);
                            }
                            var a = conf.modules[mod].base + port * conf.modules[mod].nm + r.o;
                            var d2 = {};
                            for (var _w = 0, _x = Object.entries(r.d).sort(function (a, b) {
                                return b[1].bits[0] - a[1].bits[0];
                            }); _w < _x.length; _w++) {
                                var _y = _x[_w], key = _y[0], dd2 = _y[1];
                                d2[key] = {
                                    n: dd2['n'],
                                    rw: dd2['rw'],
                                    s: dd2['bits'].length,
                                    p: dd2['bits'][0]
                                };
                            }
                            json[jname] = {
                                n: r.n,
                                s: r.s,
                                a: a,
                                page: r.page,
                                d: d2
                            };
                            tester +=
                                "    if (&(".concat(name, ")!=").concat(a, ")\n          printf(\"%-20.20s: 0x%08X ERR: %08X\\n\",\"").concat(name, "\",&(").concat(name, "),&(").concat(name, ")-").concat(a, ");\n      else\n          printf(\"%-20.20s: 0x%08X OK\\n\",\"").concat(name, "\",&(").concat(name, "));\n");
                        }
                    }
                }
                st += "} ".concat(mod, "_t;\n\n");
                a = conf.modules[mod].base;
                if (conf.modules[mod].n.length == 1 && conf.modules[mod].n[0] == 0) {
                    lib += "".concat(mod, "_t *").concat(mod, " = (").concat(mod, "_t *) 0x").concat(_this.hex(m.base, 8), ";\n");
                    st += "extern ".concat(mod, "_t *").concat(mod, ";\n");
                }
                else {
                    for (var _z = 0, _0 = conf.modules[mod].n; _z < _0.length; _z++) {
                        var port = _0[_z];
                        if (conf.modules[mod].p) {
                            if (prod.modules[mod].n.indexOf(port) == -1) {
                                continue;
                            }
                            for (var _1 = 0, _2 = conf.modules[mod].p; _1 < _2.length; _1++) {
                                var pin = _2[_1];
                                a = conf.modules[mod].base + port * conf.modules[mod].nm + pin * conf.modules[mod].pm;
                                //s += doregs(mod, `${mod}_${port}_${pin}`, a, mod)
                                lib += "".concat(mod, "_t *").concat(mod).concat(port, "_PIN").concat(pin, " = (").concat(mod, "_t *) 0x").concat(_this.hex(a, 8), ";\n");
                                st += "extern ".concat(mod, "_t *").concat(mod).concat(port, "_PIN").concat(pin, ";\n");
                            }
                        }
                        else {
                            if (prod.modules[mod].n.indexOf(port) == -1) {
                                continue;
                            }
                            a = conf.modules[mod].base + port * conf.modules[mod].nm;
                            lib += "".concat(mod, "_t *").concat(mod).concat(port, " = (").concat(mod, "_t *) 0x").concat(_this.hex(a, 8), ";\n");
                            st += "extern ".concat(mod, "_t *").concat(mod).concat(port, ";\n");
                        }
                    }
                }
                var sh = "";
                sh += "#pragma once\n";
                sh += "\n/* ".concat(conf.n, " ").concat(mod, ": ").concat(m.name, " */\n\n");
                var si = "#include \"rt0s.h\"\n";
                if (es != "")
                    si += "#include \"gen_".concat(mod, "_enums.h\"\n");
                si += "\n";
                fs.writeFileSync("".concat(path, "/gen_").concat(mod, ".h"), sh + si + st);
                if (es != "")
                    fs.writeFileSync("".concat(path, "/gen_").concat(mod, "_enums.h"), sh + es);
            }
            tester += "}\n";
            fs.writeFileSync("".concat(path, "/gen.json5"), JSON5.stringify(json, null, 2));
            fs.writeFileSync("".concat(path, "/hw.c"), lib);
            fs.writeFileSync("".concat(path, "/hw.h"), lib_hh);
            fs.writeFileSync("".concat(path, "/rt0s.h"), lib_h);
        };
    }
    return Builder;
}());
exports.Builder = Builder;
