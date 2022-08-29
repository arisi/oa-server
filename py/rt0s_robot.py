# pylint: disable=missing-module-docstring
# pylint: disable=missing-class-docstring
# pylint: disable=missing-function-docstring
# pylint: disable=invalid-name

from rt0s_py import rt0s
import json5,time

class rt0s_robot():
  ROBOT_LIBRARY_SCOPE = "TEST SUITE"
  mq = None
  buf = 0x020007800
  databuf = 0x020007900
  regs = { }
  syms = { }
  dut = "dut2"
  indication = False

  def __init__(self):
    pass

  def rt0s_connect(self, url, username, password, client_id):
    self.mq = rt0s(url, username=username, password=password, client_id=client_id)

  def got_ind(self, ret, error=None, ctx = {}):
    #print("*WARN* IND:",ret,error)
    self.indication = True

  def get_ind(self, topic):
    #self.indication = False
    return self.indication

  def select_dut(self, dut):
    self.dut = dut
    self.mq.req_ind(self.dut, '+', self.got_ind)

  def rt0s_read_cpu(self, fn):
    f = open(fn)
    self.regs = json5.load(f)
    self.regs['status']={'s': 2, 'a': self.buf+2, 'd': {}}
    f.close()

  def rt0s_read_syms(self, fn):
    f = open(fn)
    self.syms = json5.load(f)
    f.close()

  def rt0s_get_sym(self, id):
    if id in self.syms:
      return self.syms[id]
    return False

  def rt0s_ident(self, options = None):
    ret = self.mq.call(self.dut,['send',{"topic":"ident","level": 0}], options)
    #print("*WARN* returns:",ret)
    if ret and "fw" in ret and "cpu" in ret:
      return {
        'cpu': "".join(map(chr, ret['cpu'])),
        'fw': "".join(map(chr, ret['fw'])),
        'serno': "".join(map(chr, ret['serno'])),
        'hw': "".join(map(chr, ret['hw'])),
        }
    raise AssertionError("Failed to read ident DUT")

  def rt0s_read(self, sizes, address, l, options = None):
    size = int(sizes)
    if size == 1:
      verb = "read8"
    elif size == 2:
      verb = "read16"
    elif size == 4:
      verb = "read32"
    else:
      raise AssertionError("Bad read size: %s" % size)
    print("*WARN* rt0s_read", size, address, l, verb)
    ret = self.mq.call(self.dut,[verb, {"address": address, "data_len": l}], options)
    print("*WARN* returns:",ret)
    if ret and "data" in ret:
      return ret['data']
    raise AssertionError("Failed to read from DUT")

  def rt0s_read_One(self, size, address):
    return self.rt0s_read(size, address,1)[0]

  def rt0s_write_one(self, sizes, address, data, options = None):
    if not isinstance(data, int):
      data= int(data, 0)
    return self.rt0s_write(sizes,address,[data],options)

  def rt0s_write(self, sizes, address, data, options = None):
    size = int(sizes)
    if isinstance(data, str):
      data = eval(data)
    #address = int(address_s)
    #print("*WARN* %d,%08X,%s" % ( size,address,data))
    if size == 1:
      verb = "write8"
    elif size == 2:
      verb = "write16"
    elif size == 4:
      verb = "write32"
    else:
      raise AssertionError("Bad write size: %s" % size)
    #print("*WARN* Rt0s Write:",address, len(data), data)
    ret = self.mq.call(self.dut,[verb, {"address": address, "data_len": len(data), "data":data}], options)
    if ret and "success" in ret:
      return ret['success']
    raise AssertionError("Failed to write to DUT")

  def rt0s_call(self, fn, options = ""):
    addr = self.rt0s_get_sym(fn)
    if addr:
      print("*WARN* callin", fn, addr)
      ret = self.mq.call(self.dut, ['call',{"address":addr['a']}],options)
      if ret:
        return ret
    else:
      print("*WARN* no fun", fn)
    print("*WARN* call fails")
    return None

  def rt0s_write_buf(self, sizes, offset, data, options = None):
    #print("*WARN* rt0s_write_buf",  sizes, offset, data)
    return self.rt0s_write(sizes,self.buf+int(offset),data,options)

  def rt0s_write_buf_one(self, sizes, offset, data, options = None):
    if not isinstance(data, int):
      data= int(data, 0)
    #print("*WARN* rt0s_write_buf",  sizes, offset, data)
    return self.rt0s_write(sizes,self.buf+int(offset),[data],options)

  def dump(self, a,len):
    s = "%0.8X: " % a
    data = self.rt0s_read(1,a,len)
    if data:
      for d in data:
        s+= "%0.2x " % d
      print("*WARN*", s)
    else:
      print("err")


  def dump_buf(self, len=36):
    i=0
    while i<len:
      self.dump(self.buf+i,8)
      i+=8

  def clr_flags(self):
    self.rt0s_wreg('RFCDBELL:RFHWIFG',0)
    self.rt0s_wreg('RFCDBELL:RFCPEIFG',0)
    self.rt0s_wreg('status',0)


  def show_status(self):
    v = self.regs['status']['v']
    if v==0x3804:
      s = "PROP_ERROR_NO_FS Synthesizer was not programmed when running RX or TX"
    elif v==0x0000:
      s = "IDLE"
    elif v==0x0405:
      s = "DONE_ABORT Operation aborted by abort command"
    elif v==0x3405:
      s = "PROP_DONE_ABORT Operation aborted by abort command"
    elif v==0x0807:
      s = "ERROR_NO_SETUP Operation using RX, TX or synthesizer attempted without CMD_RADIO_SETUP"
    elif v==0x0808:
      s = "ERROR_NO_FS Operation using RX or TX attempted without the synthesizer being programmed or powered on."
    elif v==0x0400:
      s = "DONE_OK Operation ended normally"
    elif v==0x1400:
      s = "BLE_DONE_OK Operation ended normally"
    elif v==0x3400:
      s = "PROP_DONE_OK Operation ended normally"
    elif v==0x0002:
      s = "ACTIVE !!!!!!!!!!!!"
    elif v==0x0001:
      s = "PENDING !!!!!!!!!!!!"
    else:
      s = "strange status %04X" % v
    print("*WARN*", s)


  def rt0s_cmd_raw(self, ptr):
    self.clr_flags()
    self.rt0s_wreg('RFCDBELL:CMDR', int(ptr))
    tick=0
    while self.rt0s_rreg('RFCDBELL:CMDR')['val'] != 0:
      if tick>3:
        AssertionError("TIMEOUT")
      tick+=1
      print("*WARN* CMDR busy -- waitin to complete..",self.regs['RFCDBELL:CMDR']['v'])
      time.sleep(0.2)
    tick=0
    while self.rt0s_rreg('RFCDBELL:CMDSTA')['val'] != 1: # done?
      if self.regs['RFCDBELL:CMDSTA']['v']== 0x85:
        AssertionError("Context Error")
        return
      elif self.regs['RFCDBELL:CMDSTA']['v']== 0x86:
        AssertionError("Scheduling Error")
        return
      elif self.regs['RFCDBELL:CMDSTA']['v']== 0x87:
        AssertionError("ParError")
        return
      if tick>3:
        AssertionError("TIMEOUT")
        return
      tick+=1
      print("*WARN* CMDSTA pending -- waitin..", self.regs['RFCDBELL:CMDSTA']['v'])
      time.sleep(0.2)
    tick=0
    while self.rt0s_rreg('status')['val']  == 2:
      if tick>3:
        AssertionError("TIMEOUT with status")
        return
      print("*WARN* after command .. status active -- waitin..",self.regs['status']['v'])
      time.sleep(1)
      tick +=1
    self.show_status()
    if self.regs['RFCDBELL:CMDSTA']['v'] == 1:
      pass
    else:
      AssertionError("NOT OK: CMDSTA: %04X" % self.regs['RFCDBELL:CMDSTA']['v'])
    self.clr_flags()

  def rt0s_cmd(self, cmds):
    cmd = False
    if cmds == 'CMD_BLE5_RADIO_SETUP':
      cmd = 0x1820
      exp_status = None
      len = 36
    elif cmds == 'CMD_FS':
      cmd = 0x0803
      exp_status = 0x0400
      len = 24
    elif cmds == 'CMD_SYNC_START_RAT':
      cmd = 0x080a
      exp_status = 0x0400
      len = 20
    elif cmds == 'CMD_PROP_TX_ADV':
      cmd = 0x3803
      exp_status = 0x3400
      len = 32
    else:
      raise AssertionError("Bad DB Command", cmds)

    self.rt0s_write(2, self.buf, [cmd])
    self.rt0s_write(1, self.buf+13, [1]) # no linked cmd
    while self.rt0s_rreg('RFCDBELL:CMDR')['val'] != 0:
      print("*WARN* RFCDBELL:CMDR busy -- waitin..", self.regs['RFCDBELL:CMDR']['v'])
      time.sleep(1)
      tick=0

    self.clr_flags()
    self.rt0s_wreg('RFCDBELL:CMDR', self.buf)
    tick=0
    while self.rt0s_rreg('RFCDBELL:CMDR')['val'] != 0:
      if tick>3:
        AssertionError("TIMEOUT")
      tick+=1
      print("*WARN* CMDR busy -- waitin to complete..",self.regs['RFCDBELL:CMDR']['v'])
      time.sleep(0.2)
    tick=0
    while self.rt0s_rreg('RFCDBELL:CMDSTA')['val'] != 1: # done?
      if self.regs['RFCDBELL:CMDSTA']['v']== 0x85:
        AssertionError("Context Error")
        return
      elif self.regs['RFCDBELL:CMDSTA']['v']== 0x86:
        AssertionError("Scheduling Error")
        return
      elif self.regs['RFCDBELL:CMDSTA']['v']== 0x87:
        AssertionError("ParError")
        return
      if tick>3:
        AssertionError("TIMEOUT")
        return
      tick+=1
      print("*WARN* CMDSTA pending -- waitin..", self.regs['RFCDBELL:CMDSTA']['v'])
      time.sleep(0.2)
    tick=0
    while self.rt0s_rreg('status')['val']  == 2:
      if tick>3:
        AssertionError("TIMEOUT with status")
        return
      print("*WARN* after command .. status active -- waitin..",self.regs['status']['v'])
      time.sleep(1)
      tick +=1
    self.show_status()
    if exp_status != None:
      if self.regs['status']['v']==exp_status and self.regs['RFCDBELL:CMDSTA']['v']==1:
        #print("OK")
        pass
      else:
        AssertionError("NOT OK: status: %04X, CMDSTA: %04X" % (self.regs['status']['v'],self.regs['RFCDBELL:CMDSTA']['v']))
    else:
      if self.regs['RFCDBELL:CMDSTA']['v'] == 1:
        pass
      else:
        AssertionError("NOT OK: CMDSTA: %04X" % self.regs['RFCDBELL:CMDSTA']['v'])
    self.clr_flags()

  def rt0s_rreg(self, reg, options = None):
    if reg in self.regs:
      ret=self.rt0s_read(self.regs[reg]['s'], self.regs[reg]['a'],1)
      if not ret:
        print("rreg fails", reg)
      else:
        val= { "val": ret[0] }
        self.regs[reg]['v'] = ret[0]
        for key in self.regs[reg]['d']:
          fld = self.regs[reg]['d'][key]
          fld['v'] = (self.regs[reg]['v'] >> fld['p']) & ((1<< fld['s'])-1)
          val[key]=fld['v']
        return val
    else:
      raise AssertionError("bad reg %s", reg)

  def rt0s_wreg(self, reg, v, options = None):
    if reg in self.regs:
      ack=self.rt0s_write(self.regs[reg]['s'], self.regs[reg]['a'], [v], options)
      if not ack:
        raise AssertionError("Wreg fails", reg, v)
    else:
      raise AssertionError("Bad Reg %s " %  reg)
    return True

  def rt0s_clr_buf(self):
    self.rt0s_write(1, self.buf,[0,0,0,0,0,0,0,0])
    self.rt0s_write(1, self.buf+8,[0,0,0,0,0,0,0,0])
    self.rt0s_write(1, self.buf+16,[0,0,0,0,0,0,0,0])
    self.rt0s_write(1, self.buf+24,[0,0,0,0,0,0,0,0])
    self.rt0s_write(1, self.buf+32,[0,0,0,0,0,0,0,0])

  def rt0s_flags(self):
    ret={}
    for reg in self.regs:
      ret[reg] = self.rt0s_rreg(reg)
      #print("%-10.10s: 0x%0.8x " % (reg,rreg(reg)))
    return ret

  def rt0s_disconnect(self):
    self.mq.disconnect()
