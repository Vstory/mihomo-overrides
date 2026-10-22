// Version 2.5.0 · 2026-10-22 23:22 ── probe the MEGA group with generate_204 instead of mega.nz
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

  var nodeNames = [];
  var seen = {};
  var proxies = config.proxies || [];
  for (i = 0; i < proxies.length; i++) {
    var n = proxies[i] && proxies[i].name;
    if (!n || FAKE.test(n) || seen[n]) continue;
    seen[n] = true;
    nodeNames.push(n);
  }

  // 节点走 proxy-providers 的订阅：proxies 为空，得用 use 把 provider 整包引进来
  var use = [];
  var pp = config['proxy-providers'] || {};
  for (var k in pp) {
    if (Object.prototype.hasOwnProperty.call(pp, k)) use.push(k);
  }

  var group = {
    name: GROUP,
    type: 'url-test',
    url: 'https://www.gstatic.com/generate_204',
    interval: 300,
    tolerance: 50,
    icon: ICON,
    proxies: nodeNames
  };
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

  // 主力域名手写一份压在 RULE-SET 前面：provider 拉取失败时 RULE-SET 匹配不到任何域名，
  // 流量会一路落到订阅兜底规则，表现就是"规则没生效"
  var mega = [
    'DOMAIN-SUFFIX,mega.nz,' + GROUP,
    'DOMAIN-SUFFIX,mega.io,' + GROUP,
    'DOMAIN-SUFFIX,mega.co.nz,' + GROUP,
    'DOMAIN-SUFFIX,transfer.it,' + GROUP,
    'RULE-SET,mega-site,' + GROUP
  ];
  // 网段兜底：IP-ASN 依赖 ASN.mmdb 加载成功，网段不依赖任何数据文件
  var cidrs = ['31.216.144.0/22','31.216.148.0/24','66.203.124.0/22','82.21.172.0/24',
    '82.29.203.0/24','82.29.204.0/22','89.44.168.0/23','94.24.36.0/23',
    '162.208.16.0/24','185.206.24.0/22','217.180.20.0/23'];
  var cidrs6 = ['2001:67c:1998::/48','2001:678:25c::/48','2a09:a381::/39',
    '2a0b:e40::/31','2a0b:e42::/31','2a0b:e44::/31'];
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
