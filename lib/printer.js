const exec = require('child-process-promise').exec;
const execSync = require('child_process').execSync;
const _ = require("lodash");

const TLD = '.local';
const WILDCARD = '_services._dns-sd._udp' + TLD;

class Printer {

  constructor(name, connection) {
    this.isDefault = false;
    this.shared = false;
    this.defaultMedia = 'A4';
    // define model of printer (PCL)
    this.driverPCL = "drv:///sample.drv/generpcl.ppd";

    // generic PS driver
    this.driverPS = "drv:///sample.drv/generic.ppd";

    // a generic driver or PPD file (PPD is a Printer Postscript Definition file)
    this.driverOrPpd = this.driverPS;

    //test
    this.driverOrPpd = false;//"/Library/Printers/PPDs/Contents/Resources/Brother HL-5270DN series CUPS.gz";

    this.name = name;
    this.connection = connection;

    this.options = null;
    if (typeof name === "string") {
      this.options = this.fetchOptions();
      this.shared = Boolean(this.options['printer-is-shared']);
    }
  }

  fetchOptions() {
    let rx_options = /([\w\-_]+)=('.+?'|".+?"|.+?)(?:\s|$)/g;
    let cmd = `lpoptions -p ${this.name}`;

    const result = execSync(cmd);
    // verify output to UTF-8
    const stdout = result.toString('utf8').replace('\n', '');

    const tmp = stdout.match(rx_options);
    const answer = {};
    _.forEach(tmp, (line) => {
      line = line.replace(/['"]/g, "");
      let lineSplit = line.split("=");
      answer[lineSplit[0]] = lineSplit[1].trim();
    });
    return answer;
  }

  /**
   * make the printer the default printer on the CUPS system
   */
  async makeDefault(name) {
    return await exec(`lpoptions -d ${name || this.name}`);
  }


  /**
   * remove network accessibility on the local network
   * @returns {boolean}
   */
  unshareOnNetwork(cb) {
    return this._setSharedOnNetwork(false);
  }


  /**
   * add network accessibility on the local network
   * @returns {boolean}
   */
  shareOnNetwork(cb) {
    return this._setSharedOnNetwork(true);
  }

  async setOptions(keyValues) {

    let arrOptions = [];
    if (_.isArray(keyValues)) {
      arrOptions = keyValues;
      _.forEach(arrOptions, (item) => {
        if (_.has(item, 'key') && _.has(item, 'value')) {
          arrOptions.push(item);
        }
      })
    } else {
      if (_.has(keyValues, 'key') && _.has(keyValues, 'value')) {
        arrOptions.push(keyValues);
      }

    }

    let cmd = `lpadmin -p ${this.name}`;

    if (arrOptions.length > 0) {
      _.forEach(arrOptions, (keyValuePair) => {
        cmd = cmd + ` -o ${keyValuePair.key}=${keyValuePair.value}`;
      });

      await exec(cmd);
    }
  }

  /**
   * make the printer accessible on the local network
   * @param {boolean} shared
   * @returns {boolean}
   */
  async _setSharedOnNetwork(shared) {
    // define command to add printer
    let cmd = `lpadmin -p "${this.name}"`;
    return await exec(`${cmd} -o printer-is-shared=${Boolean(shared)}`);
  }

  /**
   * removes the printer from CUPS server
   * returns true|false of operation success
   *
   * @returns {boolean}
   */
  async uninstall() {
    return await exec(`lpadmin -x ${this.name}`);
  }
}

exports = module.exports = Printer;
