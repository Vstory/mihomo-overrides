// Version 2.8.1 · 2026-10-22 23:52 ── keep auto-select, node-select and DIRECT at the very top of the group
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

  // 组首选项：只引用订阅里真实存在的分组名 —— 硬写不存在的组会让内核整个配置校验失败。
  // include-all 只并节点和 provider，不会并 proxy-groups，所以运营商聚合组必须自己挑进来；
  // 按「推荐节点」后缀匹配，机场换 emoji 或加运营商都不用改这里。
  var lead = [];
  if (groupNames['♻️自动选择']) lead.push('♻️自动选择');
  if (groupNames['🚀节点选择']) lead.push('🚀节点选择');
  lead.push('DIRECT');
  for (i = 0; i < groups.length; i++) {
    var leadName = groups[i] && groups[i].name;
    if (leadName && /推荐节点$/.test(leadName) && lead.indexOf(leadName) < 0) lead.push(leadName);
  }

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

  // 域名走 GEOSITE：Mishka 构建时把 meta-rules-dat 的 latest geosite.dat 打进 APK，
  // 里面的 mega 分类就是 v2fly domain-list-community 的 data/mega（7 条）
  var mega = ['GEOSITE,mega,' + GROUP];
  // 网段取两个 ASN 的公开公告前缀全量，不聚合（聚合会漏掉 2a0b:e46:1::/48 这类零散前缀）
  var cidrs = ['162.208.16.0/24','185.206.24.0/24','185.206.25.0/24','185.206.26.0/24','185.206.27.0/24','217.180.20.0/24','217.180.21.0/24','31.216.144.0/24','31.216.145.0/24','31.216.146.0/24','31.216.147.0/24','31.216.148.0/24','66.203.124.0/24','66.203.125.0/24','66.203.126.0/23','82.21.172.0/24','82.29.203.0/24','82.29.204.0/24','82.29.205.0/24','82.29.206.0/24','82.29.207.0/24','89.44.168.0/24','89.44.169.0/24','94.24.36.0/24','94.24.37.0/24'];
  var cidrs6 = ['2001:678:25c::/48','2001:67c:1998::/48','2a09:a381:100::/40','2a09:a381::/40','2a0b:e40:1::/48','2a0b:e40:2::/48','2a0b:e40:3::/48','2a0b:e41:1::/48','2a0b:e41:2::/48','2a0b:e42:1::/48','2a0b:e43:1::/48','2a0b:e43::/40','2a0b:e44:1::/48','2a0b:e44:3::/48','2a0b:e44:4::/48','2a0b:e44:5::/48','2a0b:e44:6::/48','2a0b:e44:7::/48','2a0b:e45:1::/48','2a0b:e46:1::/48'];
  var k;
  for (k = 0; k < cidrs.length; k++) mega.push('IP-CIDR,' + cidrs[k] + ',' + GROUP + ',no-resolve');
  for (k = 0; k < cidrs6.length; k++) mega.push('IP-CIDR6,' + cidrs6[k] + ',' + GROUP + ',no-resolve');
  mega.push('IP-ASN,203055,' + GROUP + ',no-resolve');
  mega.push('IP-ASN,205809,' + GROUP + ',no-resolve');

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
