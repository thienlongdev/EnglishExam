"""Apply the committed login theme to the existing local realm, preserving users and clients."""
from pathlib import Path
import json, urllib.request, urllib.parse, subprocess, shutil
root=Path(__file__).resolve().parents[1]
env=dict(line.split('=',1) for line in (root/'.env').read_text().splitlines() if '=' in line)
source=root/'frontend/node_modules/@fontsource-variable/quicksand'
target=root/'identity-theme/english-exam/login/resources/fonts'
target.mkdir(parents=True,exist_ok=True)
shutil.copyfile(source/'index.css',target/'quicksand.css')
shutil.copytree(source/'files',target/'files',dirs_exist_ok=True)
shutil.copyfile(source/'LICENSE',target/'LICENSE')
subprocess.run(['docker','cp',str(root/'identity-theme/english-exam'),'english-exam-web-identity:/opt/keycloak/themes/'],check=True,capture_output=True)
base='http://localhost:8180'
payload=urllib.parse.urlencode({'client_id':'admin-cli','grant_type':'password','username':'owner','password':env['OIDC_ADMIN_PASSWORD']}).encode()
with urllib.request.urlopen(urllib.request.Request(base+'/realms/master/protocol/openid-connect/token',data=payload)) as response:
 token=json.load(response)['access_token']
headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'}
request=urllib.request.Request(base+'/admin/realms/english-exam',headers=headers,data=json.dumps({'loginTheme':'english-exam','displayName':'English Exam','internationalizationEnabled':True,'supportedLocales':['vi','en'],'defaultLocale':'vi'}).encode(),method='PUT')
with urllib.request.urlopen(request) as response: print('Local realm theme:',response.status)
