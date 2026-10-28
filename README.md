# mihomo-overrides

Mishka（mihomo 内核）的覆写规则集合，一个应用一个目录。给订阅补分组、补分流规则，
在本机通过「远程下载」引用，机场下发的原始订阅不被改写。

## 用法

Mishka → 配置 → 覆写 → 新增：

| 项 | 值 |
|----|----|
| 新增方式 | 远程下载 |
| 覆写名称 | 随意，如 `MEGA` |
| 覆写地址 | 下表的 raw 地址 |
| 文件格式 | 与所选文件对应（YAML / JavaScript） |

```text
https://raw.githubusercontent.com/Vstory/mihomo-overrides/main/Overrides/all.js
https://raw.githubusercontent.com/Vstory/mihomo-overrides/main/Overrides/mega/mega.yaml
https://raw.githubusercontent.com/Vstory/mihomo-overrides/main/Overrides/mega/mega.js
https://raw.githubusercontent.com/Vstory/mihomo-overrides/main/Overrides/boosty/boosty.yaml
https://raw.githubusercontent.com/Vstory/mihomo-overrides/main/Overrides/boosty/boosty.js
https://raw.githubusercontent.com/Vstory/mihomo-overrides/main/Overrides/github/github.yaml
https://raw.githubusercontent.com/Vstory/mihomo-overrides/main/Overrides/github/github.js
```

`all.js` 是三个应用的合集，勾一个就全生效；其余六个是单个应用，按需选。**合集与单应用二选一**，
同时勾选会互相删同名主组。

> [!IMPORTANT]
> 地址在 2026-10-29 迁到 `Overrides/` 下（此前在仓库根目录），旧地址已失效。Mishka 里已保存的覆写要重新粘贴上面的地址。

保存后在「订阅」页把覆写勾选给目标订阅。多个覆写按勾选顺序依次套用，前一个的输出是后一个的输入。

## 文件

一个应用一个目录，`Overrides/<应用>/` 下固定一对 `yaml` + `js`；`all.js` 是覆盖全部应用的合集：

```text
Overrides/
├── all.js             三个应用的合集（与单应用二选一）
├── boosty/   boosty.yaml  boosty.js
├── github/   github.yaml  github.js
└── mega/     mega.yaml    mega.js
```

| 文件（`Overrides/` 下） | 应用 | 内容 |
|------|------|------|
| `mega/mega.js` | MEGA 网盘 | `🌐 MEGA` 分组（**自动并入订阅全部节点**，剔掉机场伪节点）+ `GEOSITE,mega` 与自有 ASN 的网段规则（前插） |
| `mega/mega.yaml` | MEGA 网盘 | 同上，但节点靠 `include-all` 全量并入（伪节点会一起进来） |
| `boosty/boosty.js` | Boosty | `💰 Boosty` 分组（同上）+ `DOMAIN-SUFFIX,boosty.to` 一条规则 |
| `boosty/boosty.yaml` | Boosty | 同上，节点靠 `include-all` |
| `github/github.js` | GitHub | `🐙 GitHub` 分组（同上）+ 13 条 `DOMAIN-SUFFIX` 规则（前插） |
| `github/github.yaml` | GitHub | 同上，节点靠 `include-all` |

### 合集 `all.js`

`Overrides/all.js` 把三个应用的规则合成一份，成立的前提是**地区组全仓库只定义一次**：

- 24 个国家/地区组（`🇭🇰 香港` 这种国旗名）由合集建一次，`🌐 MEGA`、`💰 Boosty`、`🐙 GitHub`
  三个主组共用同一批成员，不会出现三份同名组
- 规则按 MEGA（`GEOSITE,mega` + 45 条 IP）→ Boosty（1 条）→ GitHub（13 条）的顺序前插，
  三个目标组各管各的
- 反复勾选同一覆写不叠加：同名主组先删后建、国旗地区组靠查重复用

**必须二选一**：合集与单应用覆写的清理逻辑都会删掉同名主组，同时勾选会互相拆台。

图标怎么设计、规则怎么维护、改动后自查什么，见 [AGENTS.md](AGENTS.md)。

## 校验

改完覆写一律跑脚本，不要手搓命令：

```bash
python3 Scripts/check_overrides.py          # 全部应用
python3 Scripts/check_overrides.py mega     # 只查一个
python3 Scripts/check_overrides.py -q       # 只列失败项
```

查两版版本号一致性、主组与 24 个国家/地区组的字段、正则词边界与「节点名 × 地区」矩阵，
并用假订阅实跑 JS（首选项顺序 / 地区组 / 伪节点剔除）。合集 `all.js` 另查一组：组名唯一、
三个主组顺序、地区组 filter 与 `mega.yaml` 逐条一致、连套两次不叠加。需要 `node` 才跑 JS 部分，
没有会自动跳过。退出码 `1` 表示有失败。

