# AGENTS.md

本仓库存放 Mishka（mihomo）的覆写档案，一个应用一个目录（`overrides/<app>/`）。改动前先读完对应章节。

## 仓库约束

- **必须 public**：Mishka「新增覆写 → 远程下载」拿不到 token，私有仓库给不出可匿名访问的 raw 地址。
- **一应用两形态**：`overrides/<app>/<app>.yaml`（键位覆写）与 `overrides/<app>/<app>.js`（`main(config)`），规则内容必须一致，改一个就得同步另一个。**分组位置是唯一的例外**：键位只有前插/追加，做不到插到指定位置，YAML 版固定前插，需要精确落位只能靠 JS 的 `splice`。
- **图标与图标地址**只用 GitHub 官方 raw：`https://raw.githubusercontent.com/<owner>/<repo>/main/icons/<name>.png`，不加查询参数。
- **版本头**：每个 `overrides/<app>/<app>.yaml` / `<app>.js` 的**第 1 行**放版本行（英文），两版必须同步：

  ```
  # Version 0.0.1 · 2026-10-25 08:56 ── add per-country url-test groups
  ```

  YAML 用 `#`，JS 用 `//`。日期时间用本地时间（Asia/Shanghai）。摘要一句话说清这版改了什么。

  **版本号从 `0.0.1` 起算**：六个文件在 2026-10-25 统一重置到 0.0.1，不再沿用之前的 1.x / 2.x 编号。此后按知识库
  `100_System/workflows/子流程/通用规范流程/工程域/脚本编写规则流程.md` 的语义化规则递增（0.x 阶段用次版本号表达结构性改动）：

  | 改动 | 版本 |
  |------|------|
  | 规则来源、组结构、键位用法变了（含增删国家/地区组） | 次版本 +1（0.0.1 → 0.1.0），修订号归零 |
  | 增删域名、网段、首选项条目、调地区正则 | 修订号 +1（0.0.1 → 0.0.2） |
  | 只改注释、格式、措辞 | 修订号 +1 |

  **每改一次都必须升，没有例外，哪怕只动一行注释；不允许跳号、不允许倒退。** 两个文件的版本号必须完全相同。
  版本更新历史不进脚本本体（脚本里只留这一行当前版本号），写进提交信息。

  用处：Mishka 的覆写编辑器打开文件就能核对版本，判断客户端里跑的是不是最新规则，不必翻提交历史。**这个字符串只能手写维护**——Mishka 拉的是静态 raw 文件，没有注入构建信息的环节，所以每次提交前先改这一行。

### 新增一个应用，按这个顺序做

1. **取官方图标**：官网 `apple-touch-icon.png` 优先（多数是 180×180），不要拿 `favicon.ico` 放大。
2. **生成图片**：180×180 PNG、透明底、主体按 **25% 圆角方块**画（对齐 `DefaultGroupIcon` 的 squircle），放 `icons/<name>.png`。算法见「图标设计」。
3. **建目录**：`overrides/<app>/`，目录名与文件名必须一致（脚本会查）。
4. **写 `<app>.yaml`**：`+proxy-groups` 建组（带 `icon`），`+rules` 前插规则。
5. **写 `<app>.js`**：规则与 YAML 等价；组位置用 `splice` 算，可精确落到某个组之后。
6. **校验**：`python3 -c "import yaml;yaml.safe_load(open('overrides/<app>/<app>.yaml'))"`、`node --check overrides/<app>/<app>.js`，再用真实订阅结构跑一遍 `main(config)` 看组顺序和规则目标。
7. **版本头**：两个文件的第 1 行写 `Version X.Y.Z · YYYY-MM-DD HH:MM ── English summary`，见「仓库约束」。
8. **交付提醒**：图标地址不变时，使用者必须「清应用缓存 → 强制停止 → 重开」才能看到新图，原因见「改图标之后」。
9. **组名**：跟订阅同样的命名风格（带 emoji 前缀），`name` 不要为了图标去改，见「组名保持原样」。

## 覆写键位（源码确认，不要凭印象写）

| 写法 | 语义 |
|------|------|
| `+key` | 数组前插 |
| `key+` | 数组追加 |
| `key!` | 强制替换 |
| 其余 | 深度合并 |

