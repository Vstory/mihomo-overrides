// MEGA 覆写（JavaScript）。与 mega.yaml 等价，Mishka 的覆写支持 YAML / JavaScript 两种格式：
//   内核把整份订阅配置交进来（main(config)），返回值就是套用后的配置。
//   选 JS 的好处是能按条件改、能去重；只想改规则的话 YAML 版更省事。
function main(config) {
  var GROUP = '🌐 MEGA';
  var PROXIES = ['🚀节点选择', '♻️自动选择', 'DIRECT'];  // 换订阅时改这一行

  var groups = config['proxy-groups'] || [];
  var exists = false;
  for (var i = 0; i < groups.length; i++) {
    if (groups[i] && groups[i].name === GROUP) { exists = true; break; }
  }
  if (!exists) {
    groups.push({ name: GROUP, type: 'select', proxies: PROXIES.slice() });
  }
  config['proxy-groups'] = groups;

  var domains = ['mega.nz', 'mega.io', 'mega.co.nz'];
  var cidrs = [
    '31.216.144.0/22', '31.216.148.0/24', '66.203.124.0/22',
    '82.21.172.0/24', '82.29.203.0/24', '82.29.204.0/22',
    '89.44.168.0/23', '94.24.36.0/23', '162.208.16.0/24',
    '185.206.24.0/22', '217.180.20.0/23'
  ];
  var cidrs6 = [
    '2001:67c:1998::/48', '2001:678:25c::/48', '2a09:a381::/39',
    '2a0b:e40::/31', '2a0b:e42::/31', '2a0b:e44::/31'
  ];

  var mega = [];
  var j;
  for (j = 0; j < domains.length; j++) mega.push('DOMAIN-SUFFIX,' + domains[j] + ',' + GROUP);
  for (j = 0; j < cidrs.length; j++) mega.push('IP-CIDR,' + cidrs[j] + ',' + GROUP + ',no-resolve');
  for (j = 0; j < cidrs6.length; j++) mega.push('IP-CIDR6,' + cidrs6[j] + ',' + GROUP + ',no-resolve');

  // 先剔掉旧的同款规则再前插：重复选中同一覆写不会越叠越多，也不会出现两份互相打架的组。
  var rest = (config.rules || []).filter(function (r) { return mega.indexOf(r) < 0; });
  config.rules = mega.concat(rest);
  return config;
}
