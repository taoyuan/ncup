const cups = require('..');

(async () => {
  const uninstalled = await cups.uninstall('all');
  console.log('Uninstalled:', uninstalled);
})();

