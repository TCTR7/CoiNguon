const response = await fetch('http://127.0.0.1:4400/emulators');
if (!response.ok) throw new Error('Emulator hub unavailable');
const services = await response.json();
for (const name of ['auth', 'firestore', 'storage']) {
  if (!services[name]) throw new Error(name + ' emulator is not running');
}
console.log('Auth, Firestore and Storage emulators are running for the demo project.');
