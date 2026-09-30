import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => {
  const absolute = join(root, path);
  assert.ok(existsSync(absolute), `missing systemd artifact: ${path}`);
  return readFileSync(absolute, 'utf8');
};

function parseIni(input: string) {
  const result = new Map<string, Map<string, string[]>>();
  let section = '';
  for (const raw of input.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    const sectionMatch = line.match(/^\[([^\]]+)]$/);
    if (sectionMatch) {
      section = sectionMatch[1];
      if (!result.has(section)) result.set(section, new Map());
      continue;
    }
    const separator = line.indexOf('=');
    assert.notEqual(separator, -1, `invalid unit directive: ${line}`);
    const key = line.slice(0, separator);
    const value = line.slice(separator + 1);
    const values = result.get(section)?.get(key) || [];
    values.push(value);
    result.get(section)?.set(key, values);
  }
  return result;
}

const jobs = [
  {
    name: 'lmv-reconciliation',
    path: '/api/cron/reconcile-pending-sales',
    calendar: '*-*-* 08:00:00 UTC',
  },
  {
    name: 'lmv-abandoned-carts',
    path: '/api/cron/carritos-abandonados',
    calendar: '*-*-* 13:00:00 UTC',
  },
  {
    name: 'lmv-opportunities',
    path: '/api/cron/sales-opportunities',
    calendar: '*-*-* 14:00:00 UTC',
  },
] as const;

test('three hardened services invoke only their matching endpoint without embedding a secret', () => {
  for (const job of jobs) {
    const source = read(`ops/self-hosted/cron/${job.name}.service`);
    const unit = parseIni(source);
    const service = unit.get('Service');
    assert.ok(service, `${job.name} is missing [Service]`);
    assert.deepEqual(service.get('User'), ['lmv-cron']);
    assert.deepEqual(service.get('Group'), ['lmv-cron']);
    assert.deepEqual(service.get('EnvironmentFile'), ['-/etc/lmv-cron/cron.env']);
    assert.deepEqual(service.get('TimeoutStartSec'), ['90s']);
    assert.deepEqual(service.get('NoNewPrivileges'), ['true']);
    assert.deepEqual(service.get('ProtectSystem'), ['strict']);
    assert.deepEqual(service.get('ProtectHome'), ['true']);
    assert.deepEqual(service.get('PrivateTmp'), ['true']);
    assert.deepEqual(service.get('CapabilityBoundingSet'), ['']);
    assert.deepEqual(service.get('RestrictAddressFamilies'), ['AF_UNIX AF_INET AF_INET6']);
    assert.deepEqual(service.get('ExecStart'), [`/usr/local/libexec/lmv-cron-run ${job.name} ${job.path}`]);
    assert.doesNotMatch(source, /CRON_SECRET\s*=/);
  }
});

test('three persistent timers preserve exact UTC schedules independent of server timezone', () => {
  for (const job of jobs) {
    const unit = parseIni(read(`ops/self-hosted/cron/${job.name}.timer`));
    const timer = unit.get('Timer');
    assert.ok(timer, `${job.name} is missing [Timer]`);
    assert.deepEqual(timer.get('OnCalendar'), [job.calendar]);
    assert.deepEqual(timer.get('Persistent'), ['true']);
    assert.deepEqual(timer.get('RandomizedDelaySec'), ['0']);
    assert.deepEqual(timer.get('Unit'), [`${job.name}.service`]);
  }
});

const bash = 'C:\\Program Files\\Git\\bin\\bash.exe';
const runner = join(root, 'ops/self-hosted/cron/lmv-cron-run');

function executable(path: string, content: string) {
  writeFileSync(path, content, 'utf8');
  chmodSync(path, 0o755);
}

