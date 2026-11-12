"""Verify the web schema against authoritative SQL, and all protected baselines."""
import hashlib,json,re
from pathlib import Path

root=Path(__file__).resolve().parents[1]
out=root/'evidence/classroom'
def read(name): return json.loads((out/name).read_text(encoding='utf-8-sig'))
def digest(value): return hashlib.sha256(json.dumps(value,ensure_ascii=False,sort_keys=True).encode()).hexdigest()
def normalize(value):
    value=value.replace('\r','')
    value=re.sub(r'(?m)^\s*--[^\n]*','',value)
    value=re.sub(r'CREATE\s+(?:OR\s+ALTER\s+)?','CREATE ',value,flags=re.I)
    return value.strip()
source=(root.parent/'BÀI TẬP LỚN/EnglishExamDB.sql').read_text(encoding='utf-8-sig')
batches=re.split(r'^GO\s*;?\s*$',source,flags=re.M|re.I)
original=read('EnglishExamDB-schema-before.json')
report={'protectedFilesUnchanged':read('protected-before.json')==read('protected-after.json'),
        'originalSchemaUnchanged':original==read('EnglishExamDB-schema-after.json'),
        'originalAllTableDataUnchanged':read('EnglishExamDB-data-before.json')==read('EnglishExamDB-data-after.json'),
        'databases':{}}
groups=['columns','keys','foreign_keys','checks']
for name in ['EnglishExamDB_WebDev','EnglishExamDB_WebTest']:
    before=read(name+'-schema-before.json');after=read(name+'-schema-after.json')
    modules={}
    for m in after['modules']:
        found=[b for b in batches if re.search(r'CREATE\s+(?:OR\s+ALTER\s+)?(?:PROCEDURE|VIEW|TRIGGER)\s+dbo\.'+re.escape(m['name'])+r'\b',b,re.I)]
        modules[m['name']]={'matchesOfficialSql':len(found)==1 and normalize(found[0])==normalize(m['definition']),
                           'enabled':not m['is_disabled'],'ansiNulls':bool(m['uses_ansi_nulls']),'quotedIdentifier':bool(m['uses_quoted_identifier'])}
    report['databases'][name]={'schemaMatchesOriginal':{g:after[g]==original[g] for g in groups},
        'schemaUnchanged':{g:after[g]==before[g] for g in groups+['modules']},
        'tableCount':len(after['counts']),'objectCounts':{t:sum(m['type'].strip()==t for m in after['modules']) for t in ['P','V','TR']},
        'schemaSha256':digest({g:after[g] for g in groups+['modules']}),'modules':modules,
        'noStoredMaxPoints':not any(c['table']=='ExamAttempts' and c['name']=='MaxPoints' for c in after['columns'])}
report['passed']=all(report[k] for k in ['protectedFilesUnchanged','originalSchemaUnchanged','originalAllTableDataUnchanged']) and all(
    all(d['schemaMatchesOriginal'].values()) and all(d['schemaUnchanged'].values()) and d['tableCount']==10 and d['objectCounts']=={'P':4,'V':2,'TR':10}
    and d['noStoredMaxPoints'] and all(all(m.values()) for m in d['modules'].values()) for d in report['databases'].values())
(out/'contract-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
raise SystemExit(0 if report['passed'] else 1)
