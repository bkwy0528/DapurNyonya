// On Windows, `firebase emulators:exec` often fails to terminate the Firestore
// emulator's java child on SIGINT, leaving it holding port 8089 — the next run
// then dies with "port taken". Runs automatically via the `pretest:e2e` /
// `pretest:rules` / `pretest:integration` npm hooks; only kills processes named
// java so it can never take down an unrelated listener.
import { execSync } from 'node:child_process';

const PORTS = [8089];

if (process.platform !== 'win32') process.exit(0);

for (const port of PORTS) {
  let out = '';
  try {
    out = execSync(`netstat -ano -p tcp`, { encoding: 'utf8' });
  } catch {
    process.exit(0); // netstat unavailable — let the emulator surface any conflict itself
  }
  const pids = new Set();
  for (const line of out.split('\n')) {
    const cols = line.trim().split(/\s+/);
    // TCP <local> <remote> LISTENING <pid>
    if (cols[0] === 'TCP' && cols[3] === 'LISTENING' && cols[1]?.endsWith(`:${port}`)) {
      pids.add(cols[4]);
    }
  }
  for (const pid of pids) {
    try {
      const name = execSync(`tasklist /fi "PID eq ${pid}" /fo csv /nh`, { encoding: 'utf8' });
      if (/^"java/i.test(name.trim())) {
        execSync(`taskkill /f /pid ${pid}`, { stdio: 'ignore' });
        console.log(`freed port ${port}: killed stale emulator java (pid ${pid})`);
      } else {
        console.warn(`port ${port} is held by pid ${pid} (${name.trim().split(',')[0]}), not java — leaving it alone`);
      }
    } catch {
      // process already gone, or tasklist/taskkill unavailable — nothing to do
    }
  }
}
