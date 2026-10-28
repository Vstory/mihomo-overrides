# mihomo-overrides

Mishka（mihomo 内核）的分组与分流覆写。

## 用法

Mishka → 配置 → 覆写 → 新增 → 远程下载，填地址，格式选对应的 YAML / JavaScript：

```text
https://raw.githubusercontent.com/Vstory/mihomo-overrides/main/Overrides/all.js
https://raw.githubusercontent.com/Vstory/mihomo-overrides/main/Overrides/mega/mega.js
https://raw.githubusercontent.com/Vstory/mihomo-overrides/main/Overrides/mega/mega.yaml
https://raw.githubusercontent.com/Vstory/mihomo-overrides/main/Overrides/boosty/boosty.js
https://raw.githubusercontent.com/Vstory/mihomo-overrides/main/Overrides/boosty/boosty.yaml
https://raw.githubusercontent.com/Vstory/mihomo-overrides/main/Overrides/github/github.js
https://raw.githubusercontent.com/Vstory/mihomo-overrides/main/Overrides/github/github.yaml
https://raw.githubusercontent.com/Vstory/mihomo-overrides/main/Overrides/Pornhub/Pornhub.js
https://raw.githubusercontent.com/Vstory/mihomo-overrides/main/Overrides/Pornhub/Pornhub.yaml
```

- `all.js` 是 MEGA + Boosty + GitHub + Pornhub 的合集，勾一个就全生效；其余八个按应用单独用
- 合集与单应用**二选一**，同时勾选会互相删组
- 保存后在「订阅」页勾选给目标订阅

文件里引用了 `♻️自动选择`、`🚀节点选择` 两个订阅自带的分组名，订阅不同就改成你自己的。

## 图标

`Icons/png/<Name>.png`，只能 PNG / JPEG / WebP：

```text
https://raw.githubusercontent.com/Vstory/mihomo-overrides/main/Icons/png/Mega.png
```

## 校验

```bash
python3 Scripts/check_overrides.py          # 全部
python3 Scripts/check_overrides.py mega     # 只查一个
```

改动与维护规则见 [AGENTS.md](AGENTS.md)。
