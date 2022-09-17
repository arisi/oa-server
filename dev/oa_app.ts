

import { Pacs, Pac } from './oa_pac';
import { Ra2e1 } from './oa_cpu_renesas_ra2e1';
import { Cpu } from './oa_cpu';
import { TQFP } from './oa_pack_TFQP';

var pp: Pac = new TQFP(24);
console.log(pp.code);

var pacs: Pacs = new Pacs();
pacs.importJSONs('pacs')
console.log(pacs.toString());

var ra04 = new Ra2e1();

console.log(ra04);
ra04.build();
console.log(ra04.source());
