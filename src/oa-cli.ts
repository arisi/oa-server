#!/usr/bin/env ts-node

import { Builder } from '../ts/gen_cpu';
import { join } from 'path';

var builder: Builder = new Builder();

builder.bheader("mban.json5", './mban')
