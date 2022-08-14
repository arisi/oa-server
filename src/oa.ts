#!/usr/bin/env node

import { Builder } from '../ts/gen_cpu';
import { join } from 'path';
import * as yargs from 'yargs';
import * as fs from 'fs';

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
  var builder: Builder = new Builder();
  builder.bheader("mban.json5", './mban')
} else if (argv.create) {
  if (fs.existsSync(argv.create))
    console.log(`Project ${argv.create} already exists`)
  else {
    console.log(`Creating Project ${argv.create}`)
    var conf:any={}
    fs.mkdirSync(argv.create)
    fs.writeFileSync(join(argv.create,".oaconf"),JSON.stringify(conf,null,2))
  }
}