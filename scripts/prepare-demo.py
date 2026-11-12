"""Prepare isolated demo assets. No network, database writes, or coursework edits."""
from pathlib import Path
import hashlib, json, secrets

root = Path(__file__).resolve().parents[1]
local = root / '.local' / 'demo'
local.mkdir(parents=True, exist_ok=True)
secret_file = local / 'secrets.json'
if not secret_file.exists():
    values = {key: 'Ee!' + secrets.token_urlsafe(30) for key in
              ['dbPassword', 'identityDbPassword', 'adminPassword', 'clientSecret', 'teacherPassword', 'studentPassword', 'outsiderPassword']}
    secret_file.write_text(json.dumps(values, indent=2), encoding='utf-8')
values = json.loads(secret_file.read_text(encoding='utf-8'))
origin = 'https://english-exam-coursework.vercel.app'
realm = {
    'realm': 'english-exam-demo', 'enabled': True, 'displayName': 'English Exam · Classroom Demo',
    'loginTheme': 'english-exam', 'registrationAllowed': True, 'loginWithEmailAllowed': True,
    'resetPasswordAllowed': False, 'rememberMe': False, 'sslRequired': 'external',
    'bruteForceProtected': True, 'permanentLockout': False, 'failureFactor': 5,
    'internationalizationEnabled': True, 'supportedLocales': ['vi', 'en'], 'defaultLocale': 'vi',
    'ssoSessionIdleTimeout': 14400, 'ssoSessionMaxLifespan': 28800,
    'clients': [{'clientId': 'english-exam-demo', 'secret': values['clientSecret'],
                 'publicClient': False, 'standardFlowEnabled': True, 'directAccessGrantsEnabled': False,
                 'serviceAccountsEnabled': False, 'redirectUris': [origin + '/login/oauth2/code/exam'],
                 'webOrigins': [origin], 'attributes': {'pkce.code.challenge.method': 'S256',
                                                     'post.logout.redirect.uris': origin + '/'}}],
    'users': [{'username': name, 'email': name + '.demo@englishexam.invalid', 'emailVerified': True,
               'enabled': True, 'firstName': first, 'lastName': last,
               'credentials': [{'type': 'password', 'value': values[name + 'Password'], 'temporary': False}]}
              for name, first, last in [('teacher', 'Minh', 'Nguyễn'), ('student', 'An', 'Trần'), ('outsider', 'Bình', 'Lê')]]
}
(local / 'realm.json').write_text(json.dumps(realm, ensure_ascii=False, indent=2), encoding='utf-8')
source = (root.parent / 'BÀI TẬP LỚN' / 'EnglishExamDB.sql').read_text(encoding='utf-8-sig')
# Copy only the finalized DDL, procedures, views, indexes and triggers. Never run coursework seed/validation sections.
schema = source.split('-- SOURCE 03_Seed_Data.sql', 1)[0]
assert 'CREATE DATABASE EnglishExamDB;' in schema and schema.count('CREATE TABLE dbo.') == 10
schema = schema.replace('EnglishExamDB', 'EnglishExamDB_Demo')
(local / 'initialize-demo.sql').write_text(schema, encoding='utf-8')
(local / 'cloudflared-empty.yml').write_text('{}\n', encoding='utf-8')
credentials = {'url': origin, 'realm': realm['realm'], 'accounts': {
    name: {'username': name, 'email': name + '.demo@englishexam.invalid', 'password': values[name + 'Password']}
    for name in ['teacher', 'student', 'outsider']}}
(local / 'qa-credentials.json').write_text(json.dumps(credentials, indent=2), encoding='utf-8')
print(json.dumps({'prepared': str(local), 'database': 'EnglishExamDB_Demo', 'coreTables': 10,
                  'ddlSha256': hashlib.sha256(schema.encode()).hexdigest(), 'secretsPrinted': False}))
