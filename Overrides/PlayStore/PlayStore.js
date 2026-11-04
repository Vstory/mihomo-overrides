// Title: PlayStore 覆写（JavaScript）
// Description: 订阅里的全部节点自动并入 🛍️ Google Play 组并剔除伪节点；8 条域名规则前插
// Version: 0.0.2
// Last modified: 2026-11-04 23:54
// Changelog: route the Play download domain direct, keep store and API proxied
//
// 与 PlayStore.yaml 的区别：这个版本会把订阅里的**全部节点**自动塞进
//   🛍️ Google Play 组（不用手写节点名，换订阅、加节点都不用改），并剔掉机场塞的伪节点
//   （"剩余流量：948 GB""套餐到期"这类不是真节点的信息项）。
//   还会把订阅自带的那行「📱谷歌商店」组整个顶掉：组本身、指向它的规则、别的组对它的引用
//   一起清掉（引用清空后补 DIRECT，否则内核报 proxy group not found）。YAML 的键位只有
//   前插/追加/替换/合并、没有删除语义，做不到删组，只能留着那个组占位。
//   内核约定：main(config) 的入参出参都是整份配置对象（goja 执行、2 秒超时、输出上限 1 MB）。
//
// 域名清单取自 v2fly/domain-list-community 的 google-play 分类（与 geosite 同源），逐条转写：
//   普通项 → DOMAIN-SUFFIX；full:redirector.c.play.google.com → DOMAIN 精确匹配。
//   分类里带 @cn 的两条正则（^r+[0-9]+(---|\.)sn-(2x3|ni5|j5o)\w{5}\.xn--ngstr-lra8j\.com$ 与
//   同形的 googlevideo.com 版）不收：前者已被 DOMAIN-SUFFIX,xn--ngstr-lra8j.com 完全覆盖。
//
// xn--ngstr-lra8j.com 是 Play 的 APK/OBB 下载域，走 DIRECT；其余 Play 域名走本组。
//   原因：该域下的主机名（rr*---sn-j5o*/ni5*/2x3*）绑死在国内 GGC 节点上 —— j5o=广州、
//   ni5=上海、2x3=北京，实测本机 DNS、Google DoH、Cloudflare DoH 三方解析同一个主机名都返回
//   国内 IP（如 58.63.233.67、113.108.239.x，广州电信 AS4134），换 DNS 也拿不到境外地址。
//   这类 IP 从境外节点拨号必然 i/o timeout：实测验走代理时下载卡在 95%~98%、日志全是
//   dial tcp 113.108.239.x:443 超时；改回直连后同一批 APK 立刻下完，且不吃节点流量。
//   代价：换到本地直连不可达的网络（异地 SIM、公司网）下载会卡，那时把这行改成
//   ,🛍️ Google Play 走代理即可。
//
// 不收 gvt1.com / gvt2.com：那是 Chrome 与 Google 组件更新域，收进来会连带把系统更新流量也代理掉，
// 超出 Play 商店的范围。
// 没有 IP 规则：Play 的商店与 API 都在 Google 自有 Anycast 上，没有可按网段收的独立段。
function main(config) {
  var GROUP = '🛍️ Google Play';
  // 组图标走 Mishka 的 IconLoader：网络图片 + 磁盘缓存，PNG 最好（BitmapFactory 不解码 .ico）
  var ICON = 'https://raw.githubusercontent.com/Vstory/mihomo-overrides/main/Icons/png/PlayStore.png';
  // 机场惯用伪节点名，命中就不进组（想连这些信息节点也能选的话，删掉这一行）
  var FAKE = /剩余流量|剩余|距离下次|套餐到期|过期|到期时间|官网|重置|流量重置/;

  // 国家/地区清单：[显示名, 节点名匹配正则]
  //   · (?i) 必须带：内核 filter 走 regexp2 默认区分大小写，节点名大小写混用（hk / HK / Hk）
  //   · 两字母代码必须包 \b 词边界：否则 US 会命中 Russia、IN 会命中 Singapore 这种子串误伤
  //   · 中文单字只保留不会串门的（港/美/日…），"新""印"这类太宽的一律不进正则
  var REGIONS = [
    ['香港', '🇭🇰', '香港|🇭🇰|\\bhk\\b|hong ?kong|港'],
    ['台湾', '🇹🇼', '台湾|台灣|🇹🇼|\\btw\\b|taiwan|台'],
    ['日本', '🇯🇵', '日本|🇯🇵|\\bjp\\b|japan|日'],
    ['韩国', '🇰🇷', '韩国|韓國|🇰🇷|\\bkr\\b|korea|韩|韓'],
    ['新加坡', '🇸🇬', '新加坡|狮城|獅城|🇸🇬|\\bsg\\b|singapore'],
    ['美国', '🇺🇸', '美国|美國|🇺🇸|\\bus\\b|\\busa\\b|united ?states|美'],
    ['英国', '🇬🇧', '英国|英國|🇬🇧|\\buk\\b|\\bgb\\b|united ?kingdom|英'],
    ['德国', '🇩🇪', '德国|德國|🇩🇪|\\bde\\b|germany|德'],
    ['荷兰', '🇳🇱', '荷兰|荷蘭|🇳🇱|\\bnl\\b|netherlands|荷'],
    ['俄罗斯', '🇷🇺', '俄罗斯|俄羅斯|🇷🇺|\\bru\\b|russia|俄'],
    ['加拿大', '🇨🇦', '加拿大|🇨🇦|\\bca\\b|canada'],
    ['澳大利亚', '🇦🇺', '澳大利亚|澳洲|🇦🇺|\\bau\\b|australia|澳'],
    ['法国', '🇫🇷', '法国|法國|🇫🇷|\\bfr\\b|france|法'],
    ['马来西亚', '🇲🇾', '马来西亚|馬來西亞|🇲🇾|\\bmy\\b|malaysia'],
    ['泰国', '🇹🇭', '泰国|泰國|🇹🇭|\\bth\\b|thailand|泰'],
    ['越南', '🇻🇳', '越南|🇻🇳|\\bvn\\b|vietnam|越'],
    ['印度', '🇮🇳', '印度(?!尼西亚)|🇮🇳|\\bin\\b|india'],
    ['印度尼西亚', '🇮🇩', '印度尼西亚|印尼|🇮🇩|\\bid\\b|indonesia'],
    ['菲律宾', '🇵🇭', '菲律宾|菲律賓|🇵🇭|\\bph\\b|philippines'],
    ['土耳其', '🇹🇷', '土耳其|🇹🇷|\\btr\\b|turkey|türkiye|土'],
    ['巴西', '🇧🇷', '巴西|🇧🇷|\\bbr\\b|brazil'],
    ['阿联酋', '🇦🇪', '阿联酋|🇦🇪|\\bae\\b|emirates|dubai'],
    ['意大利', '🇮🇹', '意大利|義大利|🇮🇹|\\bit\\b|italy'],
    ['西班牙', '🇪🇸', '西班牙|🇪🇸|\\bes\\b|spain'],
  ];

  var groups = config['proxy-groups'] || [];
  var groupNames = {};
  var i;
  for (i = 0; i < groups.length; i++) {
    if (groups[i] && groups[i].name) groupNames[groups[i].name] = true;
  }

  // ---- 顶掉订阅自带的 Play 商店组 ----
  // 订阅把 Play 单独分进一个「📱谷歌商店」组，固定指向日本等境外节点；而 Play 的下载域
  // xn--ngstr-lra8j.com 解析出来是国内 GGC 地址，出境连它必然 i/o timeout。这个组留着只会
  // 抢走流量，所以连组、指向它的规则、别的组对它的引用一起清掉，Play 统一归本组。
  // 组名靠关键词认（各家 emoji 与空格写法不同），先排除自己的组名，否则会把自己删掉。
  var STORE_RE = /谷歌商店|谷歌应用商店|google ?play|play ?商店|play商店/i;
  var dropped = {};
  for (i = 0; i < groups.length; i++) {
    var gName = groups[i] && groups[i].name;
    if (gName && gName !== GROUP && STORE_RE.test(gName)) dropped[gName] = true;
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
    var regionReg = new RegExp(REGIONS[r][2], 'i');
    for (i = 0; i < nodeNames.length; i++) {
      if (regionReg.test(nodeNames[i])) {
        hit[REGIONS[r][0]] = true;
        break;
      }
    }
  }

  // 前面的覆写可能已经定义过同名地区组（三个覆写可任意组合启用），
  // 组名全局唯一，重复定义会让内核报 duplicate name，所以只补缺不覆盖
  var existing = {};
  var curGroups = config['proxy-groups'] || [];
  for (r = 0; r < curGroups.length; r++) existing[curGroups[r].name] = true;

  var regionGroups = [];
  var regionNames = [];
  for (r = 0; r < REGIONS.length; r++) {
    if (inlineScan && !hit[REGIONS[r][0]]) continue;
    var regionName = REGIONS[r][1] + ' ' + REGIONS[r][0];
    regionNames.push(regionName);
    if (existing[regionName]) continue;
    regionGroups.push({
      name: regionName,
      type: 'url-test',
      'include-all': true,
      filter: '(?i)' + REGIONS[r][2],
      url: 'https://www.gstatic.com/generate_204',
      interval: 300,
      tolerance: 50,
      lazy: true,
      'empty-fallback': 'DIRECT'
    });
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
    if (!groups[i]) continue;
    if (drop[groups[i].name] || dropped[groups[i].name]) continue;
    rest.push(groups[i]);
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
    rest.push.apply(rest, regionGroups);
  }
  // 别的组可能把它列进了 proxies（🐟漏网之鱼 之类）：组已删，引用留着内核会报
  // "proxy group not found"；清空后补 DIRECT，避免留下空 proxies 的组
  for (i = 0; i < rest.length; i++) {
    var g = rest[i];
    if (!g || !g.proxies || !g.proxies.length) continue;
    var keptProxies = [];
    for (var j = 0; j < g.proxies.length; j++) {
      if (!dropped[g.proxies[j]]) keptProxies.push(g.proxies[j]);
    }
    if (keptProxies.length !== g.proxies.length) {
      g.proxies = keptProxies.length ? keptProxies : ['DIRECT'];
    }
  }
  config['proxy-groups'] = rest;

  var rules = [
    // 下载域直连：解析出来是国内 GGC，从境外节点连必然超时（见文件头说明）
    'DOMAIN-SUFFIX,xn--ngstr-lra8j.com,DIRECT',
    'DOMAIN-SUFFIX,play.google.com,' + GROUP,
    'DOMAIN-SUFFIX,googleplay.com,' + GROUP,
    'DOMAIN-SUFFIX,play.googleapis.com,' + GROUP,
    'DOMAIN-SUFFIX,play-fe.googleapis.com,' + GROUP,
    'DOMAIN-SUFFIX,play-lh.googleusercontent.com,' + GROUP,
    'DOMAIN-SUFFIX,play-games.googleusercontent.com,' + GROUP,
    'DOMAIN,redirector.c.play.google.com,' + GROUP
  ];

  // 剔掉目标组是本组、或已被删掉的商店组的旧规则：旧版写过别的域名时，只比对全等会留下残骸
  var oldRules = config.rules || [];
  var kept = [];
  for (i = 0; i < oldRules.length; i++) {
    var ruleLine = oldRules[i];
    if (typeof ruleLine !== 'string') {
      kept.push(ruleLine);
      continue;
    }
    if (ruleLine.indexOf(',' + GROUP) >= 0) continue;
    var cut = ruleLine.lastIndexOf(',');
    if (cut >= 0 && dropped[ruleLine.slice(cut + 1).trim()]) continue;
    kept.push(ruleLine);
  }
  config.rules = rules.concat(kept);

  return config;
}
