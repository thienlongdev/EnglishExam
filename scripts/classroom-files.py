"""Capture current protected artifacts and reversible source backups; never edit coursework."""
from pathlib import Path
import datetime, hashlib, json, sys, zipfile

root = Path(__file__).resolve().parents[1]
out = root / 'evidence' / 'classroom'
out.mkdir(exist_ok=True)
phase = sys.argv[1]
protected = list((root.parent / 'BÀI TẬP LỚN').iterdir()) + [root.parent / 'FINAL.zip']
manifest = {str(p): {'sha256': hashlib.sha256(p.read_bytes()).hexdigest(), 'bytes': p.stat().st_size} for p in protected}
(out / f'protected-{phase}.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
files = set()
for folder in ['backend/src', 'frontend/src', 'frontend/tests', 'scripts', 'docs']:
    files.update(p for p in (root / folder).rglob('*') if p.is_file() and '__pycache__' not in str(p))
files.update(root / p for p in ['README.md', 'compose.yaml', 'backend/pom.xml', 'frontend/package.json', 'frontend/playwright.config.ts', 'frontend/next.config.ts'])
sources = {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(files)}
if phase == 'before':
    backup = root / '.local' / ('classroom-source-before-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S') + '.zip')
    with zipfile.ZipFile(backup, 'w', zipfile.ZIP_DEFLATED) as z:
        for p in sorted(files):
            z.write(p, p.relative_to(root))
    (out / 'source-before.json').write_text(json.dumps({'backup': str(backup), 'files': sources}, indent=2), encoding='utf-8')
    print(json.dumps({'sourceBackup': str(backup), 'sourceFiles': len(files), 'protectedFiles': len(protected)}))
else:
    original = json.loads((out / 'protected-before.json').read_text(encoding='utf-8'))
    before = json.loads((out / 'source-before.json').read_text(encoding='utf-8'))['files']
    changed = [p for p in sources if sources[p] != before.get(p)]
    (out / 'source-changes.json').write_text(json.dumps(changed, indent=2), encoding='utf-8')
    print(json.dumps({'protectedUnchanged': manifest == original, 'changedSources': changed}))
    assert manifest == original, 'Protected artifacts changed'
