const _ = require('lodash');
const exec = require('child-process-promise').exec;

async function listPrinters() {
  const cmd = 'lpstat -s';

  try {
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
  } catch (e) {
    return [];
  }
}

module.exports = {
  listPrinters
};