`rules` 是顺序匹配：**必须 `+rules` 前插**。追加到末尾等于永不命中——订阅自带的 `MATCH` 兜底规则会先把流量吃掉。

同理，分组位置用 **`+proxy-groups`** 前插。Mishka 的代理组列表按 `ProxyViewModel` 里的 `globalGroup.all` 顺序排（`sortedBy { orderMap[it.name] }`），而这个顺序就是配置里 `proxy-groups` 的原始顺序；写成 `proxy-groups+` 会被追加到列表最底部。内核的 DAG 排序（`config/utils.go` 的 `proxyGroupsDagSort`）只影响内部解析，不改这个展示顺序。JS 形态对应 `unshift`（不是 `push`）。

要在指定位置插入，得在 JS 里算下标：

```js
var anchors = ['🚀节点选择', '♻️自动选择'];   // 想排在它们后面
var insertAt = 0;
for (i = 0; i < rest.length; i++) {
  if (rest[i] && anchors.indexOf(rest[i].name) >= 0 && i + 1 > insertAt) insertAt = i + 1;
}
rest.splice(insertAt, 0, group);              // 锚点都不存在时 insertAt=0，退回最前
```

锚点名要按订阅实际取值写，且必须能在 `rest` 里匹配到；匹配不到就退化成插到最前，不会报错。

JS 形态约定：定义 `main(config)`，入参出参都是整份配置对象；goja 执行，2 秒超时，输出上限 1 MB。

## 每个应用一套文件

`overrides/mega/{mega.yaml,mega.js}`、`overrides/boosty/{boosty.yaml,boosty.js}`，每个应用一个目录、一组文件，互不引用。新加应用照抄结构：`<app>.yaml` 给不写脚本的人，`<app>.js` 多一层伪节点过滤和动态组引用，两版规则内容必须等价。

`boosty` 是个反例值得记住：它的 IP 在托管商共享段（AS42632 MnogoByte），按 IP 收必误伤；geosite 也没有独立分类。所以只有一条 `DOMAIN-SUFFIX`。**不是每个应用都能凑出「域名 + ASN + 网段」三层，凑不出就别硬凑。**

## 图标设计

### 渲染链路

`mihomo` group 的 `icon` 字段（`adapter/outboundgroup/selector.go` 里的 `"icon": s.Icon()`）→ REST `/proxies` → `ProxyGroupDetail.icon` → `ProxyGroupUi.icon` → Mishka 的 `GroupIcon` 组件 → `IconLoader.loadIcon(url)`。下载失败时回退成组名首字，所以看不到图标先怀疑下载，而不是怀疑字段没传。

### 两种图标，别把形状做歪

`GroupIcon` 是二选一：

| 情况 | 走的分支 | 外观 |
|------|----------|------|
| `icon` 为空 | `DefaultGroupIcon` | 32dp **squircle（圆角 8dp，占边长 25%）** + `primary@10%` 半透明底 + 组名首字符（组名以 emoji 开头 → 彩色 emoji） |
| `icon` 有值 | `Image` + `squircleClip(8.dp)` | 图片本身，同样 32dp 外框 |

**关键**：`squircleClip` 裁的是一个内切圆？不是——它裁的是 25% 圆角的方块。所以贴边的圆形 logo 裁完仍是圆，比旁边的兜底方块大一圈，一排看过去不齐。

要做成 **25% 圆角的方块**，被 `squircleClip` 再裁一次也不会有变化，形状就和邻居完全一致。

### 组名保持原样，不要在图标这件事上动它

`name` 不属于图标设计的范围。实测踩过的返工：看着组名前有 `🌐`、觉得跟左侧图标重复，就去删 emoji——这一步没有任何收益，纯属破坏。

- 组名前那个字符是**组名字符串的一部分**，Mishka 用 `Text(group.name)` 整串渲染。文本里塞不进图片，它也不可能被换成本仓库存的图标。
- 订阅里每个组都带 emoji 前缀（`🚀节点选择`、`♻️自动选择`、`🐟漏网之鱼`），单独把一个组的前缀去掉，只会让这一行显得突兀。
- 改名要付代价：`rules` 里每条规则的目标段都得同步改，漏一条整份配置就校验失败。

所以：**图标只管 `icon` 字段指向的图片，`name` 一个字都别动。**

### 硬约束

