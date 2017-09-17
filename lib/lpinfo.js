const _ = require('lodash');
const exec = require('child-process-promise').exec;

const RX_ITEM = /^[\w\d\s]+:|\n[\w\d\s]+:/;
const RX_KV = /([\w-_]+)[ ]*=([^\n]+|)/;

function parse(data) {
  return _.split(data, RX_ITEM).map(_.trim).filter(_.identity).map(item => {
    const answer = {};
    item.split('\n').map(_.trim).forEach(line => {
      const m = RX_KV.exec(line);
      if (m) answer[_.trim(m[1])] = _.trim(m[2]);
    });
    return answer;
  });
}

async function findDrivers(slug) {
  try {
    const makeAndModel = slug ? `--make-and-model "${slug}"` : '';
    const result = await exec(`lpinfo -l ${makeAndModel} -m`, {maxBuffer: 1024 * 1024});
    return parse(result.stdout.toString()).map(item => ({
      id: item['device-id'],
      makeAndModel: item['make-and-model'],
      lang: item['natural_language'],
      driver: item['name']
    }));
  } catch (e) {
    return [];
  }
}

async function listDevices() {
  try {
    const result = await exec('lpinfo -l -v', {maxBuffer: 1024 * 1024});
    return parse(result.stdout.toString()).map(item => ({
      uri: item['uri'],
      class: item['class'],
      info: item['info'],
      makeAndModel: item['make-and-model'],
      id: item['device-id'],
      location: item['location']
    }));
  } catch (e) {
    return [];
  }
}

module.exports = {
  listDevices,
  findDrivers,
  // expose internal function for test
  parse,
};

