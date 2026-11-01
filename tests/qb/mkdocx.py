import docx, zipfile, shutil, re
from docx.shared import Inches
d = docx.Document()
d.add_heading('Photosynthesis Worksheet', 1)
d.add_paragraph('Name: ____________   Class: ______')
d.add_paragraph().add_run('Part A: Choose the correct answer').bold = True
d.add_paragraph('Which gas do plants take in for photosynthesis?', style='List Number')
for i, o in enumerate(['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Hydrogen']):
    p = d.add_paragraph(); r = p.add_run('abcd'[i] + ') ' + o)
    if o == 'Carbon dioxide': r.bold = True
d.add_paragraph('Look at the leaf cell. What is the green part called?', style='List Number')
d.add_picture('cell.png', width=Inches(2.2))
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
for o in ['Chloroplast', 'Nucleus', 'Vacuole']:
    p = d.add_paragraph(o, style='List Number'); pPr = p._p.get_or_add_pPr(); np = OxmlElement('w:numPr'); il = OxmlElement('w:ilvl'); il.set(qn('w:val'), '1'); np.append(il); pPr.append(np)
d.add_paragraph('The chart below shows the rate of photosynthesis at different light levels.')
d.add_paragraph('CHART_HERE')
d.add_paragraph('At which light level is the rate highest?', style='List Number')
d.add_paragraph('The diagram below shows the process.')
d.add_paragraph('SHAPES_HERE')
d.add_paragraph('Name the gas produced in the diagram.', style='List Number')
d.add_paragraph().add_run('Part B: True or False').bold = True
d.add_paragraph('Photosynthesis happens at night only. (   )', style='List Number')
d.add_paragraph().add_run('Answer key').bold = True
d.add_paragraph('1. B   2. A')
d.add_paragraph('3. High')
d.add_paragraph('4. oxygen')
d.add_paragraph('5. False')
d.save('ws_raw.docx')

