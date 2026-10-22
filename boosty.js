// Version 1.0.0 · 2026-10-23 00:05 ── add Boosty: domain-only group, shared hosting so no IP rules
// Boosty 覆写（JavaScript）。与 boosty.yaml 的区别：这个版本会把订阅里的**全部节点**自动塞进
//   Boosty 组（不用手写节点名，换订阅、加节点都不用改），并剔掉机场塞的伪节点
//   （"剩余流量：948 GB""套餐到期"这类不是真节点的信息项）。
//   内核约定：main(config) 的入参出参都是整份配置对象（goja 执行、2 秒超时、输出上限 1 MB）。
//
//   只有域名规则，没有 IP 规则：boosty.to 解析到 AS42632 MnogoByte 的共享段，按 IP 收会误伤
//   同段其它客户站点；geosite 也没有 boosty 分类（只挂在 MAILRU-GROUP / CATEGORY-RU 下）。
function main(config) {
  var GROUP = '💰 Boosty';
  var ICON = 'https://raw.githubusercontent.com/Vstory/mihomo-overrides/main/icons/boosty.png';
  // 机场惯用伪节点名，命中就不进组（想连这些信息节点也能选的话，删掉这一行）
  var FAKE = /剩余流量|剩余|距离下次|套餐到期|过期|到期时间|官网|重置|流量重置/;

  var groups = config['proxy-groups'] || [];
  var groupNames = {};
  var i;
  for (i = 0; i < groups.length; i++) {
    if (groups[i] && groups[i].name) groupNames[groups[i].name] = true;
  }

  // 组首选项：只引用订阅里真实存在的分组名 —— 硬写不存在的组会让内核整个配置校验失败。
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

  var mega = ['DOMAIN-SUFFIX,boosty.to,' + GROUP];

  // 剔掉目标组是本组的旧规则：旧版写过别的域名时，只比对全等会留下残骸
  var oldRules = config.rules || [];
  var kept = [];
  for (i = 0; i < oldRules.length; i++) {
    var r = oldRules[i];
    if (typeof r !== 'string' || r.indexOf(',' + GROUP) < 0) kept.push(r);
  }
  config.rules = mega.concat(kept);

  return config;
}
