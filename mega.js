// MEGA 覆写（JavaScript）。与 mega.yaml 的区别：这个版本会把订阅里的**全部节点**自动塞进
//   MEGA 组（不用手写节点名，换订阅、加节点都不用改），并剔掉机场塞的伪节点
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
  // 组位置：插到「节点选择」「自动选择」之后。YAML 覆写只有前插/追加两种键位，
  // 落不到指定位置，所以这个版位只能在 JS 里算；两个锚点都不存在时退回最前
  var anchors = ['🚀节点选择', '♻️自动选择'];
  var insertAt = 0;
  for (i = 0; i < rest.length; i++) {
    if (rest[i] && anchors.indexOf(rest[i].name) >= 0 && i + 1 > insertAt) insertAt = i + 1;
  }
  rest.splice(insertAt, 0, group);
  config['proxy-groups'] = rest;

  // 规则来源见 mega.yaml 注释：域名走 rule-provider，IP 走 IP-ASN，都不需要手抄清单
  var providers = config['rule-providers'] || {};
  providers['mega-site'] = {
    type: 'http',
    behavior: 'domain',
    format: 'mrs',
    url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/mega.mrs',
    path: './ruleset/mega.mrs',
    interval: 86400
  };
  config['rule-providers'] = providers;

  var mega = [
    'RULE-SET,mega-site,' + GROUP,
    'IP-ASN,203055,' + GROUP + ',no-resolve',
    'IP-ASN,205809,' + GROUP + ',no-resolve'
  ];

  // 剔掉目标组是本组的旧规则：旧版写过 DOMAIN-SUFFIX/IP-CIDR，只比对全等会留下残骸
  var oldRules = config.rules || [];
  var kept = [];
  for (j = 0; j < oldRules.length; j++) {
    var r = oldRules[j];
    if (typeof r !== 'string' || r.indexOf(',' + GROUP) < 0) kept.push(r);
  }
  config.rules = mega.concat(kept);
  return config;
}
