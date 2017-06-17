const util = require("util");
const exec = require('child-process-promise').exec;
const _ = require("lodash");

const Printer = require('./printer');

//const mdns = require('multicast-dns');

const defaults = {
  uri: "unknown",
  uri_pretty: "unknown",
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

    // call constructor of parent class
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

    if (queuePredefined !== true && !opts['queue']) {
      this.name = opts.model.replace(/([^a-zA-Z0-9.])/gmi, "_"); // a printer queue may only contain letters, numbers, - and _
    } else if (queuePredefined !== true && opts['queue']) {
      this.name = opts['queue'].replace(/([^a-zA-Z0-9.])/gmi, "_");
    } else if (queuePredefined === true) {
      this.name = name.replace(/([^a-zA-Z0-9.])/gmi, "_");
    }

    this.uri = opts.uri;

    if (opts.uri !== "unknown" && opts.uri_pretty !== "unknown") {
      this.uri_pretty = opts.uri_pretty;
    } else if (opts.uri !== "unknown" && opts.uri_pretty === "unknown") {
      this.uri_pretty = decodeURIComponent(this.uri);

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
   * set the driver uri
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

    // set default media
    cmd = `${cmd} -o media=${this.defaultMedia}`;

    if (this.shared === false) {
      cmd = `${cmd} -o printer-is-shared=false`
    } else {
      cmd = `${cmd} -o printer-is-shared=true`
    }

    // execute printer installation
    await exec(cmd);
    if (this.isDefault === true) {
      cmd = `lpoptions -d ${this.name}`;
      await exec(`lpoptions -d ${this.name}`)
    }
  }
}

module.exports = InstallablePrinter;
