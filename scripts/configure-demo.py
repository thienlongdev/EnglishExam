"""Bind the isolated EnglishExamWeb runtime to the persistent Tailscale Funnel hostname.

The public hostname comes from the local Tailscale node identity (never from a temporary
quick-tunnel log), so it stays identical across tunnel, service and machine restarts.
"""
from pathlib import Path
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / '.local' / 'demo'
GATEWAY_PORT = 8090
HTTPS_PORT = 443
REALM = 'english-exam-demo'
ORIGIN = 'https://english-exam-coursework.vercel.app'


def tailscale(*args):
    try:
        result = subprocess.run(['tailscale', *args], capture_output=True, text=True, timeout=60,
                                stdin=subprocess.DEVNULL, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        return result.stdout if result.returncode == 0 else ''
    except (OSError, subprocess.SubprocessError):
        return ''


def public_host():
    try:
        status = json.loads(tailscale('status', '--json') or '{}')
    except json.JSONDecodeError:
        return None
    name = (status.get('Self') or {}).get('DNSName')
    return name.rstrip('.') if name else None


def ensure_funnel(host):
    status = tailscale('funnel', 'status')
    configured = host in status and 'Funnel on' in status and f'proxy http://127.0.0.1:{GATEWAY_PORT}' in status
    if configured:
        return True
    output = tailscale('funnel', '--bg', '--yes', f'--https={HTTPS_PORT}', f'http://127.0.0.1:{GATEWAY_PORT}')
    if output:
        print(output.strip(), file=sys.stderr)
    status = tailscale('funnel', 'status')
    return host in status and f'proxy http://127.0.0.1:{GATEWAY_PORT}' in status


def main():
    host = public_host()
    if not host:
        raise SystemExit('Tailscale identity is unavailable; cannot derive the persistent public hostname')
    base = f'https://{host}'
    if not ensure_funnel(host):
        raise SystemExit('Tailscale Funnel could not be verified for 127.0.0.1:%d' % GATEWAY_PORT)

    secrets = json.loads((LOCAL / 'secrets.json').read_text())
    runtime = {
        'tunnelUrl': base,
        'origin': ORIGIN,
        'issuer': f'{base}/realms/{REALM}',
        'database': 'EnglishExamDB_Demo',
        'identityDatabase': 'EnglishExamDB_DemoIdentity',
        'backendPort': 8082,
        'identityPort': 8280,
        'gatewayPort': GATEWAY_PORT,
        'publicHost': host,
        'tunnelMode': 'tailscale-funnel',
    }
    (LOCAL / 'runtime.json').write_text(json.dumps(runtime, indent=2), encoding='utf-8')

    env = {
        'KC_DB': 'mssql',
        'KC_DB_URL': 'jdbc:sqlserver://host.docker.internal:14339;databaseName=EnglishExamDB_DemoIdentity;encrypt=true;trustServerCertificate=true',
        'KC_DB_USERNAME': 'exam_demo_identity',
        'KC_DB_PASSWORD': secrets['identityDbPassword'],
        'KC_HOSTNAME': base,
        'KC_HOSTNAME_ADMIN': 'http://127.0.0.1:8280',
        'KC_HOSTNAME_STRICT': 'true',
        'KC_HTTP_ENABLED': 'true',
        'KC_PROXY_HEADERS': 'xforwarded',
        'KC_HEALTH_ENABLED': 'true',
        'KC_CACHE': 'local',
        'KC_BOOTSTRAP_ADMIN_USERNAME': 'demo-owner',
        'KC_BOOTSTRAP_ADMIN_PASSWORD': secrets['adminPassword'],
        'JAVA_OPTS_KC_HEAP': '-Xms128m -Xmx512m',
    }
    (LOCAL / 'keycloak.env').write_text(''.join(f'{k}={v}\n' for k, v in env.items()), encoding='utf-8')
    print(json.dumps(runtime))


if __name__ == '__main__':
    main()
