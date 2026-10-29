import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const configs = {
  auth: 'workspace',
  clan_membership: 'workspace',
  genealogy: 'workspace',
  memorial_calendar: 'workspace',
  clan_joining: 'workspace',
  invitations: 'workspace',
  offline_backup: 'offline',
  ui_quality: 'demo',
};
const feature = process.argv[2];
const options = process.argv.slice(3);
const headed = options.includes('--headed') || process.env.npm_config_headed === 'true';
const list = options.includes('--list') || process.env.npm_config_list === 'true';
if (
  !feature ||
  !Object.hasOwn(configs, feature) ||
  options.some((option) => !['--headed', '--list'].includes(option))
) {
  console.log('Usage: npm run test:feature -- <feature> [--headed] [--list]');
  console.log('Features: ' + Object.keys(configs).join(', '));
  process.exit(feature ? 1 : 0);
}
const mode = configs[feature];
const config = 'automation_test/playwright' + (mode === 'demo' ? '' : '.' + mode) + '.config.ts';
const args = [
  'node_modules/@playwright/test/cli.js',
  'test',
  '--config',
  config,
  'automation_test/features/' + feature + '/tests',
];
if (headed) args.push('--headed', '--project', 'desktop', '--workers', '1');
if (list) args.push('--list');
const child =
  mode === 'demo' || list
    ? spawn(process.execPath, args, { cwd: root, stdio: 'inherit' })
    : spawn(
        process.execPath,
        [
          'scripts/firebase.mjs',
          'emulators:exec',
          '--only',
          'auth,firestore',
          'node ' + args.join(' '),
        ],
        { cwd: root, stdio: 'inherit' },
      );
child.on('error', (e) => {
  console.error(e.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
