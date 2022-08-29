
const yargs = require('yargs')

export class OaConfig {
  conf:any = {}
  p = path.join(home_dir, ".oa","config.json")
  target = path.join(p, "config.json")

  init(src: string) {
    console.log("\nCreating template configuration");
    if (!fs.existsSync(this.p)) {
      fs.mkdirSync(this.p)
      console.log("Created Path", this.p);
    } else {
      if (fs.existsSync(target)) {
        console.error("Error: Config file Already Exists,\nwill not overwrite:", this.target, "\n");
        process.exit(-1)
      }
    }
    console.log("Copying Template Config", src, "=>", this.target);
    console.log("Open Arm Directory:", pwd);

    var c = JSON.parse(fs.readFileSync(src).toString())
    fs.writeFileSync(target, JSON.stringify(c, null, 2))
    for (var dom of fs.readdirSync(key_src)) {
      var ps = path.join(key_src, dom)
      var pp = path.join(key_p, dom)
      console.log("Checking Domain Path", pp);
      if (!fs.existsSync(pp)) {
        fs.mkdirSync(pp)
        console.log("Created Path", pp);
      }
      console.log("Copying Keyfiles from domain", dom);
      for (var f of fs.readdirSync(ps)) {
        var ff = path.join(ps, f)
        var tt = path.join(key_p, dom, f)
        console.log("Copying Template Config", ff, "=>", tt);
        fs.copyFileSync(ff, tt)
      }
    }
  }
  constructor(yargs_config: string|boolean) {
    try {
      this.conf = JSON.parse(fs.readFileSync(path.join(home_dir, ".oa","config.json")))
    } catch (error) {
      console.error(`Config file ${yargs_config} missing`)
    }
    console.log("Using config from:", yargs_config);
  }
}