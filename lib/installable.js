const exec = require('child-process-promise').exec;
const _ = require("lodash");

const Printer = require('./printer');

const defaults = {
  connection: "unknown",
  uri: "unknown",
  protocol: "unknown",
  model: "unknown",
};

class InstallablePrinter extends Printer {

  /**
   * constructor
   * @param name
   * @param options
   */
  constructor(name, options) {
    super();

    let queuePredefined = false;

    if (typeof name !== "string") {
      options = name;
    } else {
      queuePredefined = true;
      this.name = name;
    }

    if (!options || !_.isObject(options)) {
      throw new Error("You may not instantiate a printer without a full system definition...");
    }

    const opts =  _.merge({}, defaults, options);


    if (!queuePredefined && !opts.queue) {
      this.name = opts.model.replace(/([^a-zA-Z0-9.])/gmi, "_"); // a printer queue may only contain letters, numbers, - and _
    } else if (!queuePredefined && opts.queue) {
      this.name = opts['queue'].replace(/([^a-zA-Z0-9.])/gmi, "_");
    } else if (queuePredefined) {
      this.name = name.replace(/([^a-zA-Z0-9.])/gmi, "_");
    }

    this.connection = opts.connection;

    if (opts.connection !== "unknown" && opts.uri !== "unknown") {
      this.uri = opts.uri;
    } else if (opts.connection !== "unknown" && opts.uri === "unknown") {
      this.uri = decodeURIComponent(this.connection);
    }

    this.protocol = opts.protocol;
    this.description = opts.model || "no description provided";
    this.model = /(.*?)(?=\s@|$)/mi.exec(opts.model)[1]; // removes any @ shared indicator like ... "printer @ ubuntuserver"
    this.location = opts.location || '';
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
    let cmd = `lpadmin -p "${this.name}" -v "${this.connection}" -m "${this.driverOrPpd}" -D "${this.description}" -L "${this.location}" -E`;
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
