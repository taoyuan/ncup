/**
 * Created by taoyuan on 2017/6/15.
 */

const Manager = require('../lib/manager');
const manager = new Manager();

(async () => {
  console.log(await manager.list());
})();

