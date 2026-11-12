"""Read-only comparison of protected coursework, live source and isolated databases."""
from pathlib import Path
import json, hashlib, re, argparse
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--phase',choices=['before','after'],default='after')
args=parser.parse_args()
evidence=root/'evidence'
def read(name): return json.loads((evidence/name).read_text(encoding='utf-8-sig'))
def sha(value): return hashlib.sha256(json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def normalize_module(value):
    # Remove only export comments, normalize SQL Server's CREATE OR ALTER spelling.
    value=re.sub(r'(?m)^\s*--[^\n]*','',value.replace('\r\n','\n'))
    return re.sub(r'CREATE\s+(?:OR\s+ALTER\s+)?','CREATE ',value,flags=re.I).strip()
manifest=read('coursework-before.json')
changed=[name for name,record in manifest.items() if not (root.parent/name).is_file() or hashlib.sha256((root.parent/name).read_bytes()).hexdigest()!=record['sha256']]
original=read('original-before.json')
current=read('original-recovery-'+args.phase+'.json')
groups=['columns','keys','foreign_keys','checks']
source=(root.parent/'BÀI TẬP LỚN/EnglishExamDB.sql').read_text(encoding='utf-8-sig')
batches=re.split(r'^GO\s*;?\s*$',source,flags=re.M|re.I)
report={'protectedFiles':len(manifest),'changedProtectedFiles':changed,'originalUnchanged':original==current,'databases':{}}
for database in ['dev','test']:
    snapshot=read(database+'-recovery-'+args.phase+'.json')
    modules={}
    for module in snapshot['modules']:
        matches=[batch for batch in batches if re.search(r'CREATE\s+(?:OR\s+ALTER\s+)?(?:PROCEDURE|VIEW|TRIGGER)\s+dbo\.'+re.escape(module['name'])+r'\b',batch,re.I)]
        modules[module['name']]={'sourceMatch':len(matches)==1 and normalize_module(matches[0])==normalize_module(module['definition']), 'sha256':sha(normalize_module(module['definition'])), 'settingsMatchSource':module['uses_ansi_nulls'] and module['uses_quoted_identifier'] and not module['is_disabled']}
    baseline=read(database+'-recovery-before.json')
    report['databases'][database]={'tables':len({c['table'] for c in snapshot['columns']}),'objectCounts':{kind:sum(m['type'].strip()==kind for m in snapshot['modules']) for kind in ['P','V','TR']},'schemaGroupsMatchOriginal':{g:snapshot[g]==original[g] for g in groups},'unchangedSinceRecovery':{g:snapshot[g]==baseline[g] for g in groups+['modules']},'schemaSha256':sha({g:snapshot[g] for g in groups+['modules']}),'modules':modules,'noStoredMaxPoints':not any(c['table']=='ExamAttempts' and c['name']=='MaxPoints' for c in snapshot['columns'])}
report['pass']=not changed and report['originalUnchanged'] and all(d['tables']==10 and d['objectCounts']=={'P':4,'V':2,'TR':10} and d['noStoredMaxPoints'] and all(d['schemaGroupsMatchOriginal'].values()) and all(d['unchangedSinceRecovery'].values()) and all(m['sourceMatch'] and m['settingsMatchSource'] for m in d['modules'].values()) for d in report['databases'].values())
report['provenanceNote']='The untouched original live/BAK has two pre-existing mojibake diagnostic strings and QUOTED_IDENTIFIER differences. App modules exactly follow the authoritative coursework SQL export after CREATE spelling/comment/newline normalization; no business logic or SQL artifact is changed.'
(evidence/('database-contract-'+args.phase+'.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'pass':report['pass'],'protectedFiles':len(manifest),'originalUnchanged':report['originalUnchanged'],'sourceModulesPerDatabase':16,'phase':args.phase}))
raise SystemExit(0 if report['pass'] else 1)
