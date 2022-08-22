const fs = require("fs")

var read = (fn) => {
  var max_a = 0
  var min_a = 0xffffffff
  var info = ""
  var blocks = []
  //console.log("Loading..", fn);
  if (!fs.existsSync(fn)) {
    return {error: `Srec File does not exist: '${fn}'`}
  }
  for (var r of fs.readFileSync(fn).toString().split("\n")) {
    if (r[0] == 'S') {
      var len = parseInt(r.substr(2, 2), 16)
      var data = []
      sum = len
      for (var i = 0; i < len; i++) {
        var val = parseInt(r.substr(4 + 2 * i, 2), 16)
        data.push(val)
        if (i < len - 1)
          sum += val
      }
      var crc = data.pop()
      var crc_check = 0xff - (sum & 0xff)
      if (crc != crc_check) {
        console.log("BAD CRC");
        break
      }
      switch (r[1]) {
        case '0':
          for (ch of data.splice(2))
            info += String.fromCharCode(ch)
          break;
        case '9':
          break;
        case '3': // 4-byte address
          var a = data.shift() << 24
          a += data.shift() << 16
          a += data.shift() << 8
          a += data.shift()
          blocks.push([a, data])
          break
        case '2': // 3-byte address
          var a = data.shift() << 16
          a += data.shift() << 8
          a += data.shift()
          blocks.push([a, data])
          break
        case '1': // 2-byte address
          var a = data.shift() << 8
          a += data.shift()
          blocks.push([a, data])
          break;
      }
    }
  }
  tot = 0
  for (b of blocks) {
    var a = b[0]
    var data = b[1]
    if (a < min_a)
      min_a = a
    if (a + data.length > max_a)
      max_a = a + data.length
    tot += data.length
  }
  return {
    info,
    min_a,
    max_a,
    tot,
    blocks
  }
}

module.exports = {
  read
}