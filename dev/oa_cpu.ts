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
  name: string = "";
  code: string[] = [];
  pins: { [id: string]: Pin } = {};
  maps: { [id: string]: { [id: number]: { pin: string } } } = {};
  IRQvectors: { [id: number]: IRQvector } = {};

  constructor(
    name: string,
    IRQvectors: { [id: number]: IRQvector } = {},
    pins: { [id: string]: Pin; } = {},
    maps: { [id: string]: { [id: number]: { pin: string } } } = {},
  ) {
    this.name = name;
    this.pins = pins;
    this.maps = maps;
    this.IRQvectors = IRQvectors;
  }

  push_code(s: string) {
    this.code.push(`   ${s}`)
  }

  build() {
    for (var key in this.IRQvectors) {
      var vec = this.IRQvectors[key]
      this.push_code(`.ds ${key} ${vec.name}`)
    }
  }

  source() {
    var s: string = "";
    for (var c of this.code)
      s += `${c}\n`;
    return s;
  }
}
