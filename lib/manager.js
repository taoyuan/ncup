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

    // verify output to UTF-8
    const stdout = result.stdout.toString('utf8');

    // split the stdout into an array, by finding new lines
    const lines = stdout.split(/\r\n|[\n\r\u0085\u2028\u2029]/g);
    lines.splice(0, 1);
    lines.splice(-1);

    const answer = [];
    _.forEach(lines, (item, index) => {
      item = item.split(/:(.+)?/);
      item[0] = item[0].substring(item[0].lastIndexOf(' ') + 1).trim();
      item[1] = item[1].trim();
      answer.push(new Printer(item[0], item[1]));
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

    // const options = {
    //   shouldSort: true,
    //   tokenize: true,
    //   matchAllTokens: true,
    //   threshold: 0,
    //   location: 0,
    //   distance: 100,
    //   maxPatternLength: 32,
    //   minMatchCharLength: 1,
    //   keys: [
    //     'makeAndModel',
    //   ]
    // };
    // const fuse = new Fuse(drivers, options);
    // const tokens = slug.split(/[ ]/);
    // let index = tokens.length;
    // let results = [];
    // while (index > 0 && results.length === 0) {
    //   results = fuse.search(tokens.slice(0, index--).join(' '));
    // }
    // return results
  }


  async install(name, opts) {

    // define printer name
    var name = 'nodeJS_printer';
    // define a description of the printer
    var description = 'Printer added via nodeJS application';
    // define a location
    var location = 'connected to pliigo-box';
    // define destination of printer
    var connection = 'dnssd://Photosmart%205510d%20series%20%5B4DAE43%5D._pdl-datastream._tcp.local./?uuid=1c852a4d-b800-1f08-abcd-2c768a4dae43';

    // define model of printer (PCL)
    var model = 'drv:///sample.drv/deskjet.ppd';

    // generic PS driver
    var modelPS = 'drv:///sample.drv/generic.ppd';
    /**
     * all generic printer drivers...

     drv:///sample.drv/generpcl.ppd Generic PCL Laser Printer
     drv:///sample.drv/generic.ppd Generic PostScript Printer


     drv:///sample.drv/dymo.ppd Dymo Label Printer
     drv:///sample.drv/epson9.ppd Epson 9-Pin Series
     drv:///sample.drv/epson24.ppd Epson 24-Pin Series

     drv:///sample.drv/deskjet.ppd HP DeskJet Series
     drv:///sample.drv/laserjet.ppd HP LaserJet Series PCL 4/5

     drv:///sample.drv/intelbar.ppd Intellitech IntelliBar Label Printer, 2.1

     drv:///sample.drv/okidata9.ppd Oki 9-Pin Series
     drv:///sample.drv/okidat24.ppd Oki 24-Pin Series

     drv:///sample.drv/zebracpl.ppd Zebra CPCL Label Printer
     drv:///sample.drv/zebraep1.ppd Zebra EPL1 Label Printer
     drv:///sample.drv/zebraep2.ppd Zebra EPL2 Label Printer
     drv:///sample.drv/zebra.ppd Zebra ZPL Label Printer
     */


    var isDefault = true;
    var isShared = true;
    var defaultMedia = 'A4';

    // define command to add printer
    var cmd = `lpadmin -p '${name}' -v '${connection}' -m '${model}' -D '${description}' -L '${location}' -E`;


    // set default media
    cmd = `${cmd} -o media=${defaultMedia}`;

    if (isShared === false) {
      cmd = `${cmd} -o printer-is-shared=false`
    } else {
      cmd = `${cmd} -o printer-is-shared=true`
    }

    // execute printer installation
    await exec(cmd);
    if (isDefault === true) {
      await exec(`lpoptions -d ${name}`)
    }

  }

  async uninstallPrinter(name) {
    // remove the printer
    await exec(`lpadmin -x ${name}`);
  }

  setDefaultPrinter(name) {

  }
}


module.exports = Manager;