function runRunner(mode: string, options: { lockBusy?: boolean } = {}) {
  const sandbox = mkdtempSync(join(tmpdir(), 'lmv-cron-test-'));
  const bin = join(sandbox, 'bin');
  mkdirSync(bin);
  const argsFile = join(sandbox, 'curl-args');
  const attemptsFile = join(sandbox, 'curl-attempts');

  executable(join(bin, 'curl'), `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$@" >> "$FAKE_ARGS_FILE"
config=$(cat)
[[ "$config" == *'Authorization: Bearer '* ]] || exit 97
attempt=0
[[ ! -f "$FAKE_ATTEMPTS_FILE" ]] || attempt=$(cat "$FAKE_ATTEMPTS_FILE")
attempt=$((attempt + 1))
printf '%s' "$attempt" > "$FAKE_ATTEMPTS_FILE"
header=''
output=''
while (($#)); do
  case "$1" in
    --dump-header) header=$2; shift 2 ;;
    --output) output=$2; shift 2 ;;
    *) shift ;;
  esac
done
printf 'body-never-log' > "$output"
case "$FAKE_CURL_MODE" in
  success)
    printf 'HTTP/2 200\\r\\nx-vercel-id: iad1::req-test\\r\\n\\r\\n' > "$header"
    printf '200|0.050'
    exit 0 ;;
  http)
    printf 'HTTP/2 500\\r\\nx-vercel-id: iad1::req-http\\r\\n\\r\\n' > "$header"
    printf '500|0.100'
    exit 22 ;;
  timeout)
    : > "$header"
    printf '000|75.000'
    exit 28 ;;
  connect-retry)
    if [[ "$attempt" == 1 ]]; then
      : > "$header"
      printf '000|0.010'
      exit 7
    fi
    printf 'HTTP/2 200\\r\\nx-request-id: req-retry\\r\\n\\r\\n' > "$header"
    printf '200|0.020'
    exit 0 ;;
esac
exit 98
`);
  executable(join(bin, 'flock'), `#!/usr/bin/env bash
[[ "${options.lockBusy ? '1' : '0'}" == 1 ]] && exit 1
exit 0
`);
  executable(join(bin, 'sleep'), '#!/usr/bin/env bash\nexit 0\n');
  const posixBin = bin.replace(/^([A-Za-z]):/, (_match, drive: string) => `/${drive.toLowerCase()}`).replaceAll('\\', '/');

  const result = spawnSync(bash, [runner, 'lmv-reconciliation', '/api/cron/reconcile-pending-sales'], {
    cwd: root,
    encoding: 'utf8',
    env: {
      SystemRoot: process.env.SystemRoot,
      WINDIR: process.env.WINDIR,
      TEMP: process.env.TEMP,
      TMP: process.env.TMP,
      PATH: `${posixBin}:/usr/bin:/bin`,
      LMV_CURL_BIN: `${posixBin}/curl`,
      LMV_FLOCK_BIN: `${posixBin}/flock`,
      LMV_SLEEP_BIN: `${posixBin}/sleep`,
      CRON_SECRET: 'SECRET_SENTINEL_NEVER_LOG',
      LMV_CRON_BASE_URL: 'https://lamanitodelvegano.cl',
      LMV_CRON_RUNTIME_DIR: sandbox,
      FAKE_ARGS_FILE: argsFile,
      FAKE_ATTEMPTS_FILE: attemptsFile,
      FAKE_CURL_MODE: mode,
    },
  });
  const args = existsSync(argsFile) ? readFileSync(argsFile, 'utf8') : '';
  const attempts = existsSync(attemptsFile) ? Number(readFileSync(attemptsFile, 'utf8')) : 0;
  rmSync(sandbox, { recursive: true, force: true });
  return { ...result, args, attempts };
}

test('runner records a successful authenticated request without exposing its secret or body', () => {
  assert.ok(existsSync(runner), 'missing executable runner');
  const result = runRunner('success');
  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}\nargs=${result.args}\nattempts=${result.attempts}`);
  assert.match(result.stdout, /outcome=success/);
  assert.match(result.stdout, /http_status=200/);
  assert.match(result.stdout, /request_id=iad1::req-test/);
  assert.doesNotMatch(`${result.stdout}${result.stderr}${result.args}`, /SECRET_SENTINEL_NEVER_LOG|body-never-log/);
  assert.match(result.args, /--fail-with-body/);
  assert.match(result.args, /--connect-timeout\n10/);
  assert.match(result.args, /--max-time\n75/);
});

test('runner fails once without retrying an HTTP response or uncertain timeout', () => {
  for (const [mode, status] of [['http', '500'], ['timeout', '000']] as const) {
    const result = runRunner(mode);
    assert.notEqual(result.status, 0);
    assert.equal(result.attempts, 1);
    assert.match(result.stdout, /outcome=failure/);
    assert.match(result.stdout, new RegExp(`http_status=${status}`));
  }
});

test('runner retries exactly once only for a pre-response connect failure', () => {
  const result = runRunner('connect-retry');
  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}\nargs=${result.args}\nattempts=${result.attempts}`);
  assert.equal(result.attempts, 2);
  assert.match(result.stdout, /outcome=retrying/);
  assert.match(result.stdout, /outcome=success/);
  assert.match(result.stdout, /attempt=2/);
});

test('runner exits cleanly as already_running without issuing HTTP traffic', () => {
  const result = runRunner('success', { lockBusy: true });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.attempts, 0);
  assert.match(result.stdout, /outcome=already_running/);
});
