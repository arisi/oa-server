import { OaSerial } from "./oa-serial";
import { OaCpuTexas } from "./oa-cpu-texas";
import { OaCpuRenesas } from "./oa-cpu-renesas";

var xx = new OaSerial("dut")
//var cpus = [new OaCpuTexas(), new OaCpuRenesas()]

xx.on('found', async d =>  {
  console.log('\nfound', d['path'])
  //for (var cpu of cpus) {
  var cpu = new OaCpuTexas(d);
  var ok = await cpu.probe()
  if (ok) {
    //console.log("hit", cpu.name, d['path']);
    d.cpu = cpu
  } else {
    //console.log("not hit", cpu.name, d['path']);
  }
  //console.log(xx.devices);

})

xx.on('lost', d => {
  if (d.cpu && d.cpu.mq) {
    console.log("closin mqtt");
    d.cpu.mq.end();
  }
  //console.log('lostz', d['path'],d)
})

