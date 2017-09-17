// const _ = require('lodash');

const IGNORED_DEVICES = exports.IGNORED_DEVICES =
  ['http', 'https', 'ipp', 'ipps', 'lpd', 'smb', 'socket', 'fax', 'canonoipnets2', 'cnips2', 'epsonfax', 'hpfax'];

exports.accept = line => {
  const parts = line.split(' ');
  if (parts.length < 2) {
    return false;
  }
  return !IGNORED_DEVICES.includes(parts[1]);
};

exports.parse = function (line) {
  const RX_TYPE = /(^([a-zA-Z].*):\/\/)/gmi;
  const RX_USB = /(usb:\/\/)(.*)(\/)(.*)(\?)(.*)/gmi;
  const RX_NETWORK = /\/\/(.*?)\._/gmi;
  // const RX_NETWORK_FQDN = /\/\/(.*?)\.[\/?#]/gmi;

  const parts = line.split(' ');
  if (parts.length < 2) {
    return;
  }
  const type = parts[0];
  const connection = parts[1];

  const uri = decodeURIComponent(connection);
  const regexed_type = RX_TYPE.exec(uri);
  let protocol = "";
  if (Array.isArray(regexed_type) && regexed_type[2]) {
    protocol = regexed_type[2]; // usb|socket|dnssd|...
  }

  let name = '';
  let model = '';

  if (protocol === 'usb') {
    const regexed_usb = RX_USB.exec(uri);
    if (Array.isArray(regexed_usb) && regexed_usb[2] && regexed_usb[4]) {
      model = regexed_usb[2] + ' ' + regexed_usb[4];
    } else {
      model = 'unknown';
    }
  } else {
    /**
     * 通过 lpinfo -v 获得的网络打印机信息，只包含 [描述]._ipp|_pdl-stream._tcp.local./... 内容，
     * 这里用 [描述] 部分内容作为型号信息，不过 [描述] 在 CUPS 系统下，默认为打印机型号，但用户可以修改。
     *
     * 另可用 Bonjour 来发现 ipp 和 pdl-stream 的打印设备，可利用其中的 txt 信息来参考型号信息，
     * 不过这样也有弊端，同一款打印机，在不同操作系统上的 CUPS 下，产品信息也不一样，这里还没有测试 Windows
     * 共享打印机的情况。
     *
     * 因此，网络打印机的型号仅对自带网络打印功能的网络打印机，以及默认 [描述] 的 CUPS 共享打印机负责。
     */

    const regexed_network = RX_NETWORK.exec(uri);

    if (Array.isArray(regexed_network) && regexed_network[1]) {
      model = regexed_network[1];
    } else {
      model = 'unknown';
    }

  }

  name = name || model;

  return {
    name,
    type,
    protocol,
    uri,
    model,
    connection,
    description: name
  };
};

function extractModel(product) {
  const RX_MODEL = /\((.*)\)|(.*)/ig;
  const regexed_model = RX_MODEL.exec(product);
  if (regexed_model) {
    return regexed_model[1] || regexed_model[2];
  }
}
