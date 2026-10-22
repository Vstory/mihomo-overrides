# AGENTS.md

本仓库存放 Mishka（mihomo）的覆写档案，按应用一个文件。改动前先读完对应章节。

## 仓库约束

- **必须 public**：Mishka「新增覆写 → 远程下载」拿不到 token，私有仓库给不出可匿名访问的 raw 地址。
- **一应用两形态**：`<app>.yaml`（键位覆写）与 `<app>.js`（`main(config)`），规则内容必须一致，改一个就得同步另一个。**分组位置是唯一的例外**：键位只有前插/追加，做不到插到指定位置，YAML 版固定前插，需要精确落位只能靠 JS 的 `splice`。
- **图标与图标地址**只用 GitHub 官方 raw：`https://raw.githubusercontent.com/<owner>/<repo>/main/icons/<name>.png`，不加查询参数。

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

### 硬约束

| 项 | 要求 | 原因 |
|----|------|------|
| 格式 | PNG / JPEG / WebP | 解码走 `BitmapFactory`，`.ico` 解不出来 |
| 尺寸 | 180×180 | 显示 32dp，5x 屏约 160px，原生即可，不要插值放大 |
| 形状 | 圆角方块，圆角 = 边长 × 8/32 = **25%** | 对齐 `DefaultGroupIcon` 的 squircle |
| 背景 | 透明 | 深色主题下白底会变成一个白方块 |
| 地址 | 官方 raw，无参数 | 见「仓库约束」 |

### 从官方图标生成

源图用 `https://mega.nz/apple-touch-icon.png`（180×180 PNG）。`favicon.ico` 里只有 16/32 px，放大必糊。

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

### 分层

1. **域名层**：`DOMAIN-SUFFIX,mega.nz` / `mega.io` / `mega.co.nz`，覆盖绝大多数请求。
2. **IP 层**：MEGA 自有 ASN 的公告前缀，兜住域名被污染、或客户端直接连 IP 的情况。

只收 MEGA 自有 ASN 的前缀，**不收第三方 CDN / 云厂商段**——那些段是共享的，收进来会误伤。

| ASN | 名称 |
|-----|------|
| AS203055 | MEGA-LIMITED-AS |
| AS205809 | MEGA Privacy Kft. |

### 顺序与写法

- 域名规则排在 IP 规则**前面**：域名能判就直接判，不必等解析。
- 所有 IP 规则带 `no-resolve`：不让内核为了匹配规则多发一次 DNS，纯 IP 流量不该触发解析。
- IPv6 前缀写 `IP-CIDR6`，不要塞进 `IP-CIDR`。
- 组名 `🌐 MEGA` 必须与 `proxy-groups+` 里逐字一致，含 emoji 与中间的空格。

### 当前基线（2026-10 从 RIPEstat 拉的公告前缀）

MEGA 的前缀粒度很碎（AS205809 有 33 条 /48），配置里按相邻段聚合，代价是覆盖同段内的邻接分配：

| 配置里的写法 | 实际包含 |
|--------------|----------|
| `31.216.144.0/22` | 31.216.144.0/24 ~ 147.0/24（AS203055） |
| `31.216.148.0/24` | 单条 |
| `66.203.124.0/22` | 124.0/24 + 125.0/24（AS203055）与 126.0/23（AS205809） |
| `82.29.204.0/22` | 204.0/24 ~ 207.0/24，`82.29.203.0/24` 单独写 |
| `89.44.168.0/23`、`94.24.36.0/23`、`217.180.20.0/23` | 各含两个 /24 |
| `162.208.16.0/24`、`185.206.24.0/22`、`82.21.172.0/24` | AS205809 |
| `2a0b:e40::/31`、`e42::/31`、`e44::/31` | 每个 /31 覆盖 MEGA 在该 /32 内的若干 /48 |
| `2a09:a381::/39` | 覆盖 `2a09:a381::/40` 与 `2a09:a381:100::/40`；同 /39 内的邻接段（a380、a382~a3ff）也一并带上，不是 MEGA 专属 |
| `2001:67c:1998::/48`、`2001:678:25c::/48` | 各单条 |

### 更新

```bash
for asn in AS203055 AS205809; do
  echo "=== $asn ==="
  curl -s "https://stat.ripe.net/data/announced-prefixes/data.json?resource=$asn" |
    python3 -c "import json,sys;[print(p['prefix']) for p in json.load(sys.stdin)['data']['prefixes']]"
done
```

与上表比对后改 `mega.yaml` 与 `mega.js` 两份（`mega.js` 里的 `domains` / `cidrs` / `cidrs6` 三个数组）。

### 改动后自查

- [ ] 规则段是 `+rules`，没写成 `rules`
- [ ] 域名在前、IP 在后，IP 规则全部 `no-resolve`
- [ ] 组名 `🌐 MEGA` 逐字一致，emoji 后有一个空格
- [ ] IPv6 用了 `IP-CIDR6`
- [ ] `mega.yaml` 与 `mega.js` 的域名、网段列表一致
- [ ] 本地能加载：`python3 -c "import yaml;yaml.safe_load(open('mega.yaml'))"`、`node --check mega.js`

## 分组里的节点从哪来

- **YAML**：`include-all: true` 由内核全量并入。简单，但机场塞的伪节点（`剩余流量：xx GB`、`套餐到期`）挡不住——`exclude-filter` 只在 groupbase 对 provider 提供的节点生效，管不到 `include-all` 加进来的项。
- **JS**：遍历 `config.proxies` 自己取名字并按正则剔伪节点；节点走 `proxy-providers` 时用 `use` 整包引入。
- 组头只引用订阅里**真实存在**的组名。硬写一个不存在的组会让内核整个配置校验失败，换订阅就炸。
