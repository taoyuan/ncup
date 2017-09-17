const fs = require('fs');
const path = require('path');

exports.readFixture = function (name) {
  return fs.readFileSync(path.resolve(__dirname, 'fixtures', name)).toString();
};

exports.readJsonFixture = function (name) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, 'fixtures', name)).toString());
};
