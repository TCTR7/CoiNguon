import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const options = process.argv.slice(2);
if (options.some((option) => !['--headed', '--help'].includes(option))) {
  console.error('Usage: npm run test:all -- [--headed]');
  process.exit(1);
}
if (options.includes('--help')) {
  console.log('Usage: npm run test:all -- [--headed]');
  console.log('Runs unit, API, rules, build, workspace, PWA and sample UI tests in order.');
  console.log('--headed shows Edge desktop and mobile emulation, with one worker.');
  process.exit(0);
}
const npm = process.env.npm_execpath;
if (!npm) {
  console.error('Start this runner with npm run test:all.');
  process.exit(1);
}
// PowerShell's npm.ps1 may expose --headed as npm config instead of an argument.
const headed = options.includes('--headed') || process.env.npm_config_headed === 'true';
const browserOptions = headed ? ['--headed', '--workers', '1'] : [];
const env = { ...process.env };
delete env.npm_config_headed;
console.log('[All tests] Browser mode: ' + (headed ? 'headed' : 'headless'));
if (headed) console.log('[All tests] Browser windows open after Unit, API, Rules and Build PWA.');
const browser = (config) => [
  'node_modules/@playwright/test/cli.js',
  'test',
  '--config',
  'automation_test/playwright' + config + '.config.ts',
  ...browserOptions,
];
const emulated = (args) => [
  'scripts/firebase.mjs',
  'emulators:exec',
  '--only',
  'auth,firestore',
  'node ' + args.join(' '),
];
const steps = [
  ['Unit', [npm, 'run', 'test']],
  ['API', [npm, 'run', 'test:api']],
  ['Rules', [npm, 'run', 'test:rules']],
  ['Build PWA', [npm, 'run', 'build']],
  ['Workspace browser', emulated(browser('.workspace'))],
  ['PWA browser', emulated(browser('.offline'))],
  ['Sample UI browser', browser('')],
];
let child;
let interrupted = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    interrupted = true;
    process.exitCode = 1;
    child?.kill(signal);
  });
}
for (const [label, args] of steps) {
  if (interrupted) {
    process.exitCode = 1;
    break;
  }
  console.log('\n[All tests] ' + label);
  const code = await new Promise((resolve) => {
    child = spawn(process.execPath, args, { cwd: root, env, stdio: 'inherit' });
    child.on('error', (error) => {
      console.error(error.message);
      resolve(1);
    });
    child.on('close', (exitCode) => resolve(exitCode ?? 1));
  });
  child = undefined;
  if (code !== 0) {
    console.error('[All tests] Stopped at: ' + label);
    process.exitCode = code;
    break;
  }
}
if (!process.exitCode && !interrupted) console.log('\n[All tests] All suites passed.');
