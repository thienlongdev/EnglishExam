param([Parameter(Mandatory=$true)][string]$Snapshot,[ValidateSet('backup','sql')][string]$Source='backup')
# Snapshot must be captured read-only with snapshot.ps1; this script never connects or writes to SQL.
$ErrorActionPreference='Stop'
$root=(Resolve-Path "$PSScriptRoot\..").Path
$baseline=if($Source -eq 'backup'){"$root/evidence/original-before.json"}else{"$root/evidence/dev-recovery-before.json"}
$env:EXAM_CONTRACT_BASELINE=$baseline;$env:EXAM_CONTRACT_TARGET=(Resolve-Path -LiteralPath $Snapshot).Path
@'
import os,json,sys
from pathlib import Path
a=json.loads(Path(os.environ['EXAM_CONTRACT_BASELINE']).read_text(encoding='utf-8-sig'))
b=json.loads(Path(os.environ['EXAM_CONTRACT_TARGET']).read_text(encoding='utf-8-sig'))
checks={k:a[k]==b[k] for k in ['columns','keys','foreign_keys','checks','modules']}
print(json.dumps({'pass':all(checks.values()),'groups':checks}))
sys.exit(0 if all(checks.values()) else 1)
'@ | python -X utf8 -
if($LASTEXITCODE -ne 0){throw 'Host contract differs from the selected unmodified source. Do not activate production.'}