## GitHub 只收核心域名

域名清单取自 v2fly geosite 的 `github` 分类，但**只取了核心子集**，有意排除这些：

- `github.io` —— 全世界用户的 Pages 站点，访问任何人的博客都会命中，收进来等于把半个互联网塞进组
- `ghcr.io` —— 容器镜像，大流量，多数场景该直连或走别的组
- `npmjs`（geosite 里 `include:npmjs` 顺带带进来的）—— 包下载，同上
- `githubstatus` / `cafe.` / `collector.` 等遥测域名 —— 不影响功能，收了只是徒增规则

没有 IP 规则：GitHub 的 Release 与资源下载走 Amazon S3（`github-production-*.s3.amazonaws.com`）和
Azure Blob（`productionresultssa*`），都不在 GitHub 自己的 AS36459 里，`IP-ASN` 兜不住；按 IP 收还会
误伤同段其它租户。`api.github.com/meta` 公布的段是 web/API 出口，与下载链不同源，同样不能当兜底。

## Boosty 只有域名规则

`boosty.to` 落在俄罗斯托管商 AS42632（MnogoByte）的共享段，同段还有别的客户站点，按 IP 收会误伤；
geosite 也没有 `boosty` 分类（只在 `MAILRU-GROUP` / `CATEGORY-RU` / `GEOLOCATION-!CN` 里挂着），
用哪个现成分类都会顺带拖进一整片无关域名。所以规则就一条 `DOMAIN-SUFFIX,boosty.to`，
`DOMAIN-SUFFIX` 自带 `media.` / `api.` 这些子域。

另需注意：能打开 Boosty 取决于节点出口 IP 是否被对方放行，不是选了某个国家就一定行。

## 分组里的节点从哪来

两个文件都**不需要手写节点名**，订阅换节点、加节点都不用改：

- `mega/mega.js`：遍历 `proxies` 逐个取名字，过滤掉 `剩余流量 / 套餐到期 / 距离下次重置` 这类机场伪节点；
  节点走 `proxy-providers` 的订阅则自动用 `use` 整包引入。组头固定放 `♻️自动选择`、`🚀节点选择`（订阅里存在时）
  和 `DIRECT`，其余全是真节点。
- `mega/mega.yaml`：`include-all: true` 由内核并入全部节点。简单，但伪节点挡不住——`exclude-filter`
  只对 provider 节点生效，管不到 `include-all` 加进来的项。

要「组里就是完整节点列表」，用 `mega/mega.js`。

## 覆写语义

Mishka 内核按 PC 版的键位规则合并（`app/src/main/native/mishka_core/overrides`）：

| 键写法 | 行为 |
|--------|------|
| `+key` | 数组前插 |
| `key+` | 数组追加 |
| `key!` | 强制替换 |
| `<key>` | 按字面写入 |
| `key` | 深度合并 |

`rules` 顺序匹配，所以用 `+rules` 前插——追加到末尾会被订阅的兜底规则先吃掉，等于永不命中。
分组用 `proxy-groups+` 追加，不动订阅原有分组。

## 组图标

分组用 mihomo 的 `icon:` 字段，值是图片 URL。Mishka 的 `IconLoader` 会下载并缓存到磁盘，
代理运行中时自动经 mihomo mixed-port 取图，所以图标也不会卡在墙外。

图标按格式分开存：`Icons/png/` 是真正给 `icon:` 用的图，取自官方 180×180 的 apple-touch-icon，
已把外围白底做成透明：

```
https://raw.githubusercontent.com/Vstory/mihomo-overrides/main/Icons/png/mega.png
```

`Icons/svg/` 留给矢量源（目前空着）。**SVG 现在还不能用**：Mishka 的 `IconLoader` 最后一步是
`BitmapFactory.decodeByteArray()`，它不认 SVG，填了只会解码失败、回退成组名首字。
要等上游支持（[Mishka](https://github.com/YuKongA/Mishka) 的 `ui/platform/IconLoader.kt`）才切得过去。

能用的格式只有 PNG / JPEG / WebP——同样是因为 `BitmapFactory`，`.ico` 也解不出来。

## 适配自己的订阅

分组里的 `🚀节点选择`、`♻️自动选择` 是引用订阅中已存在的分组名。订阅不同就改这两行，
换成订阅里实际的主选择组（Mishka → 代理 → 分组 可见全部组名）。

## JavaScript 版

`mega/mega.js` 与 `mega/mega.yaml` 等价。JS 覆写的内核约定：脚本里定义 `main(config)`，
入参与返回值都是整份配置对象（2 秒超时、输出上限 1 MB）。JS 版会先剔掉同名旧规则再前插，
同一覆写被反复选中也不会叠加。
