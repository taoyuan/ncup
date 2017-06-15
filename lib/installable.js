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
      this._name = name;
    }

    if (!options || !_.isObject(options)) {
      throw new Error("You may not instantiate a printer without a full system definition...");
    }

    const opts =  _.merge({}, defaults, options);

    if (queuePredefined !== true && !opts['queue']) {
      this._name = opts.model.replace(/([^a-zA-Z0-9.])/gmi, "_"); // a printer queue may only contain letters, numbers, - and _
    } else if (queuePredefined !== true && opts['queue']) {
      this._name = opts['queue'].replace(/([^a-zA-Z0-9.])/gmi, "_");
    } else if (queuePredefined === true) {
      this._name = name.replace(/([^a-zA-Z0-9.])/gmi, "_");
    }

    this._uri = opts.uri;

    if (opts.uri !== "unknown" && opts.uri_pretty !== "unknown") {
      this._uri_pretty = opts.uri_pretty;
    } else if (opts.uri !== "unknown" && opts.uri_pretty === "unknown") {
      this._uri_pretty = decodeURIComponent(this._uri);

    }

    this._protocol = opts.protocol;
    this._description = opts.model || "no description provided";
    this._model = /(.*?)(?=\s@|$)/mi.exec(opts.model)[1]; // removes any @ shared indicator like ... "printer @ ubuntuserver"
    this._location = "";
  }


  /**
   * sets the location parameter of the printer
   */
  _setLocation() {

  }

  /**
   * set the driver uri
   * @param driverUri
   */
  setDriver(driverUri) {
    if (!driverUri.indexOf("://") > 0) {
      driverUri = "/" + driverUri;
    }

    this._driverOrPpd = driverUri;
  }


  /**
   * Installs printer to CUPS server
   * returns true|false of operation success
   *
   * @returns {boolean}
   */
  async install() {
    if (this._driverOrPpd === false) {
      throw new Error("You can not install a printer without a driver of PPD defined");
    }

    // define command to add printer
    let cmd = `lpadmin -p "${this._name}" -v "${this._uri}" -m "${this._driverOrPpd}" -D "${this._description}" -L "${this._location}" -E`;

    // set default media
    cmd = `${cmd} -o media=${this.defaultMedia}`;

    if (this.isShared === false) {
      cmd = `${cmd} -o printer-is-shared=false`
    } else {
      cmd = `${cmd} -o printer-is-shared=true`
    }


    // execute printer installation
    await exec(cmd);
    if (this.isDefault === true) {
      cmd = `lpoptions -d ${this._name}`;
      await exec(`lpoptions -d ${this._name}`)
    }
  }
}

module.exports = InstallablePrinter;
