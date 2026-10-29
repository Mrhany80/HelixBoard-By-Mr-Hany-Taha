#!/usr/bin/env python3
"""HelixBoard build — concatenate app/*.js into one dist/index.html, inline vendor libraries.

Usage:  python3 build.py            → writes dist/index.html
        python3 build.py out.html   → writes to that path too
"""
import json, sys, os, re

R = os.path.dirname(os.path.abspath(__file__)) + '/'
A = R + 'app/'
V = R + 'vendor/'
D = R + 'dist/'

# source modules, loaded in this order; wrap each in try/catch so one broken
# module doesn't stop the whole app
ORDER = ['core','engine','input','stamps','sci_bio','sci_chem','sci_phys','calc','keyboard',
         'recog','classtools','notes','smart','mindmap','deck','wheel','timer','water','io','ui',
         'fullscreen','toolsize','roots','studio','notekit','classlink','liveclass','videolesson','reports','account','install','lang','intro','main']

parts = []
for m in ORDER:
    f = A + m + '.js'
    if not os.path.exists(f):
        print('WARN: missing', m); continue
    code = open(f, encoding='utf-8').read()
    parts.append('/* ==== %s.js ==== */\ntry {\n%s\n} catch (e) { console.error("HelixBoard: %s.js failed to start", e); (window.__hbErr = window.__hbErr || []).push("%s.js: " + e.message); }' % (m, code, m, m))

icons = json.load(open(A + 'icons.json', encoding='utf-8'))
elements = open(A + 'elements.json', encoding='utf-8').read() if os.path.exists(A + 'elements.json') else '[]'
# Arabic interface dictionary (English text → Arabic), used by lang.js
ar = open(A + 'ar.json', encoding='utf-8').read() if os.path.exists(A + 'ar.json') else '{}'

# GSAP and perfect-freehand should be inlined as the data block. If missing,
# the app still works but animations and brush strokes may be plain.
gsap = ''
pf = ''
pf_path = V + 'perfect-freehand.js'
if os.path.exists(pf_path): pf = open(pf_path, encoding='utf-8').read()
gsap_path = V + 'gsap.min.js'
if os.path.exists(gsap_path): gsap = open(gsap_path, encoding='utf-8').read()
qr_path = V + 'qrcode-generator.js'
qr = open(qr_path, encoding='utf-8').read() if os.path.exists(qr_path) else ''
# Supabase client (accounts) — supabase-js 2.117.3, MIT
sb_path = V + 'supabase.js'
sbjs = open(sb_path, encoding='utf-8').read().split('//# sourceMappingURL')[0] if os.path.exists(sb_path) else ''

data = ('/* GSAP 3.15.0 — GreenSock Standard No-Charge License, inlined */\n' + gsap + '\n'
        + 'window.ICONS=' + json.dumps(icons, separators=(',',':')) + ';\n'
        + 'window.ELEMENTS=' + elements + ';\n' + 'window.HB_AR=' + json.dumps(json.loads(ar), ensure_ascii=False, separators=(',',':')) + ';\n' + pf + '\n/* qrcode-generator 1.4.4 — MIT (Kazuhiko Arase), for phone-quiz join codes */\n' + qr + '\n/* supabase-js 2.117.3 — MIT (Supabase), accounts */\n' + sbjs)

shell = open(A + 'shell.html', encoding='utf-8').read()
# fonts, inlined so the app never waits for (or needs) the internet
import base64
FONTS = [('Lexend', 'lexend-latin-wght-normal', '100 900'), ('Space Grotesk', 'space-grotesk-latin-wght-normal', '300 700'), ('JetBrains Mono', 'jetbrains-mono-latin-500-normal', '500'), ('JetBrains Mono', 'jetbrains-mono-latin-700-normal', '700'), ('Caveat', 'caveat-latin-500-normal', '500'), ('Caveat', 'caveat-latin-700-normal', '700')]
ff = ''
for fam, fn, wt in FONTS:
    fp = V + 'fonts/' + fn + '.woff2'
    if os.path.exists(fp): ff += "@font-face{font-family:'%s';font-style:normal;font-display:swap;font-weight:%s;src:url(data:font/woff2;base64,%s) format('woff2')}\n" % (fam, wt, base64.b64encode(open(fp, 'rb').read()).decode())
