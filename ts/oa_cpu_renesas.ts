import { Cpu, IRQvector, Pin } from './oa_cpu';

export class Renesas extends Cpu {
  code: string[] = [];

  constructor(
    IRQvectors: { [id: number]: IRQvector } = {},
    pins: { [id: string]: Pin } = {},
    maps: { [id: string]: { [id: number]: { pin: string } } } = {},
  ) {
    super(IRQvectors, pins, maps);
  }
  build() {
    /*for (var vec of this.vectors) {
      console.log("vec:", vec);
      this.code.push(`   .ds ${vec.a} ${vec.name}`)
    }*/
  }
}
