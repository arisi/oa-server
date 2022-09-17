import { Pac, Pad, Point } from './oa_pac';

export class TQFP extends Pac {

  constructor(pins: number) {
    super({ x: pins / 4, y: pins / 4 }, []);
    if (pins % 4)
      throw(`Impossible pins on TQFP: ${pins}`)
    this.code=`TQFP${pins}`
  }
}