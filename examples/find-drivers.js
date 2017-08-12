/**
 * Created by taoyuan on 2017/6/15.
 */

const Manager = require('../lib/manager');
const manager = new Manager();

(async () => {
  await find(['HP DeskJet 5820 series', 'HP Color LaserJet CM1312 MFP Series']);
  await find('Brother');
})();

async function find(slugs) {
  console.log(`* Finding drivers with slugs - [${slugs}]`);
  let drivers = await manager.findDrivers(slugs);
  const count = drivers && drivers.length;
  console.log(`Found ${count} drivers --`);

  if (count) {
    console.log(drivers);
  }

  console.log('----')
}

