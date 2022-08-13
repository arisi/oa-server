

import { Pacs } from './oa_pac';
import { Renesas } from './oa_cpu_renesas';
import { Cpus } from './oa_cpu';


var pacs: Pacs = new Pacs();
pacs.importJSONs('pacs')
console.log(pacs.toString());

var cpus: Cpus = new Cpus();

cpus.add("ra04", new Renesas({
  0: { name: "stack" },
  0x04: { name: "boot" },
}, {
  "PA0": { in: true }
}, {
    "kotelo": {
      1: { pin: "PA1" },
      2: { pin: "PA2" },
      3: { pin: "PA3" },
    }
}
));
console.log(cpus);
