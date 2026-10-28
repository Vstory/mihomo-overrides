#!/usr/bin/env python3
# SCRIPT_VERSION=0.1.0    # 脚本版本(无模板上游, 独立维护; 内容变更 +1)
"""校验 mihomo-overrides 的覆写文件：结构 / 版本头 / 地区正则 / JS 实跑。

用法:
  python3 Scripts/check_overrides.py            # 全部应用
  python3 Scripts/check_overrides.py mega       # 只查指定应用
  python3 Scripts/check_overrides.py -q         # 只打印失败项

退出码: 0 全部通过 / 1 有失败
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent

REGION_NAMES = [
    '香港', '台湾', '日本', '韩国', '新加坡', '美国', '英国', '德国', '荷兰', '俄罗斯',
    '加拿大', '澳大利亚', '法国', '马来西亚', '泰国', '越南', '印度', '印度尼西亚',
    '菲律宾', '土耳其', '巴西', '阿联酋', '意大利', '西班牙',
]

HEAD_ORDER = ['♻️自动选择', '🚀节点选择', 'DIRECT']

# 合集覆写里的三个主组，顺序即插入顺序
BUNDLE_GROUPS = ['🌐 MEGA', '💰 Boosty', '🐙 GitHub']

FLAGS = {
    '香港': '🇭🇰', '台湾': '🇹🇼', '日本': '🇯🇵', '韩国': '🇰🇷', '新加坡': '🇸🇬', '美国': '🇺🇸',
    '英国': '🇬🇧', '德国': '🇩🇪', '荷兰': '🇳🇱', '俄罗斯': '🇷🇺', '加拿大': '🇨🇦', '澳大利亚': '🇦🇺',
    '法国': '🇫🇷', '马来西亚': '🇲🇾', '泰国': '🇹🇭', '越南': '🇻🇳', '印度': '🇮🇳', '印度尼西亚': '🇮🇩',
    '菲律宾': '🇵🇭', '土耳其': '🇹🇷', '巴西': '🇧🇷', '阿联酋': '🇦🇪', '意大利': '🇮🇹', '西班牙': '🇪🇸',
}

REGION_KEYS = {
    'type': 'url-test',
    'include-all': True,
    'url': 'https://www.gstatic.com/generate_204',
    'interval': 300,
    'tolerance': 50,
    'lazy': True,
    'empty-fallback': 'DIRECT',
}

VERSION_RE = re.compile(r'^(?:#|//)\s+Version (\d+\.\d+\.\d+) · (\d{4}-\d{2}-\d{2} \d{2}:\d{2}) ── (.+)$')

# 节点名 → 期望命中的地区集合；空集代表不允许被任何地区组收走
MATRIX = [
    ('🇭🇰 香港 01', {'香港'}),
    ('香港02', {'香港'}),
    ('HK-03', {'香港'}),
    ('US-LA-01', {'美国'}),
    ('美国 01', {'美国'}),
    ('JP-01', {'日本'}),
    ('Singapore-01', {'新加坡'}),
    ('SG-02', {'新加坡'}),
    ('Russia-01', {'俄罗斯'}),
    ('RU-02', {'俄罗斯'}),
    ('IN-01', {'印度'}),
    ('印度尼西亚-01', {'印度尼西亚'}),
    ('Sweden-01', set()),
    ('DE-01', {'德国'}),
    ('TW-01', {'台湾'}),
    ('KR-01', {'韩国'}),
    ('CA-01', {'加拿大'}),
    ('AU-01', {'澳大利亚'}),
    ('UK-01', {'英国'}),
    ('MY-01', {'马来西亚'}),
    ('TH-01', {'泰国'}),
    ('VN-01', {'越南'}),
    ('TR-01', {'土耳其'}),
    ('BR-01', {'巴西'}),
    ('AE-01', {'阿联酋'}),
    ('FR-01', {'法国'}),
    ('NL-01', {'荷兰'}),
    ('意大利-01', {'意大利'}),
    ('香港中转-美国', {'香港', '美国'}),
    # 单字串门回归：这些名字里的「加/马/巴/阿」曾被别的地区误吃
    ('🇸🇬 新加坡2 | 高倍率', {'新加坡'}),
    ('罗马尼亚-01', set()),
    ('阿根廷-01', set()),
    ('巴拉圭-01', set()),
    ('沙特阿拉伯-01', set()),
]

# 24 个地区各一个样例节点：JS 侧据此生成全部地区组，才能逐组对比 filter
SAMPLE_NODES = [
    '🇭🇰 香港 01', 'TW-01', 'JP-01', 'KR-01', 'SG-01', 'US-01', 'UK-01', 'DE-01',
    'NL-01', 'RU-01', 'CA-01', 'AU-01', 'FR-01', 'MY-01', 'TH-01', 'VN-01',
    'IN-01', 'ID-01', 'PH-01', 'TR-01', 'BR-01', 'AE-01', 'IT-01', 'ES-01',
]
FAKE_NODES = ['剩余流量：948 GB', '套餐到期：2026-12-01']

JS_WRAPPER = '''const fs = require("fs");
const main = new Function(fs.readFileSync(process.argv[2], "utf8") + "\\nreturn main;")();
const cfg = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
process.stdout.write(JSON.stringify(main(cfg)));
'''


class Report:
    def __init__(self, quiet: bool = False):
        self.quiet = quiet
        self.fails = 0

    def ok(self, msg: str) -> None:
        if not self.quiet:
            print(f'  ok   {msg}')

    def fail(self, msg: str) -> None:
        self.fails += 1
        print(f'  FAIL {msg}')

    def skip(self, msg: str) -> None:
        if not self.quiet:
            print(f'  skip {msg}')


def read_version_head(path: Path) -> tuple[str, str] | None:
    first = path.read_text(encoding='utf-8').split('\n', 1)[0]
    m = VERSION_RE.match(first)
    return (m.group(1), m.group(3)) if m else None


def load_yaml_groups(path: Path) -> list[dict]:
    data = yaml.safe_load(path.read_text(encoding='utf-8'))
    return (data.get('+proxy-groups') or []) + (data.get('proxy-groups+') or [])


def region_filter(nodes: list[dict], name: str) -> str | None:
    for g in nodes:
        if g.get('name') == name:
            return g.get('filter')
    return None


def check_structure(groups: list[dict], rep: Report) -> list[str]:
    if not groups:
        rep.fail('+proxy-groups 为空')
        return []

    main_group = groups[0]
    name = main_group.get('name', '?')
    prefix = name.split(' ')[0]

    if main_group.get('type') != 'select':
        rep.fail(f'{name}: 主组 type 应为 select，实为 {main_group.get("type")}')
    if not main_group.get('include-all'):
        rep.fail(f'{name}: 主组缺 include-all（平铺节点进不来）')

    icon = str(main_group.get('icon', ''))
    if not icon.startswith('https://raw.githubusercontent.com/') or '/Icons/png/' not in icon or '?' in icon:
        rep.fail(f'{name}: icon 应是无参数的 Icons/png 下 GitHub raw 地址: {icon}')

    proxies = main_group.get('proxies') or []
    head = proxies[:3]
    if head != HEAD_ORDER:
        rep.fail(f'{name}: 组首顺序应为 {HEAD_ORDER}，实为 {head}')

    region_group_names = [f'{prefix} {r}' for r in REGION_NAMES]
    defined = {g['name']: g for g in groups[1:] if g.get('name')}
    if len(defined) != len(REGION_NAMES):
        rep.fail(f'{prefix}: 地区组应有 {len(REGION_NAMES)} 个，实为 {len(defined)}')

    missing_in_head = [n for n in region_group_names if n not in proxies]
    missing_in_defs = [n for n in region_group_names if n not in defined]
    if missing_in_head:
        rep.fail(f'{prefix}: 主组 proxies 缺地区组 {missing_in_head[:5]}')
    if missing_in_defs:
        rep.fail(f'{prefix}: 未定义地区组 {missing_in_defs[:5]}')

    for n in region_group_names:
        idx = proxies.index(n) if n in proxies else -1
        if 0 <= idx < 3:
            rep.fail(f'{n}: 地区组不能排在首选项（自动选择/节点选择/DIRECT）之前')

    if not rep.fails:
        rep.ok(f'{prefix}: 主组结构 + {len(region_group_names)} 个地区组结构通过')

    for n, g in defined.items():
        for key, want in REGION_KEYS.items():
            got = g.get(key)
            if got != want:
                rep.fail(f'{n}: {key} 应为 {want!r}，实为 {got!r}')
        flt = g.get('filter')
        if not isinstance(flt, str):
            rep.fail(f'{n}: 缺 filter')
            continue
        if not flt.startswith('(?i)'):
            rep.fail(f'{n}: filter 必须以 (?i) 开头（内核 regexp2 区分大小写）')
        if '\x08' in flt:
            rep.fail(f'{n}: filter 里有退格符——JS 侧 \\\\b 写成 \\b 了')

    return region_group_names


def check_regex_quality(defined: dict[str, dict], rep: Report) -> None:
    for n, g in defined.items():
        flt = g.get('filter') or ''
        body = flt[4:] if flt.startswith('(?i)') else flt
        # 按 | 拆段：整段就是两字母的才算国家代码，必须写成 \bXX\b
        for part in body.split('|'):
            part = part.strip()
            bare = part.replace('\\b', '')
            if re.fullmatch(r'[A-Za-z]{2}', bare) and part != '\\b' + bare + '\\b':
                rep.fail(f'{n}: 国家代码 {bare} 没包 \\b 词边界')
        if n.endswith('印度') and '(?!尼西亚)' not in body:
            rep.fail(f'{n}: 印度正则缺 (?!尼西亚)，会吃掉印度尼西亚节点')
    rep.ok(f'正则质量：{len(defined)} 个 filter 词边界与负向断言检查通过')


def check_matrix(defined: dict[str, dict], rep: Report) -> None:
    bad = []
    for node, want in MATRIX:
        hit = set()
        for n, g in defined.items():
            flt = g.get('filter') or ''
            if flt and re.search(flt, node):
                hit.add(n.split(' ', 1)[1] if ' ' in n else n)
        if hit != want:
            bad.append(f'{node}: 期望 {sorted(want) or "无"}，实际 {sorted(hit) or "无"}')
    if bad:
        for b in bad:
            rep.fail(f'正则矩阵 | {b}')
    else:
        rep.ok(f'正则矩阵：{len(MATRIX)} 个节点名断言全过')


def app_file(app: str, ext: str) -> Path:
    return ROOT / 'Overrides' / app / f'{app}.{ext}'


def check_versions(app: str, rep: Report) -> None:
    versions = {}
    for ext in ('yaml', 'js'):
        p = app_file(app, ext)
        head = read_version_head(p)
        if not head:
            rep.fail(f'{p.name}: 第 1 行版本头格式不符（应 `Version X.Y.Z · YYYY-MM-DD HH:MM ── 摘要`）')
            continue
        versions[ext] = head[0]
    if len(versions) == 2 and len(set(versions.values())) != 1:
        rep.fail(f'{app}: 两版版本号不一致 yaml={versions["yaml"]} js={versions["js"]}')
    elif len(versions) == 2:
        rep.ok(f'版本头 {versions["yaml"]}（两版一致）')


def check_js_syntax(app: str, rep: Report) -> bool:
    node = shutil.which('node')
    if not node:
        rep.skip('node 不在 PATH，跳过 JS 语法与实跑')
        return False
    r = subprocess.run([node, '--check', str(app_file(app, 'js'))], capture_output=True, text=True)
    if r.returncode != 0:
        rep.fail(f'{app}.js 语法错误: {r.stderr.strip().splitlines()[:1]}')
        return False
    rep.ok('JS 语法通过')
    return True


def fake_config() -> dict:
    nodes = SAMPLE_NODES + FAKE_NODES
    return {
        'proxies': [
            {'name': n, 'type': 'ss', 'server': '1.1.1.1', 'port': 1,
             'cipher': 'aes-128-gcm', 'password': 'x'}
            for n in nodes
        ],
        'proxy-groups': [
            {'name': '♻️自动选择', 'type': 'url-test', 'proxies': [SAMPLE_NODES[0]]},
            {'name': '🚀节点选择', 'type': 'select', 'proxies': [SAMPLE_NODES[0]]},
        ],
    }


def run_js(path: Path, cfg: dict) -> dict:
    node = shutil.which('node')
    with tempfile.TemporaryDirectory() as td:
        wrapper = Path(td) / 'w.js'
        wrapper.write_text(JS_WRAPPER, encoding='utf-8')
        cfg_file = Path(td) / 'c.json'
        cfg_file.write_text(json.dumps(cfg, ensure_ascii=False), encoding='utf-8')
        r = subprocess.run(
            [node, str(wrapper), str(path), str(cfg_file)],
            capture_output=True, text=True, timeout=60,
        )
    if r.returncode != 0:
        raise RuntimeError((r.stderr.strip().splitlines() or ['?'])[0])
    return json.loads(r.stdout)


def check_js_run(app: str, groups: list[dict], defined: dict[str, dict], rep: Report) -> None:
    prefix = groups[0].get('name', '?').split(' ')[0]
    try:
        out = run_js(app_file(app, 'js'), fake_config())
    except RuntimeError as exc:
        rep.fail(f'{app}.js 执行失败: {exc}')
        return

    result_groups = out.get('proxy-groups') or []
    main_group = next((g for g in result_groups if g.get('name') == groups[0]['name']), None)
    if not main_group:
        rep.fail(f'{app}.js 没生成主组 {groups[0]["name"]}')
        return

    proxies = main_group.get('proxies') or []
    if proxies[:3] != HEAD_ORDER:
        rep.fail(f'{app}.js 主组首选项应为 {HEAD_ORDER}，实为 {proxies[:3]}')

    expect = {f'{FLAGS[r]} {r}': r for r in REGION_NAMES}
    got_groups = {g['name']: g for g in result_groups if g.get('name') in expect}
    if set(got_groups) != set(expect):
        missing = sorted(set(expect) - set(got_groups))
        rep.fail(f'{app}.js 应生成 {len(expect)} 个国旗地区组，实为 {len(got_groups)}，缺 {missing[:4]}')
    got_regions = set(got_groups)

    # 组名用国旗、不带应用前缀；多覆写同时启用时靠 JS 侧的 exists 去重避免重名
    for name, region in expect.items():
        if name not in got_groups:
            continue
        jf = got_groups[name].get('filter')
        yf = defined.get(f'{prefix} {region}', {}).get('filter')
        if isinstance(jf, str) and '\x08' in jf:
            rep.fail(f'{app}.js {name}: filter 含退格符（\\b 少写一个反斜杠）')
        elif yf and jf != yf:
            rep.fail(f'{app}.js {name}: filter 与 YAML 不一致')

    leaked = [n for n in FAKE_NODES if n in proxies]
    if leaked:
        rep.fail(f'{app}.js 伪节点混进主组: {leaked}')
    else:
        rep.ok(f'JS 实跑：顺序 {proxies[:3]} → 地区组 {len(got_regions)} 个 → 平铺 {len(proxies) - 3 - len(got_regions)} 节点，伪节点已剔除')


def check_app(app: str, rep: Report) -> None:
    print(f'== {app}')
    yaml_path = app_file(app, 'yaml')
    js_path = app_file(app, 'js')
    if not yaml_path.exists() or not js_path.exists():
        rep.fail(f'{app}: Overrides/{app}/ 下 yaml 与 js 必须成对存在')
        return

    check_versions(app, rep)

    try:
        groups = load_yaml_groups(yaml_path)
    except yaml.YAMLError as exc:
        rep.fail(f'{app}.yaml 解析失败: {exc}')
        return
    rep.ok(f'{app}.yaml 解析通过（{len(groups)} 组）')

    region_names = check_structure(groups, rep)
    defined = {g['name']: g for g in groups[1:] if g.get('name')}
    if region_names:
        check_regex_quality(defined, rep)
        check_matrix(defined, rep)

    if check_js_syntax(app, rep):
        check_js_run(app, groups, defined, rep)


def check_bundle(rep: Report) -> None:
    print('== all')
    path = ROOT / 'Overrides' / 'all.js'
    if not path.exists():
        rep.fail('Overrides/all.js 缺失')
        return
    node = shutil.which('node')
    if not node:
        rep.skip('node 不在 PATH，跳过合集脚本校验')
        return
    r = subprocess.run([node, '--check', str(path)], capture_output=True, text=True)
    if r.returncode != 0:
        rep.fail(f'all.js 语法错误: {r.stderr.strip().splitlines()[:1]}')
        return

    try:
        first = run_js(path, fake_config())
        again = run_js(path, first)
    except RuntimeError as exc:
        rep.fail(f'all.js 执行失败: {exc}')
        return

    groups = first.get('proxy-groups') or []
    names = [g.get('name') for g in groups if g.get('name')]
    dup = sorted({n for n in names if names.count(n) > 1})
    if dup:
        rep.fail(f'all.js 组名重复（内核会报 duplicate name）: {dup[:4]}')
    else:
        rep.ok(f'组名唯一（{len(names)} 组）')

    order = [n for n in names if n in BUNDLE_GROUPS]
    if order != BUNDLE_GROUPS:
        rep.fail(f'all.js 主组顺序应为 {BUNDLE_GROUPS}，实为 {order}')

    for name in BUNDLE_GROUPS:
        g = next((x for x in groups if x.get('name') == name), None)
        if not g:
            rep.fail(f'all.js 缺主组 {name}')
            continue
        proxies = g.get('proxies') or []
        if proxies[:3] != HEAD_ORDER:
            rep.fail(f'{name}: 组首顺序应为 {HEAD_ORDER}，实为 {proxies[:3]}')
        icon = str(g.get('icon', ''))
        if '/Icons/png/' not in icon or '?' in icon:
            rep.fail(f'{name}: icon 应指向 Icons/png 且无参数，实为 {icon}')
        leaked = [n for n in FAKE_NODES if n in proxies]
        if leaked:
            rep.fail(f'{name}: 伪节点混进主组 {leaked}')

    region_names = [f'{FLAGS[r]} {r}' for r in REGION_NAMES]
    if len([n for n in names if n in region_names]) != len(REGION_NAMES):
        rep.fail(f'all.js 国旗地区组应有 {len(REGION_NAMES)} 个，实为 {len([n for n in names if n in region_names])}')
    else:
        rep.ok(f'三个主组共用 {len(region_names)} 个国旗地区组')

    # 地区组清单在三处存在（yaml / 单应用 js / 合集），filter 必须逐字同源
    defined = {g['name']: g for g in load_yaml_groups(app_file('mega', 'yaml'))[1:] if g.get('name')}
    diff = []
    for region, flag in FLAGS.items():
        want = defined.get(f'🌐 {region}', {}).get('filter')
        got = next((g.get('filter') for g in groups if g.get('name') == f'{flag} {region}'), None)
        if want and got != want:
            diff.append(region)
    if diff:
        rep.fail(f'all.js 地区组 filter 与 mega.yaml 不一致: {diff[:4]}')
    else:
        rep.ok('地区组 filter 与 mega.yaml 逐条一致')

    rules = [str(x) for x in (first.get('rules') or [])]
    for name in BUNDLE_GROUPS:
        if not any(f',{name}' in x for x in rules):
            rep.fail(f'all.js 没有任何规则指向 {name}')

    if len(again.get('proxy-groups') or []) != len(groups) or len(again.get('rules') or []) != len(rules):
        rep.fail('all.js 重复套用不幂等（组数或规则数变了）')
    else:
        rep.ok(f'幂等：连套两次仍是 {len(groups)} 组 / {len(rules)} 条规则')


def main(argv: list[str]) -> int:
    args = [a for a in argv[1:] if not a.startswith('-')]
    quiet = '-q' in argv or '--quiet' in argv
    rep = Report(quiet=quiet)

    found = sorted(ROOT.glob('Overrides/*/*.yaml'))
    for p in found:
        if p.stem != p.parent.name:
            rep.fail(f'{p.relative_to(ROOT)}: 目录名与文件名必须一致（Overrides/<app>/<app>.yaml）')

    apps = args or [p.parent.name for p in found]
    for app in apps:
        check_app(app, rep)
    check_bundle(rep)

    print()
    if rep.fails:
        print(f'结果：{rep.fails} 项失败')
        return 1
    print(f'结果：{len(apps)} 个应用全部通过')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
