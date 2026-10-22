# mihomo-overrides

Mishka（mihomo 内核）的覆写规则集合，按应用分文件。给订阅补分组、补分流规则，
在本机通过「远程下载」引用，机场下发的原始订阅不被改写。

## 用法

Mishka → 配置 → 覆写 → 新增：

| 项 | 值 |
|----|----|
| 新增方式 | 远程下载 |
| 覆写名称 | 随意，如 `MEGA` |
| 覆写地址 | 下表的 raw 地址 |
| 文件格式 | 与所选文件对应（YAML / JavaScript） |

```
https://raw.githubusercontent.com/Vstory/mihomo-overrides/main/mega.yaml
https://raw.githubusercontent.com/Vstory/mihomo-overrides/main/mega.js
```

保存后在「订阅」页把覆写勾选给目标订阅。多个覆写按勾选顺序依次套用，前一个的输出是后一个的输入。

## 文件

| 文件 | 应用 | 内容 |
|------|------|------|
| `mega.js` | MEGA 网盘 | `🌐 MEGA` 分组（**自动并入订阅全部节点**，剔掉机场伪节点）+ 域名与自有 ASN 网段规则（前插） |
| `mega.yaml` | MEGA 网盘 | 同上，但节点靠 `include-all` 全量并入（伪节点会一起进来） |

图标怎么设计、规则怎么维护、改动后自查什么，见 [AGENTS.md](AGENTS.md)。

## 分组里的节点从哪来

两个文件都**不需要手写节点名**，订阅换节点、加节点都不用改：

- `mega.js`：遍历 `proxies` 逐个取名字，过滤掉 `剩余流量 / 套餐到期 / 距离下次重置` 这类机场伪节点；
  节点走 `proxy-providers` 的订阅则自动用 `use` 整包引入。组头固定放 `♻️自动选择`、`🚀节点选择`（订阅里存在时）
  和 `DIRECT`，其余全是真节点。
- `mega.yaml`：`include-all: true` 由内核并入全部节点。简单，但伪节点挡不住——`exclude-filter`
  只对 provider 节点生效，管不到 `include-all` 加进来的项。

要「组里就是完整节点列表」，用 `mega.js`。

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

图标文件放在 `icons/`，取自官方 180×180 的 apple-touch-icon，已把外围白底做成透明：

```
https://raw.githubusercontent.com/Vstory/mihomo-overrides/main/icons/mega.png
```

注意只能用 PNG / JPEG / WebP——解码走 `BitmapFactory`，`.ico` 解不出来。

## 适配自己的订阅

分组里的 `🚀节点选择`、`♻️自动选择` 是引用订阅中已存在的分组名。订阅不同就改这两行，
换成订阅里实际的主选择组（Mishka → 代理 → 分组 可见全部组名）。

## JavaScript 版

`mega.js` 与 `mega.yaml` 等价。JS 覆写的内核约定：脚本里定义 `main(config)`，
入参与返回值都是整份配置对象（2 秒超时、输出上限 1 MB）。JS 版会先剔掉同名旧规则再前插，
同一覆写被反复选中也不会叠加。