| 项 | 要求 | 原因 |
|----|------|------|
| 格式 | PNG / JPEG / WebP | 解码走 `BitmapFactory`，`.ico` 解不出来 |
| 尺寸 | 180×180 | 显示 32dp，5x 屏约 160px，原生即可，不要插值放大 |
| 形状 | 圆角方块，圆角 = 边长 × 8/32 = **25%** | 对齐 `DefaultGroupIcon` 的 squircle |
| 背景 | 透明 | 深色主题下白底会变成一个白方块 |
| 地址 | 官方 raw，无参数 | 见「仓库约束」 |

### 从官方图标生成

先找源图，按优先级：

1. `<域名>/apple-touch-icon.png` —— 多数站点直接有，通常就是 180×180
2. 首页 `<link rel="apple-touch-icon" href="...">` 指向的地址
3. `<link rel="manifest">` 里 `icons` 数组中尺寸 ≥180 的那张

**不要用 `favicon.ico`**：里面只有 16/32 px，放大必糊。

MEGA 的源图是 `https://mega.nz/apple-touch-icon.png`（180×180 PNG）。

思路：取官方图里**主体色的字标蒙版**（白色 M 在红底上，按亮度分离），铺到按比例画好的圆角方块上。不要试图抠白底——见下面「踩过的坑」。

```python
from PIL import Image, ImageDraw
import math

SRC, S, RADIUS = 'apple-touch-icon.png', 180, 45      # RADIUS = S * 8/32

im = Image.open(SRC).convert('RGB')
px = im.load()
xs, ys = [], []
for y in range(im.size[1]):
    for x in range(im.size[0]):
        r, g, b = px[x, y]
        if r > 120 and g < 100 and b < 100:           # 按主色阈值取内容包围盒
            xs.append(x); ys.append(y)
x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
box = im.crop((x0, y0, x1 + 1, y1 + 1))
bp = box.load()
bw, bh = box.size
RED = bp[bw // 2, 6]                                  # 圆心附近取主色，避开字标

mask = Image.new('L', (bw, bh), 0)                    # 字标蒙版：圆内的高亮像素
mp = mask.load()
for y in range(bh):
    for x in range(bw):
        r, g, b = bp[x, y]
        if math.hypot(x + 0.5 - bw / 2, y + 0.5 - bh / 2) < bw / 2 - 1 and r > 190 and g > 190 and b > 190:
            mp[x, y] = 255

out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
ImageDraw.Draw(out).rounded_rectangle([0, 0, S - 1, S - 1], radius=RADIUS, fill=RED + (255,))
out.paste(Image.new('RGBA', (S, S), (255, 255, 255, 255)), (0, 0), mask.resize((S, S), Image.LANCZOS))
out.save('icons/<name>.png')
```

蒙版撑满画布，字标自然落在画布约六成的位置，与官方图标里字标占圆的比例一致——别再额外缩小。

### 踩过的坑：不要用 flood fill 抠白底

第一版从四角白底 flood fill 清透明，四角是干净了，但圆形抗锯齿边缘是白与红的混合色，阈值扫不到，深色背景下留一圈白点，看着像光晕。

结论：**不要抠背景，直接重画几何形状**。圆角方块用 `rounded_rectangle` 画，边缘天然干净；要圆形版就把距离场那套拿来用（`icons/mega-round.png` 就是这么来的），边缘两像素涂主色、最外一像素 alpha 渐变。

### 验收

```bash
# 四角必须全透明
python3 -c "from PIL import Image;i=Image.open('icons/<name>.png');print(i.size,i.mode,i.getpixel((0,0))[3])"

# 和兜底图标并排：同尺寸、同圆角，不能显大或显小
python3 -c "
from PIL import Image, ImageDraw
S=128; c=Image.new('RGBA',(S*2+120,S+100),(36,36,38,255)); d=ImageDraw.Draw(c)
for i in range(2): d.rounded_rectangle([60+i*(S+60),50,60+i*(S+60)+S-1,50+S-1],radius=int(S*8/32),fill=(58,60,68,255))
c.alpha_composite(Image.open('icons/<name>.png').resize((S,S),Image.LANCZOS),(60+(S+60),50))
c.convert('RGB').save('/tmp/shape_check.png')"
```

`/tmp/shape_check.png` 打开看：方块的大小、圆角弧度要和灰色兜底块完全对上。

