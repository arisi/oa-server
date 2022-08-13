#!/usr/bin/env ts-node

import { Builder } from '../ts/gen_cpu';
import { join } from 'path';

var builder: Builder = new Builder();

var fn = join(__dirname, '../ts/mban.json5')
console.log("reading conf", fn);

builder.bheader(fn, 'ts/mban')
