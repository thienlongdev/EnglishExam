"""Package reviewed source only; exclude secrets, databases, caches and local runtime."""
from pathlib import Path
import json,hashlib,zipfile,base64
root=Path(__file__).resolve().parents[1]
out=root/'release';out.mkdir(exist_ok=True)
files=[]
for folder in ['backend/src','frontend/src','identity-theme','docs','scripts']:
    files.extend(p for p in (root/folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts)
for name in ['README.md','.gitignore','.env.example','.env.production.example','render.yaml','compose.yaml','compose.demo.yaml','backend/pom.xml','backend/Dockerfile','backend/.dockerignore','frontend/package.json','frontend/package-lock.json','frontend/next.config.ts','frontend/next-env.d.ts','frontend/tsconfig.json','frontend/vercel.json','frontend/.vercelignore','frontend/playwright.config.ts','frontend/playwright.production.config.ts']:
    files.append(root/name)
files.extend(p for p in (root/'frontend/tests').glob('*') if p.is_file() and p.name!='diagnose.cjs')
files.extend(p for p in (root/'frontend/tests-production').glob('*.ts') if p.is_file())
files=sorted(set(files));manifest=[]
with zipfile.ZipFile(out/'english-exam-source.zip','w',zipfile.ZIP_DEFLATED) as archive:
    for p in files:
        rel=p.relative_to(root).as_posix();data=p.read_bytes()
        assert not any(part in {'.local','.env','node_modules','.next','.next-preview','target','.vercel'} for part in p.relative_to(root).parts)
        archive.writestr(rel,data);manifest.append({'path':rel,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)})
(out/'source-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
frontend=[p for p in files if p.relative_to(root).parts[0]=='frontend' and ('src' in p.relative_to(root).parts or p.name in ['package.json','package-lock.json','next.config.ts','next-env.d.ts','tsconfig.json','vercel.json','.vercelignore'])]
request={'name':'english-exam-coursework','project':'prj_gBzNA7EV8w2vOUrQ52vo3KyZYcTX','target':'production','projectSettings':{'framework':'nextjs','nodeVersion':'22.x'},'files':[{'file':p.relative_to(root/'frontend').as_posix(),'data':base64.b64encode(p.read_bytes()).decode(),'encoding':'base64'} for p in frontend]}
(out/'vercel-request.json').write_text(json.dumps(request),encoding='utf-8')
print(json.dumps({'archive':str(out/'english-exam-source.zip'),'files':len(files),'frontendFiles':len(frontend),'bytes':(out/'english-exam-source.zip').stat().st_size}))
