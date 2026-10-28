// Title: MEGA / Boosty / GitHub 合集覆写（JavaScript）
// Description: 四个应用合成一份，24 个国家/地区组只定义一次、四个主组共用；与单应用覆写二选一
// Version: 0.0.4
// Last modified: 2026-10-29 00:37
// Changelog: add Pornhub group
//
// 把 Overrides/ 下四个应用合成一份，省得逐个勾选。
//   24 个国家/地区组只定义一次，四个主组共用；**与单应用覆写二选一**——双方的清理逻辑都会
//   删掉同名主组，同时勾选会互相拆台。
//   内核约定：main(config) 的入参出参都是整份配置对象（goja 执行、2 秒超时、输出上限 1 MB）。
function main(config) {
  var ICON = 'https://raw.githubusercontent.com/Vstory/mihomo-overrides/main/Icons/png/';
  var FAKE = /剩余流量|剩余|距离下次|套餐到期|过期|到期时间|官网|重置|流量重置/;

  // 清单与单应用脚本逐字相同：改这里就得同步 Overrides/<app>/<app>.js，
  // Scripts/check_overrides.py 会逐条比对三个脚本的 filter
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

  // 每个应用一层规则，拼成 <类型>,<值>,<组名>[,no-resolve]
  var APPS = [
    {
      group: '🌐 MEGA', icon: 'Mega.png',
      geo: ['GEOSITE,mega'],
      cidr: ['162.208.16.0/24','185.206.24.0/24','185.206.25.0/24','185.206.26.0/24','185.206.27.0/24','217.180.20.0/24','217.180.21.0/24','31.216.144.0/24','31.216.145.0/24','31.216.146.0/24','31.216.147.0/24','31.216.148.0/24','66.203.124.0/24','66.203.125.0/24','66.203.126.0/23','82.21.172.0/24','82.29.203.0/24','82.29.204.0/24','82.29.205.0/24','82.29.206.0/24','82.29.207.0/24','89.44.168.0/24','89.44.169.0/24','94.24.36.0/24','94.24.37.0/24'],
      cidr6: ['2001:678:25c::/48','2001:67c:1998::/48','2a09:a381:100::/40','2a09:a381::/40','2a0b:e40:1::/48','2a0b:e40:2::/48','2a0b:e40:3::/48','2a0b:e41:1::/48','2a0b:e41:2::/48','2a0b:e42:1::/48','2a0b:e43:1::/48','2a0b:e43::/40','2a0b:e44:1::/48','2a0b:e44:3::/48','2a0b:e44:4::/48','2a0b:e44:5::/48','2a0b:e44:6::/48','2a0b:e44:7::/48','2a0b:e45:1::/48','2a0b:e46:1::/48'],
      asn: [203055, 205809]
    },
    {
      group: '💰 Boosty', icon: 'Boosty.png',
      suffix: ['boosty.to']
    },
    {
      group: '🐙 GitHub', icon: 'GitHub.png',
      suffix: ['github.com', 'githubusercontent.com', 'githubassets.com', 'github.dev', 'github.blog', 'github.community', 'githubapp.com', 'githubpreview.dev', 'ghe.com', 'gh.io', 'git.io', 'dependabot.com', 'repo.new']
    },
    {
      group: '🔞 Pornhub', icon: 'Pornhub.png',
      suffix: ['pornhub.com', 'pornhubpremium.com', 'pornhub.org', 'pornhub-deutsch.net', 'pornhubapparel.com', 'phncdn.com', 'phprcdn.com', 'gaytube.com', 'porngub.com']
    }
  ];

  var i, k, r;
  var curGroups = config['proxy-groups'] || [];

  var groupNames = {};
  for (i = 0; i < curGroups.length; i++) {
    if (curGroups[i] && curGroups[i].name) groupNames[curGroups[i].name] = true;
  }

  // 组首选项只引用订阅里真实存在的组名：硬写不存在的组会让内核整份配置校验失败
  var base = [];
  if (groupNames['♻️自动选择']) base.push('♻️自动选择');
  if (groupNames['🚀节点选择']) base.push('🚀节点选择');
  base.push('DIRECT');
  var extra = [];
  for (i = 0; i < curGroups.length; i++) {
    var lead = curGroups[i] && curGroups[i].name;
    if (lead && /推荐节点$/.test(lead) && base.indexOf(lead) < 0 && extra.indexOf(lead) < 0) {
      extra.push(lead);
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
  for (var pk in pp) {
    if (Object.prototype.hasOwnProperty.call(pp, pk)) use.push(pk);
  }

  // ---- 国家/地区组：全仓库只建这一份，各主组共用 ----
  // 内联订阅只为有节点的地区建组；provider 订阅读不到节点名，只能全建，空组靠 empty-fallback 落 DIRECT
  var inlineScan = nodeNames.length > 0;
  var hit = {};
  for (r = 0; r < REGIONS.length; r++) {
    var regionReg = new RegExp(REGIONS[r][2], 'i');
    for (i = 0; i < nodeNames.length; i++) {
      if (regionReg.test(nodeNames[i])) {
        hit[REGIONS[r][0]] = true;
        break;
      }
    }
  }

  // 前面的覆写可能已经定义过同名地区组，重复定义会让内核报 duplicate name，所以只补缺不覆盖
  var existing = {};
  for (i = 0; i < curGroups.length; i++) existing[curGroups[i].name] = true;

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

  // ---- 主组 + 各自规则 ----
  var drop = {};
  var newGroups = [];
  var newRules = [];
  for (k = 0; k < APPS.length; k++) {
    var app = APPS[k];
    drop[app.group] = true;

    var group = {
      name: app.group,
      type: 'select',
      icon: ICON + app.icon,
      proxies: base.concat(regionNames, extra, nodeNames)
    };
    if (use.length > 0) group.use = use;
    newGroups.push(group);

    // 域名/GEOSITE 排在 IP 前面：能判就直接判，不必等解析
    if (app.geo) for (i = 0; i < app.geo.length; i++) newRules.push(app.geo[i] + ',' + app.group);
    if (app.suffix) for (i = 0; i < app.suffix.length; i++) newRules.push('DOMAIN-SUFFIX,' + app.suffix[i] + ',' + app.group);
    if (app.cidr) for (i = 0; i < app.cidr.length; i++) newRules.push('IP-CIDR,' + app.cidr[i] + ',' + app.group + ',no-resolve');
    if (app.cidr6) for (i = 0; i < app.cidr6.length; i++) newRules.push('IP-CIDR6,' + app.cidr6[i] + ',' + app.group + ',no-resolve');
    if (app.asn) for (i = 0; i < app.asn.length; i++) newRules.push('IP-ASN,' + app.asn[i] + ',' + app.group + ',no-resolve');
  }

  // 同名旧组先删：反复勾选同一覆写时不会叠出两份。
  // 地区组不进 drop —— 它们靠上面的 existing 复用，删了会因为 existing 命中而不再重建
  var rest = [];
  for (i = 0; i < curGroups.length; i++) {
    if (!curGroups[i] || !drop[curGroups[i].name]) rest.push(curGroups[i]);
  }

  // 主组一次插入锚点之后，保持 MEGA → Boosty → GitHub → Pornhub 的顺序；
  // 锚点都不存在时 insertAt=0，退回最前
  var anchors = ['🚀节点选择', '♻️自动选择'];
  var insertAt = 0;
  for (i = 0; i < rest.length; i++) {
    if (rest[i] && anchors.indexOf(rest[i].name) >= 0 && i + 1 > insertAt) insertAt = i + 1;
  }
  rest.splice.apply(rest, [insertAt, 0].concat(newGroups));
  if (regionGroups.length > 0) rest.push.apply(rest, regionGroups);
  config['proxy-groups'] = rest;

  // 剔掉目标组是这三个组的旧规则（旧版写过别的域名/网段，只比对全等会留残骸）
  var oldRules = config.rules || [];
  var kept = [];
  for (i = 0; i < oldRules.length; i++) {
    var line = oldRules[i];
    if (typeof line !== 'string') { kept.push(line); continue; }
    var stale = false;
    for (k = 0; k < APPS.length; k++) {
      if (line.indexOf(',' + APPS[k].group) >= 0) { stale = true; break; }
    }
    if (!stale) kept.push(line);
  }
  config.rules = newRules.concat(kept);

  return config;
}
