#!/usr/bin/env python3
"""Concatenate src/*.js (in filename order) into template.html -> dist/index.html."""
import glob, os
here = os.path.dirname(os.path.abspath(__file__))
files = sorted(glob.glob(os.path.join(here, 'src', '*.js')))
js = '\n'.join(open(f, encoding='utf-8').read() for f in files)
tpl = open(os.path.join(here, 'template.html'), encoding='utf-8').read()
out = tpl.replace('/*__JS__*/', '(function(){\n' + js + '\n})();')
os.makedirs(os.path.join(here, 'dist'), exist_ok=True)
open(os.path.join(here, 'dist', 'index.html'), 'w', encoding='utf-8').write(out)
print('built dist/index.html:', len(out) // 1024, 'kB from', len(files), 'modules')
