from pathlib import Path
import secrets,json
p=Path(__file__).resolve().parents[1]
local=p/'.local'
local.mkdir(exist_ok=True)
if not (p/'.env').exists():
    values={'SQL_SA_PASSWORD':'Ee!'+secrets.token_hex(20),'SQL_APP_PASSWORD':'Ee!'+secrets.token_hex(20),'OIDC_ADMIN_PASSWORD':secrets.token_urlsafe(24),'OIDC_CLIENT_SECRET':secrets.token_urlsafe(32),'DEMO_PASSWORD':'Exam!'+secrets.token_urlsafe(16)}
    (p/'.env').write_text('\n'.join(k+'='+v for k,v in values.items())+'\n')
else:
    values=dict(line.split('=',1) for line in (p/'.env').read_text().splitlines() if '=' in line)
realm={'realm':'english-exam','enabled':True,'displayName':'English Exam · Local identity','registrationAllowed':False,'loginWithEmailAllowed':True,'resetPasswordAllowed':False,'sslRequired':'none','bruteForceProtected':True,'clients':[{'clientId':'english-exam-web','secret':values['OIDC_CLIENT_SECRET'],'publicClient':False,'standardFlowEnabled':True,'directAccessGrantsEnabled':False,'redirectUris':['http://localhost:3000/login/oauth2/code/exam'],'webOrigins':['http://localhost:3000'],'attributes':{'pkce.code.challenge.method':'S256','post.logout.redirect.uris':'http://localhost:3000/'}}],'users':[{'username':name,'email':email,'emailVerified':True,'enabled':True,'firstName':first,'lastName':last,'credentials':[{'type':'password','value':values['DEMO_PASSWORD'],'temporary':False}]} for name,email,first,last in [('student','student@exam.local','An','Học viên'),('teacher','teacher@exam.local','Minh','Giảng viên'),('outsider','outsider@exam.local','Bình','Chưa ghi danh')]]}
(local/'realm.json').write_text(json.dumps(realm,ensure_ascii=False,indent=2),encoding='utf-8')
source=(p.parent/'BÀI TẬP LỚN'/'EnglishExamDB.sql').read_text(encoding='utf-8-sig')
(local/'initialize-dev.sql').write_text(source.replace('EnglishExamDB','EnglishExamDB_WebDev'),encoding='utf-8')
(local/'credentials.txt').write_text('Local OIDC accounts only; never deploy this realm publicly.\nstudent / teacher / outsider\nPassword: '+values['DEMO_PASSWORD']+'\n',encoding='utf-8')
print('Prepared ignored local secrets, real OIDC realm and isolated SQL initialization.')
