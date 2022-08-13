import { Cpu } from './oa_cpu';
export class Renesas extends Cpu {
    constructor(IRQvectors = {}, pins = {}, maps = {}) {
        super(IRQvectors, pins, maps);
        this.code = [];
    }
    build() {
        /*for (var vec of this.vectors) {
          console.log("vec:", vec);
          this.code.push(`   .ds ${vec.a} ${vec.name}`)
        }*/
    }
}