CHART_DRAWING = '''<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="4572000" cy="2743200"/><wp:docPr id="50" name="Chart 1"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rIdChart1"/></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>'''
SHAPES = '''<w:r><mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice Requires="wpg"><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="5000000" cy="900000"/><wp:docPr id="60" name="Group 1"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"><wpg:wgp xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wpg:cNvGrpSpPr/><wpg:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="5000000" cy="900000"/><a:chOff x="0" y="0"/><a:chExt cx="5000000" cy="900000"/></a:xfrm></wpg:grpSpPr>
<wps:wsp><wps:cNvSpPr/><wps:spPr><a:xfrm><a:off x="0" y="100000"/><a:ext cx="1500000" cy="700000"/></a:xfrm><a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="70AD47"/></a:solidFill></wps:spPr><wps:style><a:lnRef idx="2"><a:schemeClr val="accent1"><a:shade val="50000"/></a:schemeClr></a:lnRef><a:fillRef idx="1"><a:schemeClr val="accent1"/></a:fillRef></wps:style><wps:txbx><w:txbxContent><w:p><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t>Carbon dioxide + water</w:t></w:r></w:p></w:txbxContent></wps:txbx><wps:bodyPr/></wps:wsp>
<wps:wsp><wps:cNvCnPr/><wps:spPr><a:xfrm><a:off x="1550000" y="450000"/><a:ext cx="1400000" cy="0"/></a:xfrm><a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom><a:ln w="38100"><a:solidFill><a:srgbClr val="333333"/></a:solidFill><a:tailEnd type="triangle"/></a:ln></wps:spPr><wps:bodyPr/></wps:wsp>
<wps:wsp><wps:cNvSpPr/><wps:spPr><a:xfrm><a:off x="1700000" y="0"/><a:ext cx="1100000" cy="350000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></wps:spPr><wps:txbx><w:txbxContent><w:p><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>light energy</w:t></w:r></w:p></w:txbxContent></wps:txbx><wps:bodyPr/></wps:wsp>
<wps:wsp><wps:cNvSpPr/><wps:spPr><a:xfrm><a:off x="3000000" y="100000"/><a:ext cx="1900000" cy="700000"/></a:xfrm><a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="FFC000"/></a:solidFill></wps:spPr><wps:style><a:lnRef idx="2"><a:schemeClr val="accent2"/></a:lnRef><a:fillRef idx="1"><a:schemeClr val="accent2"/></a:fillRef></wps:style><wps:txbx><w:txbxContent><w:p><w:r><w:rPr><w:sz w:val="24"/><w:color w:val="000000"/></w:rPr><w:t>Glucose + oxygen</w:t></w:r></w:p></w:txbxContent></wps:txbx><wps:bodyPr/></wps:wsp>
</wpg:wgp></a:graphicData></a:graphic></wp:inline></w:drawing></mc:Choice><mc:Fallback><w:pict/></mc:Fallback></mc:AlternateContent></w:r>'''
CHART_XML = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><c:chart><c:title><c:tx><c:rich><a:p><a:r><a:t>Rate of photosynthesis</a:t></a:r></a:p></c:rich></c:tx></c:title><c:plotArea><c:barChart><c:barDir val="col"/><c:ser><c:idx val="0"/><c:tx><c:v>Bubbles per minute</c:v></c:tx><c:cat><c:strRef><c:strCache><c:ptCount val="4"/><c:pt idx="0"><c:v>Dark</c:v></c:pt><c:pt idx="1"><c:v>Low</c:v></c:pt><c:pt idx="2"><c:v>Medium</c:v></c:pt><c:pt idx="3"><c:v>High</c:v></c:pt></c:strCache></c:strRef></c:cat><c:val><c:numRef><c:numCache><c:ptCount val="4"/><c:pt idx="0"><c:v>0</c:v></c:pt><c:pt idx="1"><c:v>8</c:v></c:pt><c:pt idx="2"><c:v>19</c:v></c:pt><c:pt idx="3"><c:v>31</c:v></c:pt></c:numCache></c:numRef></c:val></c:ser></c:barChart><c:catAx><c:axId val="1"/><c:title><c:tx><c:rich><a:p><a:r><a:t>Light level</a:t></a:r></a:p></c:rich></c:tx></c:title></c:catAx><c:valAx><c:axId val="2"/><c:title><c:tx><c:rich><a:p><a:r><a:t>Bubbles per minute</a:t></a:r></a:p></c:rich></c:tx></c:title></c:valAx></c:plotArea></c:chart></c:chartSpace>'''
zin = zipfile.ZipFile('ws_raw.docx'); zout = zipfile.ZipFile('ws.docx', 'w', zipfile.ZIP_DEFLATED)
for it in zin.infolist():
    data = zin.read(it.filename)
    if it.filename == 'word/document.xml':
        s = data.decode()
        s = re.sub(r'<w:r>(?:(?!<w:r>).)*?CHART_HERE</w:t></w:r>', CHART_DRAWING, s, flags=re.S)
        s = re.sub(r'<w:r>(?:(?!<w:r>).)*?SHAPES_HERE</w:t></w:r>', SHAPES, s, flags=re.S)
        assert 'HERE' not in s
        s = s.replace('<w:pStyle w:val="ListNumber"/></w:pPr>', '<w:pStyle w:val="ListNumber"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="99"/></w:numPr></w:pPr>')
        s = s.replace('<w:numPr><w:ilvl w:val="1"/></w:numPr>', '<w:numPr><w:ilvl w:val="1"/><w:numId w:val="99"/></w:numPr>')
        data = s.encode()
    if it.filename == 'word/_rels/document.xml.rels':
        data = data.decode().replace('</Relationships>', '<Relationship Id="rIdChart1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="charts/chart1.xml"/></Relationships>').encode()
    if it.filename == 'word/numbering.xml':
        t = data.decode()
        absn = '<w:abstractNum w:abstractNumId="99"><w:multiLevelType w:val="multilevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl><w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="lowerLetter"/><w:lvlText w:val="%2)"/></w:lvl></w:abstractNum>'
        k = t.index('<w:num '); t = t[:k] + absn + t[k:]
        t = t.replace('</w:numbering>', '<w:num w:numId="99"><w:abstractNumId w:val="99"/></w:num></w:numbering>')
        data = t.encode()
    if it.filename == '[Content_Types].xml':
        data = data.decode().replace('</Types>', '<Override PartName="/word/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>').encode()
    zout.writestr(it, data)
zout.writestr('word/charts/chart1.xml', CHART_XML)
zout.close(); print("ok")
