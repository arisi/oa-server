import { Cpu, IRQvector, Pin } from './oa_cpu';

export class Renesas extends Cpu {

  constructor(
    name: string,
    IRQvectors: { [id: number]: IRQvector } = {},
    pins: { [id: string]: Pin } = {},
    maps: { [id: string]: { [id: number]: { pin: string } } } = {},
  ) {
    super(name,IRQvectors, pins, maps);
  }
  build() {
    super.build();
    this.push_code(`oujee rene`)
  }
}
