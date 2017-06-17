/**
 * Created by taoyuan on 2017/6/17.
 */

const _ = require('lodash');
const Manager = require('../lib/manager');
const manager = new Manager();

(async () => {
  const printer = await manager.get();
  const options = await printer.fetchSpecificOptions();
  console.log('Printer Specific Options:');
  console.log('---');
  console.log(options);

  const key = Object.keys(options)[0];
  const data = options[key];

  const current = data.value;
  const target = _.find(data.options, option => option !== data.value);

  console.log('');
  console.log('Change Options Test:');
  console.log('---');
  console.log(key, '=', data.value);

  await printer.setDefaultOptions({[key]: target});
  console.log(key, '=', (await printer.fetchSpecificOptions())[key].value);

  await printer.setDefaultOptions({[key]: current});
  console.log(key, '=', (await printer.fetchSpecificOptions())[key].value);
})();