圆形版另存为 `icons/<name>-round.png`（当前的 MEGA 圆形 logo 在 `icons/mega-round.png`），想切回官方形状就换 URL 末段。

### 改图标之后

Mishka 的 `IconDiskCache` 对每个 URL **没有 TTL、没有版本校验**：`get()` 只看文件在不在，唯一的清理入口 `IconLoader.clear()` 全仓库无调用方。同一个 URL 会一直喂旧图给界面。

所以改完图标必须提醒使用者：**清应用缓存 → 强制停止 → 重开 → 重启代理**。清缓存只删磁盘那份，进程内的 LRU 缓存还得靠强制停止来清。

不要靠加 `?v=2` 之类的参数绕过缓存，地址保持干净。

## MEGA 规则维护

### 分层与来源

| 层 | 写法 | 来源 | 为什么这样 |
|----|------|------|-----------|
| 域名 | `GEOSITE,mega,🌐 MEGA` | 内核读 APK 内置的 `geosite.dat` | Mishka 构建时打包 meta-rules-dat 的 latest geosite.dat，mega 分类即 v2fly `data/mega` 那 7 条。不用 rule-provider：那份 mrs 与 geosite 同源，多一段 provider 配置只多一个单点 |
| IP（兜底） | 25 条 `IP-CIDR` + 20 条 `IP-CIDR6` | AS203055 / AS205809 的公开公告前缀（RIPEstat），全量收、不聚合 | 不依赖任何数据文件，`IP-ASN` 加载不上时仍能命中。聚合会漏零散前缀（曾漏 `2a0b:e46:1::/48`） |
| IP（主力） | `IP-ASN,203055` / `IP-ASN,205809` | 内核按 ASN 匹配，依赖 `ASN.mmdb` | 公告前缀变动自动跟上，不用跟 RIPEstat 对表 |

AS203055 = MEGA-LIMITED-AS，AS205809 = MEGA Privacy Kft.。只认 MEGA 自有 ASN，**不收第三方 CDN / 云厂商段**——那些段是共享的，收进来会误伤。

### 两个不该走的路

**不要手写域名清单。** 曾经只写 `mega.nz` / `mega.io` / `mega.co.nz` 三条，实测漏掉：

| 漏掉的 | 是什么 |
|--------|--------|
| `transfer.it` | MEGA 的传输站，分享链接走这里 |
| `megapay.nz` | 支付 |
| `megaad.nz` | 广告 |
| `megas4.com` | 业务域名 |

**不要用 `GEOSITE,mega`。** 它依赖内置 `geosite.dat` 里是否打包了 `mega` 分类，而那是个随版本变化的二进制；查不到分类时规则静默失效，排查成本很高。rule-provider 不依赖本地数据版本，内容随上游更新。

域名不要再用 rule-provider 绕一圈。`RULE-SET` 拉的 `mega.mrs` 和内置 `geosite.dat` 的 mega 分类是同一份数据的两种编译产物，覆盖完全一样；`GEOSITE` 一行就能表达的，不值得再加 10 行 provider 配置和一个「拉不下来就整段失效」的单点。

**不要只靠 `IP-ASN`。** 它依赖 `ASN.mmdb` 被正确加载，加载不上时整条规则静默失效、流量直接落到 `Match`，从日志上只能看到「规则没生效」。所以公告前缀写在 `IP-ASN` 前面兜底。

**网段要全量收，不要手工聚合。** 聚合（`31.216.144.0/22` 代替 4 条 /24）看着省事，但 MEGA 的前缀里有 `2a0b:e46:1::/48` 这种孤立条目，聚合时根本想不到、漏了也看不出来。现在 45 条全部来自 RIPEstat 原始公告，刷新时整段替换即可。

### 顺序与写法

- 域名规则排在 IP 规则**前面**：域名能判就直接判，不必等解析。
- IP 规则带 `no-resolve`：纯 IP 流量不该为了匹配规则多发一次 DNS。
- 组名 `🌐 MEGA` 必须与 `+proxy-groups` 里逐字一致，含 emoji 与中间的空格。
- provider 名用 `mega-site`，避免与订阅自带的 provider 重名；`path` 落在 `./ruleset/` 下，`interval` 86400。

### 规则段现貌

