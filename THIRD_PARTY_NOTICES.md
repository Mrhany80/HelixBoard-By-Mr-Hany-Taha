# Third-party notices

HelixBoard bundles the libraries below (folder `vendor/`). Each keeps its own licence. "Seen in file" means the licence text or
header is in the bundled file itself. "Upstream" means it is the library's published licence and is NOT stated in the bundled file,
so please confirm it at the link before publishing. The owner's own code is covered separately (see LICENSE.proposed).

| Library | File | Licence | Status | Source |
|---|---|---|---|---|
| Chart.js 4.5.1 | chart.umd.min.js | MIT | seen in file | https://www.chartjs.org |
| GSAP 3.15.0 | gsap.min.js | GreenSock "Standard License" (not MIT) | seen in file | https://gsap.com/standard-license |
| jsPDF 4.2.1 | jspdf.umd.min.js | MIT | upstream | https://github.com/parallax/jsPDF |
| KaTeX (+ mhchem) | katex.min.js, katex-mhchem.min.js | MIT | upstream | https://github.com/KaTeX/KaTeX |
| mammoth.js | mammoth.browser.min.js | BSD-2-Clause | upstream | https://github.com/mwilliamson/mammoth.js |
| pdf-lib | pdf-lib.min.js | MIT (the file also carries Apache-2.0 text from a bundled part) | upstream | https://github.com/Hopding/pdf-lib |
| pdf.js (+ worker) | pdf.min.mjs, pdf.worker.min.mjs | Apache-2.0 | seen in file | https://github.com/mozilla/pdf.js |
| perfect-freehand 1.2.3 | perfect-freehand.js | MIT | seen in file | https://github.com/steveruizok/perfect-freehand |
| pptx-preview | pptx-preview.umd.js | MIT; includes Apache ECharts (Apache-2.0, "Baidu Inc." header seen) | upstream | https://github.com/meshesha/pptx-preview-or-similar - confirm the exact package |
| QR Code Generator | qrcode-generator.js | MIT | seen in file | http://www.d-project.com/ |
| rough.js | rough.js | MIT | upstream | https://github.com/rough-stuff/rough |
| SmilesDrawer | smiles-drawer.min.js | MIT (file also carries BSD and Apache notices from bundled parts) | upstream | https://github.com/reymond-group/smilesDrawer |
| supabase-js | supabase.js | MIT | upstream | https://github.com/supabase/supabase-js |
| Fonts: Caveat, Lexend, Space Grotesk, JetBrains Mono | fonts/*.woff2 | SIL Open Font Licence 1.1 | upstream | https://fonts.google.com |

Local change: `vendor/pptx-preview.umd.js` was patched in 3.3.0 (chart colours, no chart animation, blank default chart title). Keep that
patch if the library is updated.

Open point for the owner: GSAP's licence is not MIT. It allows free use in this kind of product, but check
https://gsap.com/standard-license before the project is made open source or sold.
