const _ = require('lodash');
const exec = require('child-process-promise').exec;
const utils = require('./utils');
const Printer = require('./printer');
const InstallablePrinter = require('./installable');

const cups = module.exports = {};

async function lpstat() {
  const cmd = 'lpstat -s';

  const result = await exec(cmd);

  if (result.stderr || !result.stdout) {
    return [];
  }

  // verify output to UTF-8
  const stdout = result.stdout.toString();

  // split the stdout into an array, by finding new lines
  const lines = stdout.split(/\r\n|[\n\r\u0085\u2028\u2029]/g).filter(_.identity);
  const defaults = _.trim(lines.splice(0, 1)[0].split(':')[1]);

  return _.map(lines, line => {
    const parts = line.split(/:(.+)?/);
    const name = parts[0].substring(parts[0].lastIndexOf(' ') + 1).trim();
    const connection = parts[1].trim();
    return {name, connection, isDefault: defaults === name};
  });
}

cups.get = cups.getPrinter = async function getPrinter(name) {
  const items = await lpstat();
  const item = _.find(items, item => name ? _.isEqual(_.toLower(item.name), _.toLower(name)) : item.isDefault);
  return item && new Printer(item);
};

cups.list = cups.listPrinter = async function listPrinters() {
  const items = await lpstat();
  return _.map(items, item => new Printer(item));
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

  const cmd = 'lpinfo -v';

  // run the find command, to discover devices
  const result = await exec(cmd);

  // verify output to UTF-8
  const stdout = result.stdout.toString();

  // split the stdout into an array, by finding new lines
  let lines = stdout.split(/\r\n|[\n\r\u0085\u2028\u2029]/g);
  if (_.isEmpty(lines)) {
    return;
  }

  const printers = lines.map(_.trim).filter(utils.accept).map(utils.parse)
    .map(item => opts.simple ? item : new InstallablePrinter(item.name, item));

  if (opts.flat) {
    return printers;
  }

  const answer = {};
  printers.forEach(printer => {
    answer[printer.type] = answer[printer.type] || [];
    answer[printer.type].push(printer);
  });
  return answer;
};

cups.findDrivers = async function findDrivers(slug, maxsize = 10) {
  try {
    const result = await exec(`lpinfo -l --make-and-model "${slug}" -m`, {maxBuffer: 1024 * 1024});
    const stdout = result.stdout.toString();
    const lines = stdout.split('\n');
    const answer = [];
    while (lines.length > 4 && (maxsize <= 0 || answer.length < maxsize)) {
      const parts = lines.splice(0, 4);
      answer.push({
        id: parts[3].split('=')[1].trim(),
        makeAndModel: parts[2].split('=')[1].trim(),
        lang: parts[1].split('=')[1].trim(),
        driver: parts[0].split('=')[1].trim()
      });
    }
    return answer;
  } catch (e) {
    return [];
  }
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

cups.uninstall = async function uninstall(name) {
  // remove the printer
  await exec(`lpadmin -x ${name}`);
};