```yaml
rule-providers:
  mega-site:
    type: http
    behavior: domain
    format: mrs
    url: https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/mega.mrs
    path: ./ruleset/mega.mrs
    interval: 86400

+rules:
  - RULE-SET,mega-site,🌐 MEGA
  - IP-ASN,203055,🌐 MEGA,no-resolve
  - IP-ASN,205809,🌐 MEGA,no-resolve
```

`rule-providers` 是 map，用**普通键**深度合并（不是 `+rule-providers`，`+` 只对数组有意义）；`rules` 是数组，必须 `+rules` 前插。

### 改动后自查

- [ ] 两个文件第 1 行的版本号、时间、摘要都已更新，且两版一致
- [ ] 规则段是 `+rules`，没写成 `rules`
- [ ] provider 段是普通 `rule-providers`，没加 `+`
- [ ] 域名在前、IP 在后，IP 规则都带 `no-resolve`
- [ ] 组名 `🌐 MEGA` 逐字一致，emoji 后有一个空格
- [ ] 首选项里的聚合组（自动选择 / 节点选择 / 各运营商推荐节点）都真的在订阅里
- [ ] `overrides/mega/mega.yaml` 与 `mega.js` 的规则条目、provider 配置一致
- [ ] 本地能加载：`python3 -c "import yaml;yaml.safe_load(open('overrides/mega/mega.yaml'))"`、`node --check overrides/mega/mega.js`
- [ ] 跑一遍 `python3 scripts/check_overrides.py mega`（版本头 / 结构 / 正则矩阵 / JS 实跑一次过）
- [ ] provider 的 mrs 地址能取到：`curl -sI <url>` 应为 200
- [ ] 用真实订阅结构跑一遍 `main(config)`，确认旧版遗留的 `DOMAIN-SUFFIX,...,🌐 MEGA` 已被清掉

## 分组里的节点从哪来

- **YAML**：`include-all: true` 由内核全量并入。简单，但机场塞的伪节点（`剩余流量：xx GB`、`套餐到期`）挡不住——`exclude-filter` 只在 groupbase 对 provider 提供的节点生效，管不到 `include-all` 加进来的项。

**组用 `select`**，首选项放「♻️自动选择」「🚀节点选择」、所有 `*推荐节点` 聚合组和 `DIRECT`，后面接全部节点。理由：只有 `select` 的成员能是 proxy-group，`url-test` 会把这三类一起排除掉，而用户要能在组里直接切「自动选择 / 节点选择 / 直连」。代价是选中的节点断线后不会自己换——日志里 `IPCIDR` 命中本组却 `dial tcp ... i/o timeout`，就是选到了坏节点，到代理页手动切。

试过 `url-test` 自动选节点，有两个坑：一是成员只能是节点，运营商聚合组进不来；二是测速地址不能用目标站点首页（`https://mega.nz/` 要 4.5 秒才响应，加节点转发就超过测速超时，整组被判超时、一片不可用），只能用 `https://www.gstatic.com/generate_204` 这类空响应端点。
- **JS**：遍历 `config.proxies` 自己取名字并按正则剔伪节点；节点走 `proxy-providers` 时用 `use` 整包引入。
- **`include-all` 不含 proxy-groups**：只并 `proxies` 里的节点和 provider 的节点。`♻️自动选择`、`✨移动推荐节点` 这类**聚合组**想出现在本组首选项里，必须显式写进 `proxies`。YAML 版只能写死组名（名字错了内核拒绝整份配置），JS 版按 `/推荐节点$/` 后缀匹配，机场换 emoji 或加运营商都不用改。
- 组头只引用订阅里**真实存在**的组名。硬写一个不存在的组会让内核整个配置校验失败，换订阅就炸。

## 国家/地区聚合组

每个覆写除主组外，固定带 **24 个按国家/地区的 `url-test` 组**（如 `🌐 香港`），组内自动挑该地区延迟最低的节点。

**两版的组名不同，这是刻意的**：

| 版本 | 地区组名 | 为什么 |
|---|---|---|
| JS（`main(config)`） | `🇯🇵 日本`（国旗） | JS 能读到前面覆写留下的 `proxy-groups`，地区组「已有就复用、没有才定义」，所以组名可以是纯国旗，任意组合/顺序启用都不重名 |
| YAML（`+proxy-groups`） | `🌐 日本`（应用前缀） | YAML 是静态合并：只能前插/追加/替换数组，没有条件判断。纯国旗名会让三个覆写合并出三个同名组，内核直接报 `duplicate name`。前缀保证同时启用也不撞 |

