export class Pin {
    constructor() {
        this.in = false;
        this.out = false;
        this.pullup = false;
        this.pulldown = false;
        this.irq = false;
        this.adc = false;
        this.dac = false;
        this.wakeup = false;
        this.opendrain = false;
    }
}
export class Cpu {
    constructor(IRQvectors = {}, pins = {}, maps = {}) {
        this.pins = {};
        this.maps = {};
        this.IRQvectors = {};
        this.pins = pins;
        this.maps = maps;
        this.IRQvectors = IRQvectors;
    }
}
export class Cpus {
    constructor() {
        this.cpus = {};
    }
    add(name, cpu) {
        this.cpus[name] = cpu;
    }
}
