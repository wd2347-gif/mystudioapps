#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""체험판 글을 9개 언어로 늘리기(2026-10-12 사용자: "9개 언어 다 넣어줘, 플레이 광고도").

소스(게임 · 껍데기)는 지금처럼 { ko: …, ja: …, en: … } 로만 쓴다. 빌드 때 이 도구가 그런 객체를 모두 찾아
en 값 바로 뒤에 'zh-Hant' · de · es · fr · pt · ar 를 끼워 넣는다. 번역은 _src/<앱>/i18n.json
({영어 글: {언어: 번역}}), 표에 없는 글은 영어 그대로.
- 글 하나:   { ko: '…', ja: '…', en: 'Score' }            → en 글을 표에서 찾아 넣는다
- 글 묶음:   { ko: { a: '…' }, ja: {…}, en: { a: 'Go' } }  → en 묶음을 복사해 안의 글만 바꿔 넣는다

    python3 playable/_src/i18n_tool.py extract <앱>   # 번역할 영어 글 목록(JSON)을 찍는다
"""
import json
import os
import re
import sys

LANGS = ['zh-Hant', 'de', 'es', 'fr', 'pt', 'ar']
HERE = os.path.dirname(os.path.abspath(__file__))
KEY = re.compile(r'(?<![\w$.\'"-])ko:\s*')


def _skip_ws(s, i):
    while i < len(s):
        if s[i].isspace():
            i += 1
        elif s.startswith('//', i):
            i = s.index('\n', i) if '\n' in s[i:] else len(s)
        elif s.startswith('/*', i):
            i = s.index('*/', i) + 2
        else:
            break
    return i


def _string_end(s, i):
    q = s[i]
    i += 1
    while s[i] != q:
        i += 2 if s[i] == '\\' else 1
    return i + 1


def _value_end(s, i):
    """i 에서 시작하는 값(글 · 객체 · 배열)의 끝 위치."""
    if s[i] in '\'"`':
        return _string_end(s, i)
    if s[i] in '{[':
        depth = 0
        while True:
            c = s[i]
            if c in '\'"`':
                i = _string_end(s, i)
                continue
            if s.startswith('//', i) or s.startswith('/*', i):
                i = _skip_ws(s, i)
                continue
            if c in '{[':
                depth += 1
            elif c in '}]':
                depth -= 1
                if depth == 0:
                    return i + 1
            i += 1
    raise ValueError(f'값이 아님: {s[i:i + 40]!r}')


def _expect_key(s, i, name):
    i = _skip_ws(s, i)
    if s[i] != ',':
        return None
    i = _skip_ws(s, i + 1)
    m = re.match(name + r':\s*', s[i:])
    return i + m.end() if m else None


def find(s):
    """[(en 값 시작, en 값 끝)] — ko · ja · en 이 차례로 붙은 곳마다."""
    out = []
    for m in KEY.finditer(s):
        try:
            i = m.end()
            if s[i] not in '\'"`{[':
                continue
            j = _expect_key(s, _value_end(s, i), 'ja')
            if j is None:
                continue
            e = _expect_key(s, _value_end(s, j), 'en')
            if e is None:
                continue
            out.append((e, _value_end(s, e)))
        except (ValueError, IndexError):
            continue
    return out


def _unq(lit):
    body = lit[1:-1]
    return re.sub(r'\\(.)', lambda m: {'n': '\n', 't': '\t'}.get(m.group(1), m.group(1)), body)


def _q(text):
    return "'" + text.replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n') + "'"


STR = re.compile(r"'(?:[^'\\]|\\.)*'|\"(?:[^\"\\]|\\.)*\"")


def strings(s):
    """en 값들 안의 글 전부(순서대로, 겹침 없이)."""
    seen = []
    for a, b in find(s):
        for m in STR.finditer(s[a:b]):
            t = _unq(m.group(0))
            if t not in seen:
                seen.append(t)
    return seen


def apply(s, table):
    """en 값 뒤에 다른 언어 판을 끼워 넣은 새 글."""
    spans = find(s)
    for a, b in reversed(spans):
        en = s[a:b]
        parts = []
        for lang in LANGS:
            tr = STR.sub(lambda m: _q(table.get(_unq(m.group(0)), {}).get(lang) or _unq(m.group(0))), en)
            parts.append(f"{_q(lang)}: {tr}")
        s = s[:b] + ', ' + ', '.join(parts) + s[b:]
    return s


def load_table(app):
    p = os.path.join(HERE, app, 'i18n.json')
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}


if __name__ == '__main__' and len(sys.argv) == 3 and sys.argv[1] == 'extract':
    import glob
    app = sys.argv[2]
    files = [os.path.join(HERE, app, 'shell.html')] + sorted(glob.glob(os.path.join(HERE, app, 'games', '*.js')))
    allx = []
    for f in files:
        for t in strings(open(f, encoding='utf-8').read()):
            if t not in allx:
                allx.append(t)
    print(json.dumps(allx, ensure_ascii=False, indent=0))
