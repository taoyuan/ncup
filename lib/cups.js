const _ = require('lodash');
const exec = require('child-process-promise').exec;
const lpinfo = require('./lpinfo');
const lpstat = require('./lpstat');
const Printer = require('./printer');
const InstallablePrinter = require('./installable');

const RX_USB = /(usb:\/\/)(.*)(\/)(.*)(\?)(.*)/;
const RX_NETWORK = /\/\/(.*?)\._/;

const cups = module.exports = {};

cups.get = cups.getPrinter = async function getPrinter(name) {
  const items = await lpstat.listPrinters();
  const item = _.find(items, item => name ? _.isEqual(_.toLower(item.name), _.toLower(name)) : item.isDefault);
  return item && new Printer(item);
};

cups.list = cups.listPrinter = async function listPrinters() {
  return (await lpstat.listPrinters()).map(item => new Printer(item));
};

/**
 * the printers object, that will be returned
 * structure
 * @returns:
 *
 * {
     *  network: [
     *      {
     *         connection: 'dnssd://Brother%20HL-5270DN%20series._pdl-datastream._tcp.local./?bidi',
     *         uri: 'dnssd://Brother HL-5270DN series._pdl-datastream._tcp.local./?bidi',
     *         protocol: dnssd,
     *         name: 'Brother HL-5270DN series'
     *      },
     *      {
     *         connection: 'dnssd://Brother%20HL-2030._pdl-datastream._tcp.local./?bidi',
     *         uri: 'dnssd://Brother HL-2030._pdl-datastream._tcp.local./?bidi',
     *         protocol: dnssd,
     *         name: 'Brother HL-2030'
     *      }
     *  ],
     *  direct: []
     * }
 *
 */
cups.discover = async function discover(opts) {
  opts = Object.assign({simple: false, flat: false}, opts);

  const devices = await lpinfo.listDevices();
  let printers = devices.filter(d => {
    return (d.class === 'direct' && RX_USB.exec(d.uri))
      || (d.class === 'network' && RX_NETWORK.exec(d.uri));
  });
  if (!opts.simple) {
    printers = printers.map(data => new InstallablePrinter(data));
  }

  if (opts.flat) {
    return printers;
  }

  const answer = {};
  printers.forEach(printer => {
    answer[printer.class] = answer[printer.class] || [];
    answer[printer.class].push(printer);
  });
  return answer;
};

cups.findDrivers = async function findDrivers(slug, limit = 10) {
  const drivers = await lpinfo.findDrivers(slug);
  if (limit) {
    return drivers.slice(0, limit);
  }
  return drivers;
};

cups.install = async function install(printer, opts) {
  if (typeof printer === 'string') {
    const printers = _.flatten(_.values(await this.discover()));
    printer = _.find(printers, p => p.name === printer);
  }
  if (!printer) {
    return;
  }
  Object.assign(printer, opts);
  await printer.install();
};

cups.uninstall = async function uninstall(names) {
  if (_.isNil(names)) {
    // get default printer
    const printer = await cups.get();
    names = printer ? printer.name : null;
  } else if (names === '*' || names === 'all') {
    const printers = await cups.list();
    names = _.isEmpty(printers) ? null : printers.map(p => p.name);
  }

  if (_.isEmpty(names)) {
    return [];
  }

  names = Array.isArray(names) ? names : [names];

  for (let i = 0; i < names.length; i++) {
    await exec(`lpadmin -x ${names[i]}`);
  }
  return names;
};
