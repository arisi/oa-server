#!/usr/bin/env node
export declare class Builder {
    cpu_path: string;
    hex: (v: number, len?: number) => any;
    bheader: (jsons: string, path: string, comments?: boolean) => void;
}
