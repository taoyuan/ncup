const assert = require('chai').assert;
const lpinfo = require('../lib/lpinfo');
const s = require('./support');

const raw_devices = s.readFixture('devices.txt');
const json_devices = s.readJsonFixture('devices.json');

const raw_drivers = s.readFixture('drivers.txt');
const json_drivers = s.readJsonFixture('drivers.json');

describe('lpinfo', function () {
  this.timeout(30000);

  it('should parse devices', () => {
    assert.deepEqual(json_devices, lpinfo.parse(raw_devices));
  });

  it('should parse drivers', () => {
    // console.log(lpinfo.parse(raw_drivers));
    assert.deepEqual(json_drivers, lpinfo.parse(raw_drivers));
  });

  it('should find drivers', async () => {
    const drivers = await lpinfo.findDrivers();
    console.log(drivers);
  });

  it('should list devices', async () => {
    const devices = await lpinfo.listDevices();
    console.log(devices);
  });

  it('should find for printers', async () => {
    const devices = (await lpinfo.listDevices()).filter(d => {
      return (d.class === 'direct' && /(usb:\/\/)(.*)(\/)(.*)(\?)(.*)/.exec(d.uri))
        || (d.class === 'network' && /\/\/(.*?)\._/.exec(d.uri));
    });
    console.log(devices);
  });
});