shell = shell.replace('<!--FONTS-->', '<style>' + ff + '</style>')
# the design layer (app/design.css) goes last in <head>, so it refines everything before it
if os.path.exists(A + 'design.css'): shell = shell.replace('</head>', '<style id="design">' + open(A + 'design.css', encoding='utf-8').read() + '</style>\n</head>', 1)
safe = lambda t: t.replace('</script', '<\\/script')
out = shell.replace('/*DATA*/', safe(data)).replace('/*APP*/', safe('\n'.join(parts)))

# inline vendor document libraries (pdf.js, pptx-preview, mammoth, jsPDF) so
# PDF / PowerPoint / Word opening works offline and behind school firewalls
LIBS = [
    ('pdfjs',     'pdf.min.mjs',             'pdf.js 6.4.299 — Apache-2.0'),
    ('pdfworker', 'pdf.worker.min.mjs',      'pdf.js worker — Apache-2.0'),
    ('pptx',      'pptx-preview.umd.js',     'pptx-preview 1.0.7 — ISC'),
    ('mammoth',   'mammoth.browser.min.js',  'mammoth 1.8.0 — BSD-2-Clause'),
    ('jspdf',     'jspdf.umd.min.js',        'jsPDF 4.2.1 — MIT'),
]
emb = ''
for k, fn, lic in LIBS:
    fp = V + fn
    if not os.path.exists(fp):
        print('WARN: missing vendor', fn); continue
    body = open(fp, encoding='utf-8').read().split('//# sourceMappingURL')[0]
    body = body.replace('</script', '<\\/script').replace('<!--', '<\\x21--')
    emb += '<script type="text/hb-lib" id="hblib-' + k + '" data-lic="' + lic + '">' + body + '</script>\n'

# insert vendor scripts just before </body>
i = out.rfind('</body>')
if i >= 0: out = out[:i] + emb + out[i:]
else: out += emb

os.makedirs(D, exist_ok=True)
open(D + 'index.html', 'w', encoding='utf-8').write(out)

# ---------- installable web app for tablets (Android, iPad): manifest, icons, offline service worker ----------
import hashlib, shutil
ver = hashlib.sha256(out.encode('utf-8')).hexdigest()[:12]
manifest = {
  'name': 'HelixBoard By Mr. Hany Taha', 'short_name': 'HelixBoard', 'description': 'Interactive science whiteboard for teaching and study.',
  'id': './', 'start_url': './', 'scope': './', 'display': 'fullscreen', 'display_override': ['fullscreen', 'standalone'],
  'orientation': 'any', 'background_color': '#120A14', 'theme_color': '#120A14', 'lang': 'en', 'dir': 'auto', 'categories': ['education', 'productivity'],
  'icons': [{'src': 'icons/icon-192.png', 'sizes': '192x192', 'type': 'image/png'}, {'src': 'icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png'},
            {'src': 'icons/maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'}],
  'file_handlers': [{'action': './', 'accept': {'application/octet-stream': ['.helix', '.hbset', '.hbhw', '.hbres']}}],
}
open(D + 'manifest.webmanifest', 'w', encoding='utf-8').write(json.dumps(manifest, indent=1))
os.makedirs(D + 'icons', exist_ok=True)
for f in os.listdir(A + 'icons'): shutil.copy(A + 'icons/' + f, D + 'icons/' + f)
open(D + 'sw.js', 'w', encoding='utf-8').write(open(A + 'sw.js', encoding='utf-8').read().replace('__VERSION__', ver))
# a simple download page for sharing: <site>/download/
os.makedirs(D + 'download', exist_ok=True)
shutil.copy(A + 'download.html', D + 'download/index.html')
print('web app version', ver)
if len(sys.argv) > 1:
    open(sys.argv[1], 'w', encoding='utf-8').write(out)
print('built', len(out) // 1024, 'KB  →  dist/index.html')
