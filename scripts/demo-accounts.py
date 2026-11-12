"""Local-only owner onboarding. Public registrations never receive application roles automatically."""
from pathlib import Path
import argparse, json, subprocess, urllib.parse, urllib.request

root = Path(__file__).resolve().parents[1]
secrets = json.loads((root / '.local/demo/secrets.json').read_text())
base = 'http://127.0.0.1:8280'
realm = 'english-exam-demo'

def request(method, url, data=None, token=None, form=False):
    body = None if data is None else (urllib.parse.urlencode(data).encode() if form else json.dumps(data).encode())
    headers = {'Content-Type': 'application/x-www-form-urlencoded' if form else 'application/json'}
    if token: headers['Authorization'] = 'Bearer ' + token
    with urllib.request.urlopen(urllib.request.Request(url, body, headers, method=method), timeout=30) as response:
        payload = response.read()
        return json.loads(payload) if payload else None

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('action', choices=['enable-registration', 'list', 'approve'])
parser.add_argument('--username')
parser.add_argument('--role', choices=['teacher', 'student'])
parser.add_argument('--identity-verified-by-owner', action='store_true', help='Only use after independently verifying the registrant identity and email; never approve unknown public accounts.')
args = parser.parse_args()
token = request('POST', base + '/realms/master/protocol/openid-connect/token', {
    'grant_type': 'password', 'client_id': 'admin-cli', 'username': 'demo-owner', 'password': secrets['adminPassword']}, form=True)['access_token']
admin = base + '/admin/realms/' + realm
if args.action == 'enable-registration':
    config = request('GET', admin, token=token)
    config['registrationAllowed'] = True
    config['internationalizationEnabled'] = True
    config['supportedLocales'] = ['vi', 'en']
    config['defaultLocale'] = 'vi'
    # There is no SMTP provider. Unknown emails stay unverified and no SQL role is auto-created.
    config['verifyEmail'] = False
    request('PUT', admin, config, token)
    exported = json.loads((root / '.local/demo/realm.json').read_text(encoding='utf-8'))
    exported['registrationAllowed'] = True
    exported.update(internationalizationEnabled=True, supportedLocales=['vi', 'en'], defaultLocale='vi')
    (root / '.local/demo/realm.json').write_text(json.dumps(exported, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'registrationAllowed': True, 'automaticRoleGrant': False, 'administration': 'loopback only'}))
elif args.action == 'list':
    users = request('GET', admin + '/users?max=1000', token=token)
    print(json.dumps([{'username': u['username'], 'email': u.get('email'), 'emailVerified': u.get('emailVerified'), 'enabled': u['enabled']} for u in users], ensure_ascii=False, indent=2))
else:
    if not args.username or not args.role or not args.identity_verified_by_owner:
        parser.error('approve requires --username, --role and --identity-verified-by-owner after owner verification')
    users = request('GET', admin + '/users?' + urllib.parse.urlencode({'username': args.username, 'exact': 'true'}), token=token)
    if len(users) != 1: raise SystemExit('Exactly one registered identity is required')
    user = users[0]
    if not user.get('email') or not user.get('enabled'): raise SystemExit('Account needs an email and must be enabled')
    # Pass only the approved profile via a private temporary JSON file, never credentials on the command line.
    profile_path = root / '.local/demo/approval-profile.json'
    profile_path.write_text(json.dumps({'email': user['email'], 'firstName': user.get('firstName') or user['username'],
                                      'lastName': user.get('lastName') or '', 'role': args.role}), encoding='utf-8')
    subprocess.run(['powershell.exe', '-NoProfile', '-File', str(root / 'scripts/approve-demo-account.ps1')], check=True)
    # Only the locally verified owner action marks this identity as verified; public registration cannot do so.
    request('PUT', admin + '/users/' + user['id'], {'emailVerified': True}, token)
    print(json.dumps({'approvedUsername': user['username'], 'role': args.role, 'next': 'Sign out and sign in again to refresh OIDC claims.'}))
