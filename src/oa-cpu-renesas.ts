import { OaCpu } from "./oa-cpu";

export class OaCpuRenesas extends OaCpu {
  async probe(dev: any): Promise<boolean> {
    return new Promise((res) => {
      console.log("probe ra", dev);
      res(false);
    })
  }
}