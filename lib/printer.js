const exec = require('child-process-promise').exec;
const execSync = require('child_process').execSync;
const _ = require("lodash");

const TLD = '.local';
const WILDCARD = '_services._dns-sd._udp' + TLD;

class Printer {

  constructor(opts) {
    if (typeof opts === 'string') {
      opts = {name: opts};
    }
    this.isDefault = Boolean(opts.isDefault);
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

    this.name = opts.name;
    this.connection = opts.connection;

    this.options = null;
    if (typeof this.name === "string") {
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
   *
   * Fetch printer specific options.
   *
   * @returns {Promise.<Object>}
   */
  async fetchSpecificOptions() {
    let cmd = `lpoptions -d ${this.name} -l`;
    const result = await exec(cmd);
    if (!result.stdout) {
      return {};
    }
    const stdout = result.stdout.toString('utf8');
    const lines = stdout.split('\n').map(_.trim).filter(_.identity);
    const pairs = _.map(lines, line => {
      const parts = line.split(':').map(part => _.trim(part));

      // parse name
      const names = parts[0].split('/');
      const name = names[0];

      // parse values
      let value = null;
      const options = parts[1].split(' ').map(option => {
        const v = option[0] === '*';
        option = v ? option.substr(1) : option;
        if (v) value = option;
        return option;
      });

      return [name, {value, options}];
    });

    return _.fromPairs(pairs);
  }

  /**
   * Set printer default options
   * @param {Object} options The options. ref: https://www.cups.org/doc/options.html
   * @returns {Promise.<*>}
   */
  async setDefaultOptions(options) {
    if (_.isEmpty(options)) {
      return;
    }
    let cmd = `lpoptions -d ${this.name}`;
    _.forEach(options, (value, key) => {
      cmd = `${cmd} -o ${key}=${value}`;
    });
    return await exec(cmd);
  }

  /**
   * make the printer the default printer on the CUPS system
   */
  async makeDefault() {
    return await exec(`lpoptions -d ${this.name}`);
  }

  /**
   * remove network accessibility on the local network
   * @returns {boolean}
   */
  unshare() {
    return this.setShared(false);
  }

  /**
   * add network accessibility on the local network
   * @returns {boolean}
   */
  share() {
    return this.setShared(true);
  }

  /**
   * Make the printer accessible on the local network
   * @param {boolean} shared
   * @returns {boolean}
   */
  async setShared(shared) {
    return await this.configure({'printer-is-shared': Boolean(shared)});
  }

  /**
   * Configure printer options
   * @param {Object} options The options. ref: https://www.cups.org/doc/man-lpadmin.html
   * @returns {Promise.<*>}
   */
  async configure(options) {
    if (_.isEmpty(options)) return;

    let cmd = `lpadmin -p ${this.name}`;
    _.forEach(options, (value, key) => {
      cmd = `${cmd} -o ${key}=${value}`;
    });

    return await exec(cmd);
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
