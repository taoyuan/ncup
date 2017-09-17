const exec = require('child-process-promise').exec;
const _ = require("lodash");

const RX_NAME = /([^a-zA-Z0-9.\-])/gmi;

const defaults = {
  class: 'unknown',
  model: "unknown",
  uri: "unknown",
  connection: "unknown",
};

class InstallablePrinter {

  /**
   * constructor
   * @param data
   */
  constructor(data) {
    if (!data || !_.isObject(data)) {
      throw new Error("You may not instantiate a printer without a full system definition...");
    }

    data =  Object.assign({}, defaults, data);

    let location = data.location || '';
    if (!location) {
      if (data.class === 'direct') {
        location = 'LOCAL';
      } else if (data.class === 'network') {
        location = 'REMOTE';
      }
    }

    const name = data.info || data.queue || '';
    this.name = name.replace(RX_NAME, '_').replace(/(_+)/gmi, '_');
    this.id = data.id;
    this.class = data.class;
    this.uri = data.uri;
    this.model = data.makeAndModel; // removes any @ shared indicator like ... "printer @ ubuntuserver"
    this.description = data.description || this.name;
    this.location = location;
  }

  get driver() {
    return this.driverOrPpd;
  }

  /**
   * set the driver connection
   * @param driverUri
   */
  set driver(driverUri) {
    if (!driverUri) {
      return;
    }

    if (!driverUri.indexOf("://") > 0) {
      driverUri = "/" + driverUri;
    }

    this.driverOrPpd = driverUri;
  }

  /**
   * Installs printer to CUPS server
   * returns true|false of operation success
   *
   * @returns {boolean}
   */
  async install() {
    if (this.driverOrPpd === false) {
      throw new Error("You can not install a printer without a driver of PPD defined");
    }

    // define command to add printer
    let cmd = `lpadmin -p "${this.name}" -v "${this.uri}" -m "${this.driverOrPpd}" -D "${this.description}" -L "${this.location}" -E`;
    cmd = `${cmd} -o media=${this.defaultMedia}`;
    cmd = `${cmd} -o printer-is-shared=${Boolean(this.shared)}`;

    // execute printer installation
    await exec(cmd);
    if (this.isDefault === true) {
      await exec(`lpoptions -d ${this.name}`)
    }
  }
}

module.exports = InstallablePrinter;
