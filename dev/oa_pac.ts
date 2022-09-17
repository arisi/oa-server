import { readdirSync, readFileSync} from 'fs';
import { join} from 'path';
import { parse } from 'json5';

export interface Point {
  x: number;
  y: number;
}

export class Pad {
  p: Point = { x: -1, y: -1 };
}

export class Pac {
  pads: { [id: number]: Pad } = {};
  size: Point = { x: -1, y: -1 };
  code: string = "";

  constructor(size: Point, pads: { [id: number]: Pad }) {
    this.pads = pads;
    this.size = size;
  }
  toString(): string {
    var s: string = `  size: ${this.size.x},${this.size.y}\n`;
    for (var pad in this.pads) {
      var p = this.pads[pad];
      s += `    ${pad}: ${p.p.x},${p.p.y}\n`
    }
    return s;
  }
}

export class Pacs {
  pacs: { [id: string]: Pac } = {};
  add(name: string, pac: Pac) {
    this.pacs[name] = pac;
  }
  toString(): string {
    var s: string = "";
    for (var pac in this.pacs) {
      s += `${pac}:\n`
      s += this.pacs[pac].toString()
    }
    return s;
  }

  importJSON(name: string, fn: string) {
    var s = parse(readFileSync(fn).toString())
    this.add(name, new Pac(s.size, s.pac))
  }

  importJSONs(path: string) {
    for (var fn of readdirSync(path)) {
        const rExp: RegExp = /pac_(.+)\.json.*/g;
      var hit = rExp.exec(fn)
      if (hit && hit[1]) {
        this.importJSON(hit[1], join(path, fn));
      }
    }

  }
}

