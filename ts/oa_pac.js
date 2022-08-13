import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'json5';
export class Pad {
    constructor() {
        this.p = { x: -1, y: -1 };
    }
}
export class Pac {
    constructor(size, pads) {
        this.pads = {};
        this.size = { x: -1, y: -1 };
        this.pads = pads;
        this.size = size;
    }
    toString() {
        var s = `  size: ${this.size.x},${this.size.y}\n`;
        for (var pad in this.pads) {
            var p = this.pads[pad];
            s += `    ${pad}: ${p.p.x},${p.p.y}\n`;
        }
        return s;
    }
}
export class Pacs {
    constructor() {
        this.pacs = {};
    }
    add(name, pac) {
        this.pacs[name] = pac;
    }
    toString() {
        var s = "";
        for (var pac in this.pacs) {
            s += `${pac}:\n`;
            s += this.pacs[pac].toString();
        }
        return s;
    }
    importJSON(name, fn) {
        var s = parse(readFileSync(fn).toString());
        this.add(name, new Pac(s.size, s.pac));
    }
    importJSONs(path) {
        for (var fn of readdirSync(path)) {
            const rExp = /pac_(.+)\.json.*/g;
            var hit = rExp.exec(fn);
            if (hit[1]) {
                this.importJSON(hit[1], join(path, fn));
            }
        }
    }
}
