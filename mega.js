// Version 0.0.1 · 2026-10-25 08:56 ── add per-country url-test groups (auto-pick the fastest node per country)
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

  // 国家/地区清单：[显示名, 节点名匹配正则]
  //   · (?i) 必须带：内核 filter 走 regexp2 默认区分大小写，节点名大小写混用（hk / HK / Hk）
  //   · 两字母代码必须包 \b 词边界：否则 US 会命中 Russia、IN 会命中 Singapore 这种子串误伤
  //   · 中文单字只保留不会串门的（港/美/日…），"新""印"这类太宽的一律不进正则
  var REGIONS = [
    ['香港', '香港|🇭🇰|\\bhk\\b|hong ?kong|港'],
    ['台湾', '台湾|台灣|🇹🇼|\\btw\\b|taiwan|台'],
    ['日本', '日本|🇯🇵|\\bjp\\b|japan|日'],
    ['韩国', '韩国|韓國|🇰🇷|\\bkr\\b|korea|韩|韓'],
    ['新加坡', '新加坡|狮城|獅城|🇸🇬|\\bsg\\b|singapore'],
    ['美国', '美国|美國|🇺🇸|\\bus\\b|\\busa\\b|united ?states|美'],
    ['英国', '英国|英國|🇬🇧|\\buk\\b|\\bgb\\b|united ?kingdom|英'],
    ['德国', '德国|德國|🇩🇪|\\bde\\b|germany|德'],
    ['荷兰', '荷兰|荷蘭|🇳🇱|\\bnl\\b|netherlands|荷'],
    ['俄罗斯', '俄罗斯|俄羅斯|🇷🇺|\\bru\\b|russia|俄'],
    ['加拿大', '加拿大|🇨🇦|\\bca\\b|canada|加'],
    ['澳大利亚', '澳大利亚|澳洲|🇦🇺|\\bau\\b|australia|澳'],
    ['法国', '法国|法國|🇫🇷|\\bfr\\b|france|法'],
    ['马来西亚', '马来西亚|馬來西亞|🇲🇾|\\bmy\\b|malaysia|马|馬'],
    ['泰国', '泰国|泰國|🇹🇭|\\bth\\b|thailand|泰'],
    ['越南', '越南|🇻🇳|\\bvn\\b|vietnam|越'],
    ['印度', '印度(?!尼西亚)|🇮🇳|\\bin\\b|india'],
    ['印度尼西亚', '印度尼西亚|印尼|🇮🇩|\\bid\\b|indonesia'],
    ['菲律宾', '菲律宾|菲律賓|🇵🇭|\\bph\\b|philippines'],
    ['土耳其', '土耳其|🇹🇷|\\btr\\b|turkey|türkiye|土'],
    ['巴西', '巴西|🇧🇷|\\bbr\\b|brazil|巴'],
    ['阿联酋', '阿联酋|阿拉伯|🇦🇪|\\bae\\b|emirates|dubai|阿'],
    ['意大利', '意大利|義大利|🇮🇹|\\bit\\b|italy'],
    ['西班牙', '西班牙|🇪🇸|\\bes\\b|spain'],
  ];

  var groups = config['proxy-groups'] || [];
  var groupNames = {};
  var i;
  for (i = 0; i < groups.length; i++) {
    if (groups[i] && groups[i].name) groupNames[groups[i].name] = true;
  }

  // 组首选项：只引用订阅里真实存在的分组名 —— 硬写不存在的组会让内核整个配置校验失败。
  // include-all 只并节点和 provider，不会并 proxy-groups，所以运营商聚合组必须自己挑进来；
  // 按「推荐节点」后缀匹配，机场换 emoji 或加运营商都不用改这里。
  var base = [];
  if (groupNames['♻️自动选择']) base.push('♻️自动选择');
  if (groupNames['🚀节点选择']) base.push('🚀节点选择');
  base.push('DIRECT');
  var extra = [];
  for (i = 0; i < groups.length; i++) {
    var leadName = groups[i] && groups[i].name;
    if (leadName && /推荐节点$/.test(leadName) && base.indexOf(leadName) < 0 && extra.indexOf(leadName) < 0) {
      extra.push(leadName);
    }
  }

  var nodeNames = [];
  var seen = {};
  var proxies = config.proxies || [];
  for (i = 0; i < proxies.length; i++) {
    var n = proxies[i] && proxies[i].name;
    if (!n || FAKE.test(n) || seen[n] || base.indexOf(n) >= 0) continue;
    seen[n] = true;
    nodeNames.push(n);
  }

  // 节点走 proxy-providers 的订阅：proxies 为空，得用 use 把 provider 整包引进来
  var use = [];
  var pp = config['proxy-providers'] || {};
  for (var k in pp) {
    if (Object.prototype.hasOwnProperty.call(pp, k)) use.push(k);
  }

  // ---- 国家/地区聚合 ----
  // 内联订阅：只为实际有节点的地区建组（没节点的地区不出现）。
  // provider 订阅：JS 读不到 provider 里的节点名，只能全建，空组靠 empty-fallback 落 DIRECT。
  // 组名带主组前缀（🌐 香港），三个覆写同时启用也不会撞名。
  var inlineScan = nodeNames.length > 0;
  var prefix = GROUP.split(' ')[0];
  var hit = {};
  var r;
  for (r = 0; r < REGIONS.length; r++) {
    var regionReg = new RegExp(REGIONS[r][1], 'i');
    for (i = 0; i < nodeNames.length; i++) {
      if (regionReg.test(nodeNames[i])) {
        hit[REGIONS[r][0]] = true;
        break;
      }
    }
  }

  var regionGroups = [];
  var regionNames = [];
  for (r = 0; r < REGIONS.length; r++) {
    if (inlineScan && !hit[REGIONS[r][0]]) continue;
    var regionName = prefix + ' ' + REGIONS[r][0];
    regionGroups.push({
      name: regionName,
      type: 'url-test',
      'include-all': true,
      filter: '(?i)' + REGIONS[r][1],
      url: 'https://www.gstatic.com/generate_204',
      interval: 300,
      tolerance: 50,
      lazy: true,
      'empty-fallback': 'DIRECT'
    });
    regionNames.push(regionName);
  }

  // 排版：自动选择 → 节点选择 → DIRECT → 国家/地区 → 订阅自带推荐节点组 → 平铺节点
  var group = {
    name: GROUP,
    type: 'select',
    icon: ICON,
    proxies: base.concat(regionNames, extra, nodeNames)
  };
  if (use.length > 0) group.use = use;

  // 同名旧组先删：同一覆写被反复选中时不会叠出两个同名组（主组与地区组一起清）
  var drop = {};
  drop[GROUP] = true;
  for (r = 0; r < REGIONS.length; r++) drop[prefix + ' ' + REGIONS[r][0]] = true;
  var rest = [];
  for (i = 0; i < groups.length; i++) {
    if (!groups[i] || !drop[groups[i].name]) rest.push(groups[i]);
  }
  // 组位置：插到「节点选择」「自动选择」之后。YAML 覆写只有前插/追加两种键位，
  // 落不到指定位置，所以这个版位只能在 JS 里算；两个锚点都不存在时退回最前
  var anchors = ['🚀节点选择', '♻️自动选择'];
  var insertAt = 0;
  for (i = 0; i < rest.length; i++) {
    if (rest[i] && anchors.indexOf(rest[i].name) >= 0 && i + 1 > insertAt) insertAt = i + 1;
  }
  rest.splice(insertAt, 0, group);
  if (regionGroups.length > 0) {
    rest.splice.apply(rest, [insertAt + 1, 0].concat(regionGroups));
  }
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
  for (var j = 0; j < oldRules.length; j++) {
    var ruleLine = oldRules[j];
    if (typeof ruleLine !== 'string' || ruleLine.indexOf(',' + GROUP) < 0) kept.push(ruleLine);
  }
  config.rules = mega.concat(kept);
  return config;
}
