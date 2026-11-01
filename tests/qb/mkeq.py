import docx, copy
from lxml import etree
M = 'http://schemas.openxmlformats.org/officeDocument/2006/math'; W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
def om(xml): return etree.fromstring('<m:oMath xmlns:m="%s" xmlns:w="%s">%s</m:oMath>' % (M, W, xml))
r = lambda t: '<m:r><m:t>%s</m:t></m:r>' % t
frac = lambda a, b: '<m:f><m:num>%s</m:num><m:den>%s</m:den></m:f>' % (a, b)
sub = lambda e, s: '<m:sSub><m:e>%s</m:e><m:sub>%s</m:sub></m:sSub>' % (e, s)
sup = lambda e, s: '<m:sSup><m:e>%s</m:e><m:sup>%s</m:sup></m:sSup>' % (e, s)
d = docx.Document()
d.add_heading('Physics and Chemistry Quiz', 1)
p = d.add_paragraph('1. Use '); p._p.append(om(r('v=') + frac(r('d'), r('t')))); p.add_run(' to calculate the speed when d = 100 m and t = 20 s.')
d.add_paragraph('2. Which is the formula of water?')
for i, (e) in enumerate([sub(r('H'), r('2')) + r('O'), r('C') + sub(r('O'), r('2')), sub(r('O'), r('2'))]):
    p = d.add_paragraph('abc'[i] + ') '); p._p.append(om(e))
d.add_paragraph('3. Look at the equation:')
p = d.add_paragraph(); para = etree.SubElement(p._p, '{%s}oMathPara' % M); para.append(om(r('E=m') + sup(r('c'), r('2'))))
d.add_paragraph('What does c stand for in this equation?')
d.add_paragraph('Answer key')
d.add_paragraph('1. 5 m/s')
d.add_paragraph('2. A')
d.add_paragraph('3. the speed of light')
d.save('eq.docx'); print('ok')
