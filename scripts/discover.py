from pathlib import Path
import hashlib,json,zipfile,xml.etree.ElementTree as ET,re
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'EnglishExamWeb'/'evidence'
OUT.mkdir(parents=True,exist_ok=True)
files=list((ROOT/'BÀI TẬP LỚN').rglob('*'))+list((ROOT/'EnglishExamDatabaseCoursework').rglob('*'))+[ROOT/'BAO_CAO_CSDL.docx',ROOT/'FINAL.zip',ROOT/'EnglishExamDatabase.zip']
manifest={str(p.relative_to(ROOT)): {'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in files if p.is_file() and '__pycache__' not in str(p)}
(OUT/'coursework-before.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
with zipfile.ZipFile(ROOT/'BAO_CAO_CSDL.docx') as z:
    xml=ET.fromstring(z.read('word/document.xml'))
    paragraphs=[''.join(p.itertext()) for p in xml.findall('.//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p')]
    (OUT/'report-extract.txt').write_text('\n'.join(paragraphs),encoding='utf-8')
with zipfile.ZipFile(ROOT/'BÀI TẬP LỚN'/'SLIDES.pptx') as z:
    slides={n:' '.join(ET.fromstring(z.read(n)).itertext()) for n in z.namelist() if re.fullmatch(r'ppt/slides/slide\d+.xml',n)}
    (OUT/'slides-extract.json').write_text(json.dumps(slides,ensure_ascii=False,indent=2),encoding='utf-8')
with zipfile.ZipFile(ROOT/'FINAL.zip') as z:
    (OUT/'archive-inventory.json').write_text(json.dumps({n:hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist() if not n.endswith('/')},indent=2),encoding='utf-8')
print(json.dumps({'protected_files':len(manifest),'sql':manifest['BÀI TẬP LỚN/EnglishExamDB.sql'],'backup':manifest['BÀI TẬP LỚN/EnglishExamDB.bak']},ensure_ascii=False))
