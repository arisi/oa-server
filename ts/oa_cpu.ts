export interface IRQvector {
  name: string;
}

export class Pin {
  in?: boolean = false;
  out?: boolean = false;
  pullup?: boolean = false;
  pulldown?: boolean = false;
  irq?: boolean = false;
  adc?: boolean = false;
  dac?: boolean = false;
  wakeup?: boolean = false;
  opendrain?: boolean = false;
}

export class Cpu {
  pins: { [id: string]: Pin } = {};
  maps: { [id: string]: { [id: number]: { pin: string } } } = {};
  IRQvectors: { [id: number]: IRQvector } = {};

  constructor(
    IRQvectors: { [id: number]: IRQvector } = {},
    pins: { [id: string]: Pin; } = {},
    maps: { [id: string]: { [id: number]: { pin: string } } } = {},
  ) {
    this.pins = pins;
    this.maps = maps;
    this.IRQvectors = IRQvectors;
  }
}

export class Cpus {
  cpus: { [id: string]: Cpu } = {};
  add(name: string, cpu: Cpu) {
    this.cpus[name] = cpu;
  }
}
