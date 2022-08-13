import { Builder } from './gen_cpu';


var builder: Builder = new Builder();

var fn="mban.json5"
console.log("reading conf", fn);

builder.bheader(fn, 'mban')