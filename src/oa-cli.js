#!/usr/bin/env ts-node
"use strict";
exports.__esModule = true;
var gen_cpu_1 = require("../ts/gen_cpu");
var builder = new gen_cpu_1.Builder();
builder.bheader("mban.json5", './mban');