同时启用多个覆写时优先用 JS 版：成员显示国旗，且不依赖前缀区分。

**地区组在代理组页的位置**：主组走 `+proxy-groups`（前插，排在订阅组之前），地区组走 `proxy-groups+`（追加到数组末尾，显示在 GLOBAL 之前）；JS 版对应 `rest.splice(insertAt, 0, group)` + `rest.push(...regionGroups)`。不要把两者都前插——地区组会顶到列表最上面，把订阅自带的组挤下去。

### 主组与地区组的排版

主组 `proxies` 顺序固定为：

```
♻️自动选择 → 🚀节点选择 → DIRECT → 国家/地区组（24）→ 订阅自带的 *推荐节点 组 → 平铺节点
```

平铺节点由 `include-all` 在最后追加（内核行为，写不到前面）；JS 版把节点名显式拼在数组尾部，效果相同。

### 地区组的标准写法

YAML 版（组名带应用前缀）：

```yaml
- name: 🌐 香港
  type: url-test
  include-all: true
  filter: '(?i)香港|🇭🇰|\bhk\b|hong ?kong|港'
  url: https://www.gstatic.com/generate_204
  interval: 300
  tolerance: 50
  lazy: true
  empty-fallback: DIRECT
```

JS 版（组名用国旗，且定义前先查重）：

```js
var existing = {};
var curGroups = config['proxy-groups'] || [];
for (r = 0; r < curGroups.length; r++) existing[curGroups[r].name] = true;
// 循环里：if (existing[regionName]) continue;   // 前面的覆写已定义 → 只引用不重复定义
```

每个字段的理由，改之前先看这张表：

| 字段 | 为什么是这个值 |
|---|---|
| `type: url-test` | 自动选延迟最低；`select` 不会自己换节点 |
| `include-all: true` | 换订阅不用改文件，provider 的节点也会进来 |
| `filter` | 真正筛节点的地方，按节点名匹配，规则见下节 |
| `empty-fallback: DIRECT` | **必须显式写**。内核默认回退 `COMPATIBLE`，订阅里没这个组会直接报 `empty fallback proxy 'COMPATIBLE' not found`，整份配置校验失败 |
| `lazy: true` | 只在使用该组时测速，避免 24 组 × 上百节点开机全测 |
| `tolerance: 50` | 延迟差 50ms 内不换节点，防抖 |
| `url: gstatic/generate_204` | 空响应端点，秒回。**不要用目标站点首页**——mega.nz 要 4.5 秒才响应，加节点转发就超时，整组被判不可用 |

### filter 正则的三条铁律

1. **必须带 `(?i)`**：内核 filter 走 regexp2，默认区分大小写，而节点名 `HK` / `hk` / `Hk` 混着写。
2. **两字母国家代码必须包 `\b`**：不加词边界时 `US` 会命中 `Russia`（r-u-s-s-i-a 含 us），`IN` 会命中 `Singapore`。一律写 `\bhk\b`。
3. **中文单字只在不会串门时用**：`港` / `美` / `日` / `台` 可用；`新`（新加坡/新节点）、`印`（印度/印尼）不能用。跨国名要加负向断言，印度必须写 `印度(?!尼西亚)`。

JS 里同一个正则要出现两次：清单存**不带** `(?i)` 的裸正则（JS 的 `RegExp` 不认内联标志，扫描时传 `'i'` flag），拼 `filter` 时再加回 `'(?i)' +`。

### 24 个地区与匹配词

