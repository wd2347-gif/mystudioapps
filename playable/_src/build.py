#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""체험판(플레이 광고) 한 장짜리 HTML 만들기 — 게임마다 따로 둔 파일을 껍데기에 끼워 넣는다.

    python3 playable/_src/build.py myfidget                     # → playable/myfidget/index.html
    python3 playable/_src/build.py myfidget --only spinner,slime --out /tmp/x.html   # 시험용(세트 하나)

_src/<앱>/shell.html : 껍데기. <style> 안에 /*@@CSS@@*/, <script> 안에 /*@@GAMES@@*/ 표시가 하나씩 있다.
_src/<앱>/games/<id>.js  : 게임 하나(GAMES['<id>'] = {...}). 같은 이름 .css 가 있으면 CSS 표시에 넣는다.
_src/<앱>/sets.js       : SETS = [['a','b','c'], ...] (10세트 이상, 사용자 10/11).
--only 를 주면 그 게임들로만 세트 하나를 만든다(SETS 대신).
"""
import argparse
import glob
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)  # playable/


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('app')
    ap.add_argument('--only', default='')
    ap.add_argument('--out', default='')
    a = ap.parse_args()
    src = os.path.join(HERE, a.app)
    shell = open(os.path.join(src, 'shell.html'), encoding='utf-8').read()
    if shell.count('/*@@GAMES@@*/') != 1 or shell.count('/*@@CSS@@*/') != 1:
        sys.exit('shell.html 에 /*@@GAMES@@*/ 와 /*@@CSS@@*/ 가 하나씩 있어야 해요')
    ids = sorted(os.path.splitext(os.path.basename(p))[0] for p in glob.glob(os.path.join(src, 'games', '*.js')))
    only = [x for x in a.only.split(',') if x]
    if only:
        miss = [x for x in only if x not in ids]
        if miss:
            sys.exit(f'없는 게임: {miss}')
        ids = only
    js, css = [], []
    for i in ids:
        js.append(f'/* ---- game: {i} ---- */\n' + open(os.path.join(src, 'games', i + '.js'), encoding='utf-8').read().strip())
        cp = os.path.join(src, 'games', i + '.css')
        if os.path.exists(cp):
            css.append(f'/* ---- game: {i} ---- */\n' + open(cp, encoding='utf-8').read().strip())
    if only:
        sets = 'var SETS = ' + json.dumps([only]) + ';'
    else:
        sets = open(os.path.join(src, 'sets.js'), encoding='utf-8').read().strip()
        used = set(re.findall(r"'([a-z0-9_]+)'", sets.split('=', 1)[1]))
        miss = sorted(used - set(ids))
        if miss:
            sys.exit(f'sets.js 에 있는데 games/ 에 없는 게임: {miss}')
    out = shell.replace('/*@@CSS@@*/', '\n'.join(css)).replace('/*@@GAMES@@*/', '\n\n'.join(js) + '\n\n' + sets)
    import i18n_tool  # ko · ja · en 글 뒤에 zh-Hant · de · es · fr · pt · ar 를 끼운다(2026-10-12)
    out = i18n_tool.apply(out, i18n_tool.load_table(a.app))
    if '—' in out:
        sys.exit('긴 줄표(—)가 있어요: 쌍점(:)으로 바꿔 주세요')
    dst = a.out or os.path.join(ROOT, a.app, 'index.html')
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    open(dst, 'w', encoding='utf-8').write(out)
    print(f'{dst}  {len(out.encode("utf-8")) / 1024:.1f}KB  games={len(ids)}')


if __name__ == '__main__':
    main()
