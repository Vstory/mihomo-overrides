// MEGA 覆写（JavaScript）。与 mega.yaml 的区别：这个版本会把订阅里的**全部节点**自动塞进
//   🌐 MEGA 组（不用手写节点名，换订阅、加节点都不用改），并剔掉机场塞的伪节点
//   （"剩余流量：948 GB""套餐到期"这类不是真节点的信息项）。
//   内核约定：main(config) 的入参出参都是整份配置对象（goja 执行、2 秒超时、输出上限 1 MB）。
function main(config) {
  var GROUP = '🌐 MEGA';
  // 组图标走 Mishka 的 IconLoader：网络图片 + 磁盘缓存，PNG 最好（BitmapFactory 不解码 .ico）
  var ICON = 'https://raw.githubusercontent.com/Vstory/mihomo-overrides/main/icons/mega.png';
  // 机场惯用伪节点名，命中就不进组（想连这些信息节点也能选的话，删掉这一行）
  var FAKE = /剩余流量|剩余|距离下次|套餐到期|过期|到期时间|官网|重置|流量重置/;

  var groups = config['proxy-groups'] || [];
  var groupNames = {};
  var i;
  for (i = 0; i < groups.length; i++) {
    if (groups[i] && groups[i].name) groupNames[groups[i].name] = true;
  }

  // 组首选项：只引用订阅里真实存在的分组名 —— 硬写不存在的组会让内核整个配置校验失败
  var lead = [];
  if (groupNames['♻️自动选择']) lead.push('♻️自动选择');
  if (groupNames['🚀节点选择']) lead.push('🚀节点选择');
  lead.push('DIRECT');

  var nodeNames = [];
  var seen = {};
  var proxies = config.proxies || [];
  for (i = 0; i < proxies.length; i++) {
    var n = proxies[i] && proxies[i].name;
    if (!n || FAKE.test(n) || seen[n] || lead.indexOf(n) >= 0) continue;
    seen[n] = true;
    nodeNames.push(n);
  }

  // 节点走 proxy-providers 的订阅：proxies 为空，得用 use 把 provider 整包引进来
  var use = [];
  var pp = config['proxy-providers'] || {};
  for (var k in pp) {
    if (Object.prototype.hasOwnProperty.call(pp, k)) use.push(k);
  }

  var group = { name: GROUP, type: 'select', icon: ICON, proxies: lead.concat(nodeNames) };
  if (use.length > 0) group.use = use;

  // 同名旧组先删：同一覆写被反复选中时不会叠出两个同名组
  var rest = [];
  for (i = 0; i < groups.length; i++) {
    if (!groups[i] || groups[i].name !== GROUP) rest.push(groups[i]);
  }
  rest.unshift(group);  // Mishka 按 proxy-groups 原始顺序排列，push 会掉到列表最底部
  config['proxy-groups'] = rest;

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

  // 先剔掉旧的同款规则再前插：重复选中同一覆写不会越叠越多
  var oldRules = config.rules || [];
  var kept = [];
  for (j = 0; j < oldRules.length; j++) {
    if (mega.indexOf(oldRules[j]) < 0) kept.push(oldRules[j]);
  }
  config.rules = mega.concat(kept);
  return config;
}
