#!/usr/bin/env node
"use strict";
exports.__esModule = true;
var gen_cpu_1 = require("../ts/gen_cpu");
var path_1 = require("path");
var yargs = require("yargs");
var fs = require("fs");
var argv = yargs
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
        console.log("Project ".concat(argv.create, " already exists"));
    else {
        console.log("Creating Project ".concat(argv.create));
        var conf = {};
        fs.mkdirSync(argv.create);
        fs.writeFileSync((0, path_1.join)(argv.create, ".oaconf"), JSON.stringify(conf, null, 2));
    }
}
