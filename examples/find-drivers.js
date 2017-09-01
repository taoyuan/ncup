/**
 * Created by taoyuan on 2017/6/15.
 */

const cups = require('..');

(async () => {
  await find('HP DeskJet 5820 series');
  await find('Brother');
})();

async function find(slugs) {
  console.log(`* Finding drivers with slugs - [${slugs}]`);
  let drivers = await cups.findDrivers(slugs);
  const count = drivers && drivers.length;
  console.log(`Found ${count} drivers --`);

  if (count) {
    console.log(drivers);
  }

  console.log('----')
}

