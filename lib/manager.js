const util = require('util');
const path = require('path');
const exec = require('child-process-promise').exec;
const EventEmitter = require('events').EventEmitter;
const _ = require('lodash');
// const Fuse = require('fuse.js');
const fuzzy = require('fuzzy');
//const mdns = require('multicast-dns');
const InstallablePrinter = require('./installable');
const Printer = require('./Printer');

const TLD = '.local';
const WILDCARD = '_services._dns-sd._udp' + TLD;

class Manager extends EventEmitter {

  /**
   * constructor
   */
  constructor(initValue) {

    // call parent constructor of EventEmitter
    super();


    //this.mdns = mdns();
    //
    //this.mdns.query({
    //    questions: [{name:WILDCARD, type:'ANY'}]
    //}, ()=>{
    //    console.log('sent questions');
    //});
    //
    //
    //this.mdns.on('response', (packet, rinfo) => {
    //
    //    console.log('on response');
    //    console.log('rinfo', rinfo);
    //    console.log('packet', packet);
    //
    //});

    //this.mdns.on('query', (packet, rinfo) => {
    //
    //    console.log('on query');
    //    console.log('rinfo', rinfo);
    //    console.log('packet', packet);
    //
    //});


  }

  static getIgnoredDevices() {
    return ['http', 'https', 'ipp', 'ipps', 'lpd', 'smb', 'socket', 'fax', 'canonoipnets2', 'cnips2', 'epsonfax', 'hpfax'];
  }

  /**
   * returns an array of printer ojects, that are currently installed to the system
   */
  async list() {
    const cmd = 'lpstat -s';

    const result = await exec(cmd);

    if (result.stderr || !result.stdout) {
      return [];
    }

    // verify output to UTF-8
    const stdout = result.stdout.toString('utf8');

    // split the stdout into an array, by finding new lines
    const lines = stdout.split(/\r\n|[\n\r\u0085\u2028\u2029]/g);
    lines.splice(0, 1);
    lines.splice(-1);

    const answer = [];
    _.forEach(lines, line => {
      const parts = line.split(/:(.+)?/);
      parts[0] = parts[0].substring(parts[0].lastIndexOf(' ') + 1).trim();
      parts[1] = parts[1].trim();
      answer.push(new Printer(parts[0], parts[1]));
    });

    return answer;
  }


  /**
   * search for available printers available on the network or directly attached (e.g. USB)
   */
  async discover() {
    /**
     * the printers object, that will be returned
     * structure
     * @type {}
     * @structure:
     *
     * {
     *  network: [
     *      {
     *         uri: 'dnssd://Brother%20HL-5270DN%20series._pdl-datastream._tcp.local./?bidi',
     *         uri_decoded: 'dnssd://Brother HL-5270DN series._pdl-datastream._tcp.local./?bidi',
     *         protocol: dnssd,
     *         name: 'Brother HL-5270DN series'
     *      },
     *      {
     *         uri: 'dnssd://Brother%20HL-2030._pdl-datastream._tcp.local./?bidi',
     *         uri_decoded: 'dnssd://Brother HL-2030._pdl-datastream._tcp.local./?bidi',
     *         protocol: dnssd,
     *         name: 'Brother HL-2030'
     *      }
     *  ],
     *  direct: []
     * }
     *
     */
    const answer = {};


    /**
     * define command to discover devices
     * lpinfo:
     *
     * lists the available devices or drivers known to the CUPS server.  The first form
     * (-m)  lists  the  available  drivers,  while  the  second form (-v) lists the available
     * devices.
     */
    const cmd = 'lpinfo -v';

    // run the find command, to discover devices
    const result = await exec(cmd);

    // verify output to UTF-8
    const stdout = result.stdout.toString('utf8');

    // split the stdout into an array, by finding new lines
    let lines = stdout.split(/\r\n|[\n\r\u0085\u2028\u2029]/g);
    if (!_.isArray(lines)) {
      return answer;
    }
    lines = lines.map(line => line && line.trim()).filter(line => Boolean(line));
    lines.forEach(item => {
      const parts = item.split(' ');
      if (_.isArray(parts)) {
        const type = parts[1];
        const protocol = parts[0];

        if (!Manager.getIgnoredDevices().includes(type)) {

          if (!_.isArray(answer[protocol])) {
            answer[protocol] = [];
          }

          //let rx = /(^([a-zA-Z]*)\:\/\/)(.*)/gmi;
          const rx_type = /(^([a-zA-Z].*):\/\/)/gmi;

          const rx_usb = /(usb:\/\/)(.*)(\/)(.*)(\?)(.*)/gmi;
          const rx_network = /\/\/(.*?)\._/gmi;

          const uri = type;
          const uri_decoded = decodeURIComponent(type);
          const regexed_type = rx_type.exec(uri_decoded);
          let connection_type = "";
          if (Array.isArray(regexed_type) && regexed_type[2]) {
            connection_type = regexed_type[2]; // usb|socket|dnssd|...
          }

          let model = "";
          let make = "";

          if (connection_type === 'usb') {
            let regexed_usb = rx_usb.exec(uri_decoded);
            if (Array.isArray(regexed_usb) && regexed_usb[2] && regexed_usb[4]) {
              model = regexed_usb[2] + ' ' + regexed_usb[4];
            } else {
              model = 'unknown';
            }
          } else {
            let regexed_network = rx_network.exec(uri_decoded);

            if (Array.isArray(regexed_network) && regexed_network[1]) {
              model = regexed_network[1];
            } else {
              model = 'unknown';
            }
          }

          const name = "";//regexed[3] || 'no name';
          const params = {
            uri: type,
            uri_pretty: uri_decoded,
            protocol: connection_type,
            //make: make,
            model
          };

          answer[protocol].push(new InstallablePrinter(params))
        }
      }
    });

    return answer;
  }

  async findDrivers(slug) {
    // list all available drivers
    const result = await exec(`lpinfo -l -m`);
    const stdout = result.stdout.toString('utf8');
    const lines = stdout.split('\n');
    const drivers = [];
    while (lines.length > 4) {
      const parts = lines.splice(0, 4);
      drivers.push({
        driver: parts[0].split('=')[1].trim(),
        lang: parts[1].split('=')[1].trim(),
        makeAndModel: parts[2].split('=')[1].trim(),
        id: parts[3].split('=')[1].trim()
      });
    }

    if (!slug) {
      return drivers;
    }

    const options = {extract: el => el.makeAndModel};
    const tokens = slug.split(' ');
    let index = tokens.length;
    let results = [];
    while (index > 0 && results.length === 0) {
      results = fuzzy.filter(tokens.slice(0, index--).join(' '), drivers, options);
    }
    return results.map(item => item.original);
  }

  async install(printer, opts) {
    if (typeof printer === 'string') {
      const printers = _.flatten(_.values(await this.discover()));
      printer = _.find(printers, p => p.name === printer);
    }
    if (!printer) {
      return;
    }
    Object.assign(printer, opts);
    await printer.install();
  }

  async uninstall(name) {
    // remove the printer
    await exec(`lpadmin -x ${name}`);
  }

  setDefaultPrinter(name) {

  }
}


module.exports = Manager;

