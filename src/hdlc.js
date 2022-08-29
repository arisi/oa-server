#!/usr/bin/env node
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
exports.__esModule = true;
var sprintf = require('sprintf');
var crc = require("crc");
var events_1 = require("events");
var HDLC = /** @class */ (function (_super) {
    __extends(HDLC, _super);
    function HDLC() {
        var _this = _super.call(this) || this;
        _this.FRAME_OCTET = 0x7E;
        _this.ESCAPE_OCTET = 0x7D;
        _this.INVERT_OCTET = 0x20;
        _this.escapeCharacter = false;
        _this.framePosition = 0;
        _this.in_esc = false;
        _this.had_escape = false;
        _this.hbuf = [];
        return _this;
    }
    HDLC.dump = function (head, bytes) {
        process.stdout.write(head + ": ");
        for (var _i = 0, bytes_1 = bytes; _i < bytes_1.length; _i++) {
            var b = bytes_1[_i];
            process.stdout.write(sprintf("<%02X> ", b & 0xff));
        }
        console.log("");
    };
    HDLC.prototype.send = function (rawFrame) {
        var byte;
        var fcs;
        var buf = [];
        var sendchar = function (b) {
            buf.push(b & 0xff);
        };
        sendchar(this.FRAME_OCTET);
        for (var i = 0; i < rawFrame.length; i++) {
            byte = rawFrame[i];
            if (typeof byte == "string")
                byte = byte.charCodeAt(0);
            fcs = crc.crc16ccitt([byte], fcs);
            if ((byte === this.ESCAPE_OCTET) || (byte === this.FRAME_OCTET)) {
                sendchar(this.ESCAPE_OCTET);
                byte ^= this.INVERT_OCTET;
            }
            sendchar(byte);
        }
        byte = Buffer.from([fcs]).readInt8(0);
        if ((byte === this.ESCAPE_OCTET) || (byte === this.FRAME_OCTET)) {
            sendchar(this.ESCAPE_OCTET);
            byte ^= this.INVERT_OCTET;
        }
        sendchar(byte);
        byte = Buffer.from([fcs >> 8]).readInt8(0);
        if ((byte === this.ESCAPE_OCTET) || (byte === this.FRAME_OCTET)) {
            sendchar(this.ESCAPE_OCTET);
            byte ^= this.INVERT_OCTET;
        }
        sendchar(byte);
        sendchar(this.FRAME_OCTET);
        return buf;
    };
    ;
    HDLC.prototype.got = function (bytes) {
        for (var _i = 0, bytes_2 = bytes; _i < bytes_2.length; _i++) {
            var data = bytes_2[_i];
            if (true) {
                if (this.in_esc) {
                    this.in_esc = false;
                    data ^= this.INVERT_OCTET;
                    this.hbuf.push(data);
                    continue;
                }
                else if (data === this.ESCAPE_OCTET) {
                    this.in_esc = true;
                    this.had_escape = true;
                    continue;
                }
            }
            if (data == this.FRAME_OCTET) {
                {
                    if (this.hbuf.length == 0) {
                        this.emit('ping');
                    }
                    else if (this.hbuf.length > 2) {
                        var crcc = undefined;
                        for (var _a = 0, _b = this.hbuf.slice(1, this.hbuf.length - 2); _a < _b.length; _a++) {
                            var b = _b[_a];
                            crcc = crc.crc16ccitt([b], crcc);
                        }
                        var cc = ((this.hbuf[this.hbuf.length - 1] << 8) | (this.hbuf[this.hbuf.length - 2] & 0xff));
                        if (crcc == cc || this.had_escape) {
                            this.emit('frame', this.hbuf.slice(1, this.hbuf.length - 2));
                        }
                        else
                            console.log("CRC", this.hbuf.slice(1, this.hbuf.length - 2), sprintf("%04X %04X len:%d", crcc || 0, cc, this.hbuf.length));
                        this.hbuf = [];
                        this.in_esc = false;
                        this.had_escape = false;
                        continue;
                    }
                }
            }
            this.hbuf.push(data);
        }
    };
    HDLC.prototype.init = function () {
        this.hbuf = [];
    };
    return HDLC;
}(events_1.EventEmitter));
exports.HDLC = HDLC;
