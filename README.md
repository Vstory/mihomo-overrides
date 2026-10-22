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
| `mega.yaml` / `mega.js` | MEGA 网盘 | `🌐 MEGA` 分组 + 域名与自有 ASN 网段规则（前插） |

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

## 适配自己的订阅

分组里的 `🚀节点选择`、`♻️自动选择` 是引用订阅中已存在的分组名。订阅不同就改这两行，
换成订阅里实际的主选择组（Mishka → 代理 → 分组 可见全部组名）。

## JavaScript 版

`mega.js` 与 `mega.yaml` 等价。JS 覆写的内核约定：脚本里定义 `main(config)`，
入参与返回值都是整份配置对象（2 秒超时、输出上限 1 MB）。JS 版会先剔掉同名旧规则再前插，
同一覆写被反复选中也不会叠加。
