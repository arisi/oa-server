#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const gen_cpu_1 = require("../ts/gen_cpu");
const path_1 = require("path");
const yargs = require("yargs");
const fs = require("fs");
const argv = yargs
    .option('create', {
    description: 'Create a Project',
    type: 'string'
})
    .option('build', {
    description: 'Build a Project',
    type: 'string'
})
    .help()
    .alias('help', 'h').argv;
console.log(argv);
if (argv.build) {
    var builder = new gen_cpu_1.Builder();
    builder.bheader("mban.json5", './mban');
}
else if (argv.create) {
    if (fs.existsSync(argv.create))
        console.log(`Project ${argv.create} already exists`);
    else {
        console.log(`Creating Project ${argv.create}`);
        var conf = {};
        fs.mkdirSync(argv.create);
        fs.writeFileSync((0, path_1.join)(argv.create, ".oaconf"), JSON.stringify(conf, null, 2));
    }
}
