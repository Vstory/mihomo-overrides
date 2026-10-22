# AGENTS.md

本仓库存放 Mishka（mihomo）的覆写档案，按应用一个文件。改动前先读完对应章节。

## 仓库约束

- **必须 public**：Mishka「新增覆写 → 远程下载」拿不到 token，私有仓库给不出可匿名访问的 raw 地址。
- **一应用两形态**：`<app>.yaml`（键位覆写）与 `<app>.js`（`main(config)`），内容必须等价，改一个就得同步另一个。
- **图标与图标地址**只用 GitHub 官方 raw：`https://raw.githubusercontent.com/<owner>/<repo>/main/icons/<name>.png`，不加查询参数。

## 覆写键位（源码确认，不要凭印象写）

| 写法 | 语义 |
|------|------|
| `+key` | 数组前插 |
| `key+` | 数组追加 |
| `key!` | 强制替换 |
| 其余 | 深度合并 |

`rules` 是顺序匹配：**必须 `+rules` 前插**。追加到末尾等于永不命中——订阅自带的 `MATCH` 兜底规则会先把流量吃掉。

JS 形态约定：定义 `main(config)`，入参出参都是整份配置对象；goja 执行，2 秒超时，输出上限 1 MB。

## 图标设计

### 渲染链路

`mihomo` group 的 `icon` 字段（`adapter/outboundgroup/selector.go` 里的 `"icon": s.Icon()`）→ REST `/proxies` → `ProxyGroupDetail.icon` → `ProxyGroupUi.icon` → Mishka 的 `GroupIcon` 组件 → `IconLoader.loadIcon(url)`。下载失败时回退成组名首字，所以看不到图标先怀疑下载，而不是怀疑字段没传。

### 硬约束

| 项 | 要求 | 原因 |
|----|------|------|
| 格式 | PNG / JPEG / WebP | 解码走 `BitmapFactory`，`.ico` 解不出来 |
| 尺寸 | 180×180 | 显示 32dp，5x 屏约 160px，原生即可，不要插值放大 |
| 背景 | 透明 | 深色主题下白底会变成一个白方块 |
| 内容 | 贴边 | 原图四周留白会让图标比相邻组小一圈，看起来不齐 |
| 地址 | 官方 raw，无参数 | 见「仓库约束」 |

### 源图选择

用官方 apple-touch-icon：`https://mega.nz/apple-touch-icon.png`（180×180 PNG）。
`favicon.ico` 里只有 16/32 px，放大必糊，不要用。

### 抠边：不要 flood fill，按距离场重绘

**踩过的坑**：先用水 `floodfill` 从四角清白底，四角是透明了，但圆边抗锯齿像素是白与红的混合色，阈值扫不到，在深色背景上留一圈白点——看着像图标外面有光晕。

正确做法：只信几何形状，边缘像素一律重涂主色。

```python
from PIL import Image
import math

SRC, S = 'apple-touch-icon.png', 180

im = Image.open(SRC).convert('RGB')
px = im.load()
xs, ys = [], []
for y in range(im.size[1]):
    for x in range(im.size[0]):
        r, g, b = px[x, y]
        if r > 120 and g < 100 and b < 100:      # 按主色阈值取内容包围盒
            xs.append(x); ys.append(y)
x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
RED = px[(x0 + x1) // 2, y0 + 6]                  # 圆心附近取主色，避开中间的白色图形

crop = im.crop((x0, y0, x1 + 1, y1 + 1)).resize((S, S), Image.LANCZOS)
cp = crop.load()
out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
op = out.load()
R = S / 2
for y in range(S):
    for x in range(S):
        d = math.hypot(x + 0.5 - R, y + 0.5 - R)
        if d >= R:
            continue                              # 圆外全透明
        if d > R - 2:                             # 边缘两像素涂主色，吃掉残留的浅色抗锯齿
            op[x, y] = (RED[0], RED[1], RED[2], 255)
        else:
            op[x, y] = (*cp[x, y], 255)
        if d > R - 1:                             # 最后一像素做 alpha 渐变
            op[x, y] = op[x, y][:3] + (max(0, min(255, int(255 * (R - d)))),)
out.save('icons/mega.png')
```

只适用于圆形 logo。方形 logo 把距离判定换成圆角矩形的有向距离即可，思路不变：**边缘涂主色 + 最外一像素 alpha 渐变**。

### 验收

```bash
# 1) 四角必须全透明
python3 -c "from PIL import Image;i=Image.open('icons/mega.png');print(i.size,i.mode,i.getpixel((0,0))[3])"

# 2) 叠到卡片底色上放大 3 倍看边缘，不得有白点或灰边
python3 -c "
from PIL import Image
ic=Image.open('icons/mega.png');bg=Image.new('RGBA',(540,540),(28,28,30,255))
bg.alpha_composite(ic.resize((540,540),Image.NEAREST));bg.convert('RGB').save('/tmp/preview.png')"
```

`/tmp/preview.png` 用图片查看器打开确认。另外目视对比：圆形内切于方形画布，与相邻的圆角方块图标等高。

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