| 地区 | 匹配串（filter 前面另加 `(?i)`） |
|---|---|
| 香港 | `香港\|🇭🇰\|\bhk\b\|hong ?kong\|港` |
| 台湾 | `台湾\|台灣\|🇹🇼\|\btw\b\|taiwan\|台` |
| 日本 | `日本\|🇯🇵\|\bjp\b\|japan\|日` |
| 韩国 | `韩国\|韓國\|🇰🇷\|\bkr\b\|korea\|韩\|韓` |
| 新加坡 | `新加坡\|狮城\|獅城\|🇸🇬\|\bsg\b\|singapore` |
| 美国 | `美国\|美國\|🇺🇸\|\bus\b\|\busa\b\|united ?states\|美` |
| 英国 | `英国\|英國\|🇬🇧\|\buk\b\|\bgb\b\|united ?kingdom\|英` |
| 德国 | `德国\|德國\|🇩🇪\|\bde\b\|germany\|德` |
| 荷兰 | `荷兰\|荷蘭\|🇳🇱\|\bnl\b\|netherlands\|荷` |
| 俄罗斯 | `俄罗斯\|俄羅斯\|🇷🇺\|\bru\b\|russia\|俄` |
| 加拿大 | `加拿大\|🇨🇦\|\bca\b\|canada\|加` |
| 澳大利亚 | `澳大利亚\|澳洲\|🇦🇺\|\bau\b\|australia\|澳` |
| 法国 | `法国\|法國\|🇫🇷\|\bfr\b\|france\|法` |
| 马来西亚 | `马来西亚\|馬來西亞\|🇲🇾\|\bmy\b\|malaysia\|马\|馬` |
| 泰国 | `泰国\|泰國\|🇹🇭\|\bth\b\|thailand\|泰` |
| 越南 | `越南\|🇻🇳\|\bvn\b\|vietnam\|越` |
| 印度 | `印度(?!尼西亚)\|🇮🇳\|\bin\b\|india` |
| 印度尼西亚 | `印度尼西亚\|印尼\|🇮🇩\|\bid\b\|indonesia` |
| 菲律宾 | `菲律宾\|菲律賓\|🇵🇭\|\bph\b\|philippines` |
| 土耳其 | `土耳其\|🇹🇷\|\btr\b\|turkey\|türkiye\|土` |
| 巴西 | `巴西\|🇧🇷\|\bbr\b\|brazil\|巴` |
| 阿联酋 | `阿联酋\|阿拉伯\|🇦🇪\|\bae\b\|emirates\|dubai\|阿` |
| 意大利 | `意大利\|義大利\|🇮🇹\|\bit\b\|italy` |
| 西班牙 | `西班牙\|🇪🇸\|\bes\b\|spain` |

### YAML 与 JS 的差别

| | YAML | JS |
|---|---|---|
| 地区组数量 | 固定 24 个全建 | 内联订阅只建命中的地区；provider 订阅扫不到节点名，退回全建 24 个 |
| 没节点的地区 | 组仍在列表里，`empty-fallback` 让它指向 DIRECT | 同左（有节点但该地区为空时也会有组） |
| 平铺节点 | `include-all` 追加在末尾 | 显式拼在 `proxies` 尾部，可剔掉伪节点 |

### 改动后自查

改完一律跑脚本，不要手搓命令：

```bash
python3 scripts/check_overrides.py          # 全量（三个应用）
python3 scripts/check_overrides.py mega     # 只查一个应用
python3 scripts/check_overrides.py -q       # 只打印失败项
```

脚本查这些，任何一项不过就是退出码 1：

| 检查 | 具体 |
|---|---|
| 目录结构 | `overrides/<app>/<app>.{yaml,js}` 成对存在，目录名与文件名一致 |
| 版本头 | 格式 `Version X.Y.Z · YYYY-MM-DD HH:MM ── 摘要`，两版版本号一致 |
| YAML | 可解析、`+proxy-groups` 存在 |
| 主组结构 | `select`、`include-all`、icon 是无参数 GitHub raw、proxies 前 3 项是 `♻️自动选择 / 🚀节点选择 / DIRECT`、24 个地区组都列在首选项之后 |
| 地区组字段 | `url-test` / `include-all` / `generate_204` / `interval 300` / `tolerance 50` / `lazy` / `empty-fallback: DIRECT` / filter 带 `(?i)` |
| 正则质量 | 两字母代码必须有 `\b`（按 `\|` 拆段判定）、印度必须带 `(?!尼西亚)`、filter 里不能有退格符 |
| 正则矩阵 | 29 条节点名 → 期望地区断言（含 `Russia-01` 不进美国、`Sweden-01` 不进德国、`印尼` 不进印度） |
| JS | `node --check` + 假订阅实跑：首选项顺序、24 个地区组、伪节点剔除、JS 与 YAML 的 filter 逐字一致 |

需要 `node` 才跑 JS 部分，没有 node 会自动 skip。改脚本本身按知识库脚本规则升 `SCRIPT_VERSION`（版本历史写提交信息，不写进脚本）。
