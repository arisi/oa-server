

$(document).ready(async function () {
  console.log("OK rt0s");
  Handlebars.registerHelper('hex', (dec, size) => {
    if (dec == undefined)
      return "          "
    if (size == 2)
      return sprintf("0x%02X", dec)
    else if (size == 4)
      return sprintf("0x%04X", dec)
    return sprintf("0x%08X", dec)
  })
  window.Handlebars.registerHelper('select', (value, options) => {
    var $el = $('<select />').html(options.fn(this));
    $el.find('[value="' + value + '"]').attr({ 'selected': 'selected' });
    return $el.html();
  })

  var set_reg = async (key, reg, val) => {
    var ret = await mq.rt0s_write('L', reg['a'], [val])
    get_reg(key,reg)
    return ret
  }

  var get_reg = async (key, reg) => {
    var ret = await mq.rt0s_read('L', reg['a'], 1)
    if (!ret || ret[0] == undefined)
      return -1
    reg['val'] = ret[0]
    var s = sprintf("0x%08X", reg['val'])

    $(`#${reg.id}`).html(s)
    for (var b = 0; b < 32; b++) {
      var bn = `#${reg.id}_${b}`
      if ((1 << b) & reg['val']) {
        $(bn).addClass("on")
        $(bn).removeClass("off")
      } else {
        $(bn).addClass("off")
        $(bn).removeClass("on")
      }
    }
    for (var d in reg['d']) {
      var obj = reg['d'][d]
      var bn = `#${reg.id}_${d}`
      var val = (reg['val'] >> obj.p) & ((1 << obj.s) - 1)
      if (obj.s == 32)
        val = reg['val']
      obj['val'] = val
      var vs
      if (obj.s > 16)
        vs = sprintf("0x%08X", val)
      else if (obj.s > 8)
        vs = sprintf("0x%04X", val)
      else if (obj.s > 4)
        vs = sprintf("0x%04X", val)
      else
        vs = sprintf("%d", val)
      $(bn).html(":" + vs)
      $(bn + "_s").html(vs)
    }
    return 0
  }
  var online = false
  var tick_busy = false
  var objs ={}

  var get_regs = async () => {
    var cnt = 0
    //try {
      for (var [key, reg] of Object.entries(objs['regs'])) {
        if (reg['poll'] || reg['poll_once']) {
          var [mode, per] = reg['poll'].split(":")

          var now = Rt0s.stamps()
          if (reg['poll_once'] || reg['polled'] + parseInt(per) < now) {
            //console.log("readin", key,reg['polled'] ,now);
            try {
              var ret = await get_reg(key, reg)
              if (ret) {
                console.log("failed", reg);
                return;
              }

            } catch (error) {
              console.log("erred", reg, error);
              return;

            }
            reg['polled'] = now
            reg['poll_once'] = false
            //$(`#${reg['id']}_regtable`).addClass("green")
            //$(`#${reg['id']}_regtable`).addClass("done")
            cnt += 1
          }
        }
        if (cnt > 3)
          break;
      }
      /*for (var [key, reg] of Object.entries(objs['syms'])) {
        if (reg['poll']) {
          await get_reg(key, reg)
        }
      }*/
      for (var [key, reg] of Object.entries(objs['regs'])) {
        if (reg['polled']) {
          var age = Math.round(now - reg['polled'])
          $(`#${reg.id}_polltime`).html(age)
          var r=200
          var g=255
          var b=200
          if (age < 10)
            g=255-age*10
          $(`#${reg['id']}_regtable`).attr('style',`background-color: rgb(${r},${g},${b})`);
        }
      }
    //} catch (error) {
    //  console.log("timeouted", error);
    //}
  }
  var tick = () => {
    if (online) {
      if (tick_busy) {
        console.log("busy");
        //return;
      }
      tick_busy = true
      get_regs()
      console.log("tick", tick_busy);
      tick_busy = false
    }
  }
  setInterval(tick.bind(this), 300)
  var onChange = async (s) => {
    console.log("changed", s);
    if (s) {
      var hb_regs = Handlebars.compile($('#hb_regs').html())
      var hb_status = Handlebars.compile($('#hb_status').html())
      $("#regs").html(hb_regs(objs));

      get_regs()

      mq.req_ind("tif", "read32ack", (a, b) => {
        console.log("watch", a.topic, JSON.stringify(b));
      })
      mq.req_ind("broker", "state", (a, status) => {
        $("#status").html(hb_status(status));
      })
    }
    online = s
  }
  var conf = JSON.parse(await Rt0s.get_file("conf.json"))
  objs = {
    regs: {
      ...JSON.parse(await Rt0s.get_file("syms.json")),
      ...JSON5.parse(await Rt0s.get_file("gen.json5")),
    }
  }
  console.log("got syms",objs);

  var view = {
    'GPIO:DOUT31_0': { poll: "p:1" },
    'GPIO:DIN31_0': { poll: "p:1" },
    'GPIO:DOE31_0': { poll: "", poll_once:true },
    'IOC2:IOCFG': { poll: "" },
    'PRCM:.+': { poll: "p:10" },
    'AONRTC:SEC': { poll: "p:1" },
    'AONRTC:SUBSEC': { poll: "p:1" },
    'AONRTC:TIME': { poll: "p:1" },
    'RFCDBELL:.+': { poll: "p:1" },
    'AONPMCTL:.+': { poll: "" },
    'AONBATMON:.+': { poll: "" },
    'RFCPWR:PWMCLKEN': { poll: "" },
    'FCFG:SHDW_DIE_.+': { poll: "" },
    'jeps': { poll: "" , poll_once:true},
  }

  for (var [key, reg] of Object.entries(objs['regs'])) {
    var ok = false
    for (var k of Object.keys(view)) {
      var re = new RegExp(k)
      var hit = key.match(re)
      if (hit) {
        ok = view[k]
        break
      }
    }
    if (!ok) {
      continue
    }

    reg['poll'] = ""
    objs['regs'][key] = {
      ... reg,
      ...ok,
      poks: 123,
      show: true,
      polled: 0,
      val: 0,
      id: key.replace(":", "_")
    }
    console.log("duh", ok, reg);
    var flds = []
    var rowss = 2
    if ("d" in reg)
      if (Object.keys(reg['d']).length > 8)
        rowss = 4
    //console.log("check", reg['d'], rowss);
    var bits = 32 / rowss
    var fldss = []
    //continue

    for (var i = 0; i < 32; i++)
      flds.push({ name: "&nbsp;", size: 1, class: 'gray' })
    for (var d in reg['d']) {
      for (var i = 0; i < reg.d[d].s; i++)
        flds[31 - (reg.d[d].p + i)].name = d
    }

    for (var r = 0; r < rowss; r++) {
      fldss.push(flds.slice(r * bits, r * bits + bits))
    }
    for (var i = 0; i < fldss.length; i++) {
      var fn = fldss[i][0].name
      var cnt = 0
      var fx = []
      for (var j = 0; j < bits; j++) {
        if (fldss[i][j].name != fn || j == 0) {
          if (cnt)
            fx.push({ name: fn, size: cnt, class: fn == '&nbsp;' ? 'gray' : 'white' })
          fn = fldss[i][j].name;
          cnt = 0;
        }
        cnt += 1
      }
      if (cnt)
        fx.push({ name: fn, size: cnt, class: 'white' })
      fldss[i] = fx
    }

    objs['regs'][key]['rows'] = []
    var bit = 31;
    for (var r = 0; r < rowss; r++) {
      var bitss = []
      for (var b = 0; b < bits; b++)
        bitss.push(bit--)
      objs['regs'][key]['rows'].push({
        bits: bitss,
        flds: fldss[r],
      })
    }
  }
  //console.log("got", objs['regs']);

  /*
  (for (var [key, reg] of Object.entries(objs['syms'])) {
    if (["xtick", "mqttsn_seq", "calla", "calls", "jeps"].indexOf(key) != -1)
      reg['poll'] = true
  }
  */
  var mq = window.mq = new window.Rt0s(conf.mqtt, "weppi", conf.username, conf.password, onChange)

  window.change = (id) => {
    var val = $("#" + objs['regs'][id].id + "_poll").val()
    console.log("change", id, objs['regs'][id], val);
    objs['regs'][id].poll = val
  }

  window.poll_once = (id) => {
    console.log("poll_once", id, objs['regs'][id]);
    objs['regs'][id].poll_once = true
  }

  window.copy = (id) => {
    console.log("copy", id, objs['regs'][id]);
    var reg = objs['regs'][id]
    for (var [key, d] of Object.entries(reg.d)) {
      var id = `#${reg.id}_${key}_input`
      if ('val' in d) {
        console.log("f", key, d, id, d.val);
        if (d.s < 4)
          $(id).val(d.val)
        else
          $(id).val(sprintf("0x%X", d.val))
      }
    }
  }

  window.update = (id, fld) => {
    console.log("update", id, objs['regs'][id], fld);
    var reg = objs['regs'][id]
    var val = reg.val
    for (var [key, d] of Object.entries(reg.d)) {
      if (fld != 'all' && fld != key)
        continue
      var id = `#${reg.id}_${key}_input`
      val &= ~(((1 << d.s) - 1) << d.p)
      val |= (($(id).val() & (1 << d.s) - 1) << d.p)
      if (d.s == 32)
        val = $(id).val()
      console.log("f", key, d, id, d.val,$(id).val(), sprintf("%X",val));
    }
    set_reg(id,reg,val)
  }

  window.show = (idd) => {
    var id = objs['regs'][idd].id
    console.log("zhow", id, this, $("#" + id + "_tr").is(":hidden"));
    if ($("#" + id + "_tr").is(":hidden")) {
      copy(idd)
      $("#" + id + "_tr").show()
      $("#" + id + "_show").html("Hide")
    } else {
      $("#" + id + "_tr").hide()
      $("#" + id + "_show").html("Show")
    }
  }

  window.bshow = (id) => {
    console.log("bzhow", id, this, $("#" + id + "_b").is(":hidden"));
    if ($("#" + id + "_b").is(":hidden")) {
      $("#" + id + "_b").show()
    } else {
      $("#" + id + "_b").hide()
    }
  }

});
