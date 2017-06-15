const util = require("util");
const exec = require('child-process-promise').exec;
const execSync = require('child_process').execSync;
const EventEmitter = require('events').EventEmitter;
const _ = require("lodash");

const TLD = '.local';
const WILDCARD = '_services._dns-sd._udp' + TLD;

class Printer {

  constructor(name, uri) {
    this.isDefault = false;
    this.isShared = false;
    this.defaultMedia = 'A4';
    // define model of printer (PCL)
    this.driverPCL = "drv:///sample.drv/generpcl.ppd";

    // generic PS driver
    this.driverPS = "drv:///sample.drv/generic.ppd";

    // a generic driver or PPD file (PPD is a Printer Postscript Definition file)
    this._driverOrPpd = this.driverPS;

    //test
    this._driverOrPpd = false;//"/Library/Printers/PPDs/Contents/Resources/Brother HL-5270DN series CUPS.gz";

    this._name = name;
    this._uri = uri;

    this._options = null;
    if (typeof name === "string") {
      this._options = this.fetchOptions();
      this.isShared = Boolean(this._options['printer-is-shared']);
    }
  }

  fetchOptions() {
    let rx_options = /([\w\-_]+)=('.+?'|".+?"|.+?)(?:\s|$)/g;
    let cmd = `lpoptions -p ${this._name}`;

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

    let cmd = `lpadmin -p ${this._name}`;

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
    let cmd = `lpadmin -p "${this._name}"`;

    shared = Boolean(shared);
    cmd = `${cmd} -o printer-is-shared=${shared}`;
    return await exec(cmd);
  }

  /**
   * removes the printer from CUPS server
   * returns true|false of operation success
   *
   * @returns {boolean}
   */
  async uninstall() {
    return await exec(`lpadmin -x ${this._name}`);
  }
}

exports = module.exports = Printer;
