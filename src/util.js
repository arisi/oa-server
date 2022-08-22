
const sprintf = require('sprintf');

function isprint(char) {
    if (char < 32)
        return false
    return !(/[\x00-\x08\x0E-\x1F\x80-\xFF]/.test(String.fromCharCode(char)));
}

var dump = (title, a, d) => {
    if (title && title != "")
        process.stdout.write(`${title}:`);
    var i = 0
    var s = ""
    var aok = a != null
    if (!aok) a = 0
    if (aok)
        if ((a % 0x10) != 0) {
            process.stdout.write(sprintf("\n%08X: ", a - (a % 0x10)));
            for (var j = 0x10 - (a % 0x10); j < 0x10; j++) {
                process.stdout.write(sprintf(" "));
                s += " "
            }
        }
    for (var c of d) {
        if (((i + a) % 0x10) == 0) {
            process.stdout.write(sprintf(" %s\n", s));
            if (aok)
                process.stdout.write(sprintf("%08X: ", a + i));
            s = ""
        }
        process.stdout.write(sprintf("%02X ", c))
        if (isprint(c))
            s += String.fromCharCode(c)
        else if (c == 0xff)
            s += " "
        else
            s += "."
        i++
    }
    var z = ((a + d.length) % 0x10)

    if (z)
        for (var j = z; j < 0x10; j++) {
            s = " " + s
        }
    console.log(" " + s);
}
var dumpw = (title, a, d) => {
    if (title && title != "")
        process.stdout.write(`${title}:`);
    var i = 0
    var aok = a != null
    if (!aok) a = 0
    if (aok) {
        if ((a % 0x10) != 0) {
            process.stdout.write(sprintf("\n%08X: ", a - (a % 0x10)));
            for (var j = 0x10 - (a % 0x10); j < 0x10; j += 4) {
                process.stdout.write(sprintf(" "));
            }
        }
    }
    for (var c of d) {
        if (((i + a) % 0x10) == 0) {
            process.stdout.write(sprintf("\n"));
            if (aok)
                process.stdout.write(sprintf("%08X: ", a + i));
        }
        process.stdout.write(sprintf("%08X ", c))
        i += 4
    }
    console.log("");
}

stamp = () => {
    return (new Date).getTime()
}


module.exports = {
    dump,
    dumpw,
    stamp,
}
