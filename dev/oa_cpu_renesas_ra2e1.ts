


import { Renesas } from './oa_cpu_renesas';

export class Ra2e1 extends Renesas {
  constructor() {
    super(
      "RA2E1",
      {
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
    });
  }
  build() {
    super.build();
    this.push_code(`oujee rene ra2e1`)
  }
}

