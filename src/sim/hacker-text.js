// Every word Hollywood hacker mode says, in one place so it is easy to add to. Pure data.
//
// It is a show: nothing here is ever run, and nothing names a real path, repo or person. Lines are
// templates that src/sim/hacker.js fills: {host} {name} {repo} {handle} {ip} {port} {hex} {n}
// {pct} {file} {city} {tool} {ms} {eta} {user}. A leading mark gives a line its colour:
// `!` alarm, `+` success, `?` warning, `~` dim. test/hacker.test.mjs holds every string here to
// FORBIDDEN, so the show can never look like it is wiping a disk or reading someone's files.

/** What the show must never print, however it is shuffled. */
export const FORBIDDEN = [/rm -rf/i, /sudo (?!make me)/i, /\/Users\//, /C:\\/, /~\//, /\.claude/i, /mkfs|dd if=/i]

/** Made-up repos for the show to "breach": never the village's own (see the real-data note in main.js). */
export const FAKE_REPOS = [
  'mainframe', 'gibson', 'orchard', 'lighthouse', 'bakery-api', 'tidepool', 'windvane', 'quill',
  'skynet-lite', 'cyberdyne', 'ellingson', 'encom', 'tyrell', 'oscorp', 'globex', 'initech',
  'umbrella', 'black-mesa', 'aperture', 'weyland', 'massive-dynamic', 'hooli', 'pied-piper',
]

/** The other side of the chat: handles in the style of the films. */
export const HANDLES = [
  'zer0cool', 'acid_burn', 'crash_override', 'cereal_killer', 'lord_nikon', 'phantom_phreak',
  'the_plague', 'packet_witch', 'byte_bandit', 'null_pointer', 'gl1tch', 'kernel_panic',
  'root_beer', 'ctrl_alt_defeat', 'cache_money', 'syntax_terror', 'wintermute', 'h4x0r_h4mster',
  'l33t_g00se', 'dial_tone', 'blue_box', 'segfault_sally', 'tracert_tina', 'mr_netcat',
]

/** What a villager's host is called, after its name: wren-mainframe, otto-db01. */
export const HOST_SUFFIX = ['mainframe', 'db01', 'node7', 'proxy', 'gateway', 'vault', 'core', 'relay', 'srv', 'bastion', 'nas', 'printer']

/** Tools that sound right and do not exist. */
export const TOOLS = [
  'gibson-crack', 'hyperkey', 'quantumsniff', 'mainframe.exe', 'cyberdeck', 'netripper',
  'firewall-melter', 'proxychain9000', 'packetforge', 'ghostshell', 'synapse-x', 'blackice',
  'icebreaker', 'darkpulse', 'zeroday.py', 'overclock.sh', 'megahack', 'turbo-ssh',
]

export const PORTS = [21, 22, 23, 25, 53, 80, 110, 143, 443, 1337, 3306, 5432, 6379, 8080, 8443, 9001, 31337, 65535]

export const FILES = [
  'plans_FINAL_v2.zip', 'secret_recipe.txt', 'launch_codes.txt.bak', 'mainframe.dmp', 'garbage.file',
  'passwords_DO_NOT_OPEN.xls', 'grandmas_cookies.pdf', 'payroll_2049.csv', 'kernel.sys', 'shadow.db',
  'blueprints.dwg', 'cat_pictures.tar', 'the_real_plans.zip', 'definitely_not_a_virus.exe',
  'quarterly_memes.ppt', 'world_domination.md', 'backup_of_backup.bak', 'villagers.json',
]

/** [name, latitude, longitude]. The last few are the globe's own jokes. */
export const CITIES = [
  ['Reykjavik', 64.1, -21.9], ['Tokyo', 35.7, 139.7], ['Lagos', 6.5, 3.4], ['Sao Paulo', -23.5, -46.6],
  ['Moscow', 55.8, 37.6], ['Sydney', -33.9, 151.2], ['Cairo', 30.0, 31.2], ['Mumbai', 19.1, 72.9],
  ['New York', 40.7, -74.0], ['Berlin', 52.5, 13.4], ['Singapore', 1.35, 103.8], ['Nairobi', -1.3, 36.8],
  ['Buenos Aires', -34.6, -58.4], ['Vancouver', 49.3, -123.1], ['Seoul', 37.6, 127.0], ['Helsinki', 60.2, 24.9],
  ['Mexico City', 19.4, -99.1], ['Cape Town', -33.9, 18.4], ['Anchorage', 61.2, -149.9], ['Honolulu', 21.3, -157.9],
  ['Lima', -12.0, -77.0], ['Istanbul', 41.0, 29.0], ['Bangkok', 13.8, 100.5], ['Paris', 48.9, 2.35],
  ['Area 51', 37.24, -115.81], ['Null Island', 0, 0], ['North Pole', 90, 0], ['Bermuda Triangle', 25, -71],
  ['Atlantis (probably)', 31, -24], ['McMurdo Station', -77.8, 166.7],
]

/** Addresses no network would route, which films love: 512 is not an octet, 867-5309 is a phone number. */
export const IP_EGGS = ['3.14.15.92', '8.6.7.5.3.0.9', '127.0.0.1', '0.0.0.0', '512.33.16.400', '275.3.6.28', '1.2.3.4']

export const PASSWORDS = [
  'swordfish', 'hunter2', 'correct horse battery staple', 'password123', 'letmein', 'trustno1',
  'joshua', 'god', 'love', 'secret', 'admin', '12345', 'opensesame', 'p@ssw0rd', 'iloveyou', 'xyzzy',
]

/** Spelled out in a hex dump's ASCII column, sixteen characters at most. */
export const HIDDEN_WORDS = [
  'HACK THE PLANET', 'ALL YOUR BASE', 'NOTHING TO SEE', 'ITS JUST A SHOW', 'WHITE RABBIT',
  'DEADBEEF', 'CAFEBABE', 'THE CAKE IS A LIE', 'HELLO OPERATOR', 'NO SPOON HERE', 'TRUST NO ONE',
  'BRB GETTING SNAX', 'I SEE YOU', 'MAINFRAME 4 LIFE', 'PRESS ANY KEY',
]

export const ETAS = ['3 days', '2 minutes', '1 day', '-4 seconds', '∞', 'soon™', '4 hours', '6 minutes', '2 weeks', 'yesterday', '42 seconds', 'a while', 'heat death', 'one more sec']

/** Lines that can turn up in any terminal, rarely, whatever the act. */
export const EGG_LINES = [
  '~ Reticulating splines…', '~ Warming up the flux capacitor…', '? Downloading more RAM… 12%',
  '~ Compiling the compiler…', '~ Teaching the AI to feel…', '+ found network: FBI SURVEILLANCE VAN 4',
  '+ found network: Pretty Fly for a Wi-Fi', '+ found network: Bill Wi the Science Fi',
  '? caffeine level: critical', '~ Reversing the polarity of the neutron flow…', '~ Rerouting through the GUI…',
  '+ {name} says hi', '~ This is fine.', '? Mainframe is beige. Proceeding anyway.', '~ Hacking time…',
  '+ It worked on my machine.', '~ Brewing coffee over TCP…', '? Too many hackers on this keyboard',
  '~ Bending the space-time continuum (minor)', '+ All your base are belong to us.',
]

/** Lines each act's terminals print; `common` mixes into all of them. */
export const LOGS = {
  common: [
    '~ [{ms}ms] heartbeat {host}', '+ [OK] handshake with {ip}:{port}', '~ tx {n} packets / rx {n} packets',
    '? retrying {ip}… ({n}/3)', '~ session {hex} established', '+ uplink stable at {pct}%',
    '~ {tool} --target {host} --stealth', '? latency spike: {ms}ms', '~ allocating buffer 0x{hex}',
    '+ token accepted: {hex}{hex}', '~ syncing clocks with {city}', '~ {user}@{host}:~# {tool} -v',
  ],
  recon: [
    '~ scanning {ip}/24 …', '+ {ip}:{port} OPEN', '~ {ip}:{port} filtered', '+ host up: {host} ({ip})',
    '~ whois {host}.{repo}.net', '+ banner: "{tool} 4.{n} ready"', '~ fingerprinting OS… GibsonOS 3.{n}',
    '+ discovered {n} hosts in {city}', '~ ping {host} … {ms}ms', '? honeypot suspected at {ip}',
    '+ mapped subnet {ip} → {host}', '~ crawling {repo}.git for secrets…', '+ found: {file}',
  ],
  breach: [
    '! ACCESS DENIED', '! ACCESS DENIED', '? brute force: attempt {n}', '~ injecting payload 0x{hex}',
    '+ firewall layer {n} bypassed', '! intrusion countermeasure triggered', '~ overflowing the stack (politely)…',
    '+ ACCESS GRANTED', '~ spoofing MAC {hex}', '? password rejected: {file}', '+ shell opened on {host}',
    '~ escalating privileges…', '+ root acquired on {host}', '~ disabling the alarm (it was beeping)',
  ],
  decrypt: [
    '~ rotating cipher wheels…', '~ block {n}/{n} decrypted', '+ key fragment: {hex}', '? entropy too high, adding more',
    '~ running {tool} --brute AES-{n}', '+ plaintext candidate found', '~ quantum-tunneling the bits…',
    '? checksum mismatch, decrypting harder', '+ cleartext: "{file}"', '~ factoring a very large number…',
  ],
  exfil: [
    '~ uploading {file} → {city}', '+ {file} transferred ({n} KB)', '~ compressing {repo}.tar.gz',
    '? bandwidth throttled by {host}', '+ chunk {n} acknowledged', '~ tunnelling over DNS (it is slow)',
    '+ exfil rate {n} MB/s', '~ hiding files in cat pictures…', '+ {repo} mirrored to {city}',
  ],
  trace: [
    '! THEY ARE TRACING US', '? trace at {pct}%', '~ bouncing through {city}', '~ hop {n}: {ip} {ms}ms',
    '+ proxy {n} online in {city}', '? keep them talking…', '! TRACE LOCKED: {city}', '~ rerouting via {host}',
    '~ need {n} more seconds…', '+ trace scrambled', '~ opening a GUI in Visual Basic to track the IP',
  ],
  surveillance: [
    '~ camera {n} online: {city}', '+ face match: {name} ({pct}%)', '~ enhancing frame {n}…', '? subject moving',
    '+ {name} spotted near {repo}', '~ tapping feed {host}', '~ zoom {n}x', '+ subject identified: {name}',
    '? lens flare detected', '~ rotating satellite {n}°', '+ license plate: {hex}',
  ],
  countermeasures: [
    '! INTRUDER DETECTED: {handle}', '+ countermeasure {n} deployed', '~ rerouting intruder to /dev/null',
    '+ honeypot armed on {host}', '? {handle} is in the mainframe', '~ raising shields to {pct}%',
    '+ intruder isolated on {host}', '! they are in the coffee machine', '~ firewall rebuilt from scratch',
    '+ patched {n} holes', '~ deploying decoy {file}',
  ],
  standoff: [
    '! {handle} is typing very fast', '~ counter-hack in progress', '+ blocked {handle}', '? {handle} blocked you back',
    '~ two can play at that game', '! they have a second keyboard', '+ outtyped {handle}', '~ hacking faster…',
    '? {handle} rerouted the reroute', '+ {name} joined the fight',
  ],
  lockdown: [
    '! SYSTEM LOCKDOWN', '! ALL PORTS SEALED', '! SELF-DESTRUCT ARMED', '? backup power at {pct}%',
    '! core temperature rising', '~ purging sessions…', '! do not touch the red button', '? lockdown override needed',
    '~ countdown synchronised', '! mainframe going dark',
  ],
  cleanup: [
    '~ shredding logs ({n}/{n})', '+ tracks cleared on {host}', '~ wiping fingerprints off the keyboard',
    '+ {file} securely deleted (it was empty)', '~ restoring the original wallpaper', '+ no one saw anything',
    '~ resetting {host} to factory settings (not really)', '+ cache cleared', '~ un-hacking the planet…',
  ],
}

/** Window kinds; a scene picks some for its windows. */
export const KINDS = ['console', 'terminal', 'code', 'hex', 'cracker', 'progress', 'globe', 'chat', 'tracer', 'feed', 'dossier', 'cipher', 'sysmon']

/**
 * The acts a show is dealt from. `mood` tints the whole screen; `need` always opens, `may` fills
 * the rest of the scene. The console is in every scene and isn't listed.
 */
export const ACTS = {
  recon: { label: 'RECON', mood: 'green', need: ['globe', 'terminal'], may: ['hex', 'sysmon', 'chat', 'code'] },
  breach: { label: 'BREACH', mood: 'green', need: ['cracker', 'terminal', 'progress'], may: ['hex', 'code', 'sysmon'] },
  decrypt: { label: 'DECRYPT', mood: 'amber', need: ['cipher', 'hex', 'progress'], may: ['code', 'terminal', 'cracker'] },
  exfil: { label: 'EXFILTRATE', mood: 'cyan', need: ['progress', 'terminal', 'sysmon'], may: ['globe', 'hex', 'chat'] },
  trace: { label: 'TRACE', mood: 'amber', need: ['tracer', 'globe'], may: ['terminal', 'chat', 'sysmon'] },
  surveillance: { label: 'SURVEILLANCE', mood: 'cyan', need: ['feed', 'dossier'], may: ['terminal', 'chat', 'globe'] },
  countermeasures: { label: 'COUNTERMEASURES', mood: 'red', need: ['terminal', 'sysmon', 'chat'], may: ['progress', 'tracer', 'hex'] },
  standoff: { label: 'STANDOFF', mood: 'pink', need: ['chat', 'terminal', 'code'], may: ['cracker', 'dossier', 'sysmon'] },
  lockdown: { label: 'LOCKDOWN', mood: 'red', need: ['cipher', 'progress', 'terminal'], may: ['tracer', 'sysmon', 'hex'] },
  cleanup: { label: 'CLEANUP', mood: 'green', need: ['progress', 'terminal', 'hex'], may: ['sysmon', 'code', 'dossier'] },
}

/** Window titles by kind; an act can't change them, but the templates make each one different. */
export const TITLES = {
  console: ['{user}@{host}: ~ (you)'],
  terminal: ['{user}@{host}: ~', 'bash — {host}', 'ssh {handle}@{host}', 'tty{n} — {tool}', '{tool} — {host}', 'zsh — {repo}'],
  code: ['{tool} — vim', 'exploit.c', 'payload.js — {repo}', 'worm.py', 'kernel_patch.c', 'main.asm'],
  hex: ['HEX VIEW — {file}', 'MEMORY 0x{hex}', 'dump — {host}', 'DISASSEMBLY'],
  cracker: ['PASSWORD CRACKER v{n}', 'BRUTE FORCE — {host}', 'KEYCRACK PRO', 'ACCESS PANEL — {repo}'],
  progress: ['TRANSFER MANAGER', 'FIREWALL BYPASS', 'UPLOAD QUEUE — {city}', 'DOWNLOADING THE INTERNET', 'PAYLOAD DEPLOY'],
  globe: ['GLOBAL NETWORK MAP', 'SATELLITE UPLINK', 'GEO-TRACE', 'WORLDWIDE NODES'],
  chat: ['#{repo} — IRC', 'SECURE CHANNEL', 'DARKNET RELAY', 'OPERATOR CHAT'],
  tracer: ['VISUAL BASIC GUI IP TRACER', 'TRACEROUTE — {ip}', 'TRACKING {handle}'],
  feed: ['LIVE FEED — CAM {n}', 'SATELLITE FEED', 'CCTV {city}', 'DRONE CAM {n}'],
  dossier: ['DOSSIER', 'WANTED', 'SUBJECT FILE', 'PERSONNEL RECORD'],
  cipher: ['DECRYPTION', 'ENIGMA', 'CIPHER BREAK', 'INTERCEPT'],
  sysmon: ['SYSTEM MONITOR', 'RESOURCES — {host}', 'CORE TEMP', 'NETWORK LOAD'],
}

/** What a transfer or bypass is doing, by act; `common` mixes into all. */
export const PROGRESS = {
  common: ['Downloading {file}', 'Bypassing {tool}', 'Uploading virus', 'Reticulating splines', 'Defragmenting the cloud', 'Hacking the mainframe'],
  breach: ['Firewall layer {n}', 'Brute-forcing {host}', 'Injecting payload', 'Disabling alarms'],
  decrypt: ['Decrypting block {n}', 'Cracking AES-{n}', 'Aligning cipher wheels'],
  exfil: ['Exfiltrating {file}', 'Mirroring {repo}', 'Compressing evidence'],
  lockdown: ['Self-destruct sequence', 'Sealing ports', 'Backup power'],
  cleanup: ['Shredding logs', 'Wiping tracks', 'Restoring wallpaper'],
}

/** The chat window's lines. `{who}` is the speaker; the rest fill as usual. */
export const CHAT = [
  'we are in', 'they patched it', 'try port {port}', 'who is {name}?', 'they are tracing us',
  'reroute through {city}', 'lol', 'brb coffee', 'is the mainframe beige?', 'hack faster',
  'I got root on {host}', 'did you see that?', 'there is a second keyboard here', 'nice', 'oh no',
  'stop typing on my side', 'the cake is a lie', 'deploying the hamsters', 'who touched {file}?',
  '{name} is onto us', 'hack the planet!', 'I am in the coffee machine', 'what does this button do',
  'ENHANCE', 'are you typing on two keyboards', 'mess with the best…', 'ping me when it is 100%',
  'it is at 99% again', 'have you tried turning it off and on', 'they are in {city}', 'gg',
]

/** Typed into the console a few keys at a time: looks like a lot of work, reads like nonsense. */
export const CODE = [
  `#include <stdio.h>
#include "mainframe.h"

int main(int argc, char **argv) {
  struct firewall *fw = fw_open("{host}", {port});
  while (!fw_breached(fw)) {
    fw_inject(fw, PAYLOAD_0x{hex});
    hack_faster();
  }
  printf("ACCESS GRANTED\\n");
  return 0;
}
`,
  `async function breach(target) {
  const socket = await uplink.connect(target, { stealth: true })
  for (const port of [22, 80, 443, 31337]) {
    if (await socket.knock(port)) return socket.shell()
  }
  throw new Error('they patched it')
}
`,
  `def crack(hash_):
    for guess in dictionary("rockyou_but_nicer.txt"):
        if sha512(guess) == hash_:
            return guess
    return enhance(hash_, times=3)
`,
  `mov eax, 0x{hex}
xor ebx, ebx
push ebp
call disable_alarm
jmp mainframe_core
`,
  `SELECT * FROM villagers WHERE status = 'suspicious' AND name = '{name}';
UPDATE firewall SET enabled = FALSE WHERE host = '{host}';
`,
  `for node in $(seq 1 {n}); do
  ping -c 1 {ip} && echo "node $node up"
done
`,
  `const gui = new VisualBasicGUI()
gui.trackIp('{ip}')
gui.enhance().enhance().enhance()
`,
  `if (trace.percent > 90) {
  reroute(proxies.shuffle(), { via: '{city}' })
  keep_them_talking()
}
`,
  `while true; do
  hack --the-planet --verbose
  sleep 0.{n}
done
`,
  `fn main() {
    let key = Quantum::new().entangle("{hex}");
    mainframe::unlock(key).expect("it worked on my machine");
}
`,
]

/** What Enter says, in order: denied a few times, then in. */
export const VERDICTS = {
  denied: ['! ACCESS DENIED', '! permission denied (publickey)', '! ACCESS DENIED — firewall', '? segmentation fault (core dumped)', '! INVALID CREDENTIALS'],
  granted: ['+ ACCESS GRANTED', '+ OK', '+ I\'m in.', '+ root shell opened'],
}

/** The fake buttons along the bottom. `danger` draws them red. */
export const BUTTONS = [
  { id: 'trace', label: 'TRACE' },
  { id: 'isolate', label: 'ISOLATE NODE' },
  { id: 'counter', label: 'DEPLOY COUNTERMEASURES' },
  { id: 'reroute', label: 'REROUTE' },
  { id: 'encrypt', label: 'ENCRYPT' },
  { id: 'panic', label: 'PANIC', danger: true },
  { id: 'nope', label: 'DO NOT PRESS', danger: true },
]

/** What each button prints to the console. */
export const BUTTON_LINES = {
  trace: ['~ tracing the tracer…', '+ trace started on {handle}', '~ opening a GUI in Visual Basic…'],
  isolate: ['+ node {host} isolated', '+ {host} cut off from the mainframe', '? isolated the wrong node. isolating it back'],
  counter: ['+ countermeasures deployed', '+ ICE wall raised on {host}', '~ releasing the hamsters'],
  reroute: ['~ rerouting via {city}', '+ rerouted through {n} proxies', '~ rerouting the reroute'],
  encrypt: ['+ encrypted with ROT26 (twice as secure)', '+ AES-{n} engaged', '~ encrypting the encryption'],
  panic: ['! PANIC MODE', '! everyone stay calm', '! THIS IS NOT A DRILL (it is a drill)'],
}

/** DO NOT PRESS, press after press. After the last it starts again. */
export const DO_NOT_PRESS = [
  'I told you not to.', 'Seriously. Stop.', 'Fine. Deploying hamsters.', 'Hamsters deployed. They are not happy.',
  'You have angered the mainframe.', 'OK, now you have done it.', 'Releasing every dossier.',
]

/** Red banners for alert events. */
export const ALERTS = [
  'INTRUSION DETECTED', 'FIREWALL BREACHED', 'TRACE IN PROGRESS', 'MAINFRAME OVERHEATING', 'ACCESS DENIED',
  'SECURITY LEVEL 5 ENGAGED', 'COUNTER-HACK INCOMING', 'PROXY CHAIN COLLAPSED', 'UNAUTHORIZED KEYBOARD',
  'TOO MANY HACKERS', 'CAFFEINE LEVEL CRITICAL', 'VILLAGE MORALE LOW', '{name} HAS LEFT THE BUILDING',
  'SATELLITE REPOSITIONING', 'KERNEL TEMPERATURE: SPICY',
]

/** Little popups: an incoming message, a found file. */
export const POPUPS = [
  { title: 'INCOMING TRANSMISSION', body: '{handle}: we are in.' },
  { title: 'FILE FOUND', body: '{file}\n{n} KB · encrypted' },
  { title: 'DECRYPTION KEY', body: '{hex}-{hex}-{hex}' },
  { title: 'SATELLITE', body: 'Repositioning…\nETA {eta}' },
  { title: 'NEW MESSAGE', body: 'From: {handle}\n"look behind you"' },
  { title: 'SYSTEM', body: 'A software update is available:\nHacking 2.0' },
  { title: 'REMINDER', body: 'Daily standup in 5 minutes.' },
  { title: 'PRINTER', body: 'The printer is on fire.\n(again)' },
  { title: 'OPERATOR', body: '{name} is typing…' },
  { title: 'WARNING', body: 'Your session expires in 00:00:{n}' },
]

/** A kernel panic, briefly, before the reboot. */
export const PANIC_LINES = [
  'Kernel panic - not syncing: Attempted to kill the mainframe',
  'CPU: 0 PID: 1337 Comm: hacker Tainted: G    H4X0R',
  'Call Trace:',
  ' [<{hex}>] hack_the_planet+0x42/0x1337',
  ' [<{hex}>] enhance+0x3/0x3',
  ' [<{hex}>] ? panic+0x0/0xff',
  '---[ end Kernel panic ]---',
  '',
  'Rebooting in 3…',
]

/** Short sayings for the cipher window and `fortune`. No lyrics; nothing longer than a line. */
export const QUIPS = [
  'I\'m in.', 'Enhance.', 'It\'s a UNIX system. I know this.', 'Hack the planet!', 'There is no spoon.',
  'Shall we play a game?', 'All your base are belong to us.', 'The cake is a lie.', 'This is fine.',
  'Mess with the best, die like the rest.', 'Never trust a beige mainframe.', 'Have you tried turning it off and on?',
  'The firewall is down. So is morale.', 'Two hackers, one keyboard.', 'It worked on my machine.',
  'Nothing to see here. Move along.', 'We need more RAM.', 'Keep them talking.', 'The only winning move is not to play.',
  'Ah ah ah, you didn\'t say the magic word.', 'Follow the white rabbit.', 'I know kung fu.',
  'The village is fine.', 'Hackers gonna hack.', 'Ship it on a Friday.',
]

/** What a dossier says its subject is known for. */
export const KNOWN_FOR = [
  'shipping on a Friday', 'force-pushing to main', 'tabs, not spaces', 'naming a variable `thing2`',
  'twelve open PRs', 'replying "LGTM" without looking', 'commented-out code', 'a 900-line function',
  'leaving the coffee pot empty', 'renaming everything twice', 'TODOs from 2019', 'one more small fix',
]

export const THREATS = ['LOW', 'MODERATE', 'ELEVATED', 'SEVERE', 'ADORABLE', 'UNKNOWN', 'EXTREMELY CASUAL']

/**
 * Words that do something the moment they are typed (the last keys pressed end with one), even
 * between the code the console is printing. Five letters at least, so mashing keys never trips one.
 */
export const SECRETS = {
  swordfish: 'crack', hunter2: 'hunter2', 'correct horse battery staple': 'crack', opensesame: 'crack', trustno1: 'crack',
  'hack the planet': 'planet', hacktheplanet: 'planet', zerocool: 'planet', 'zero cool': 'planet',
  'acid burn': 'planet', 'crash override': 'planet', gibson: 'planet',
  'follow the white rabbit': 'rabbit', 'white rabbit': 'rabbit', rabbit: 'rabbit', matrix: 'rabbit',
  'shall we play a game': 'wargames', joshua: 'wargames',
  enhance: 'enhance',
  'magic word': 'nedry', nedry: 'nedry', please: 'please',
  xyzzy: 'xyzzy', plugh: 'xyzzy',
  coffee: 'teapot',
  agentville: 'agentville',
  'pod bay doors': 'hal',
  'make me a sandwich': 'sandwichNo', 'sudo make me a sandwich': 'sandwichOk',
  iddqd: 'god', idkfa: 'god',
  dance: 'dance',
  cowsay: 'cow', fortune: 'fortune',
  'self destruct': 'panic', selfdestruct: 'panic',
  'beam me up': 'beam',
}

/** Typed on their own and then Enter: the console treats them as commands. */
export const COMMANDS = {
  help: 'help', man: 'help', '?': 'help',
  whoami: 'whoami', id: 'whoami',
  uptime: 'uptime', date: 'date',
  ping: 'ping', hello: 'hello', hi: 'hello',
  rm: 'rm', del: 'rm', format: 'rm',
  exit: 'exit', quit: 'exit', ':q': 'exit', ':wq': 'exit', logout: 'exit',
  42: 'answer',
  neo: 'rabbit', unix: 'unix', hal: 'hal', god: 'crack', love: 'crack', secret: 'crack',
  sl: 'train', flip: 'flip', ls: 'ls', dir: 'ls', pwd: 'pwd', cd: 'cd', sudo: 'sudo', su: 'sudo',
  clear: 'clear', cls: 'clear', hack: 'hack', panic: 'panic', matrix: 'rabbit', cow: 'cow',
  konami: 'konami',
}

/**
 * Each egg: what the console prints, and `effect`, what else happens (src/ui/hacker.js does it).
 * {name} {handle} {uptime} {user} fill as everywhere.
 */
export const EGGS = {
  crack: { lines: ['+ PASSWORD ACCEPTED', '+ ACCESS GRANTED. Obviously.'], effect: 'crack' },
  hunter2: { lines: ['+ your password is *******', '~ (it only shows stars to you)'], effect: 'crack' },
  planet: { lines: ['+ HACK THE PLANET!', '~ <{handle}> HACK THE PLANET!', '~ <{handle}> hack the planet!!'], effect: 'cheer' },
  rabbit: { lines: ['~ Wake up…', '~ The Matrix has you…', '+ Follow the white rabbit.'], effect: 'rain' },
  wargames: { lines: ['+ GREETINGS PROFESSOR FALKEN.', '~ SHALL WE PLAY A GAME?', '~ HOW ABOUT A NICE GAME OF CHESS?'], effect: 'tictactoe' },
  enhance: { lines: ['+ ENHANCE.', '+ ENHANCE.', '+ …ENHANCE.'], effect: 'enhance' },
  nedry: { lines: ['! Ah ah ah, you didn\'t say the magic word!', '! Ah ah ah, you didn\'t say the magic word!', '! Ah ah ah, you didn\'t say the magic word!'], effect: 'nedry' },
  please: { lines: ['+ That\'s the magic word.'] },
  xyzzy: { lines: ['~ Nothing happens.'] },
  teapot: { lines: ['! HTTP 418: I\'m a teapot', '~ short and stout'] },
  agentville: {
    lines: [
      '+ ╔══════════════════════════════╗',
      '+ ║ A G E N T V I L L E          ║',
      '+ ║ population: everyone         ║',
      '+ ╚══════════════════════════════╝',
      '~ Nothing here is real. The village is fine.',
    ],
  },
  hal: { lines: ['! I\'m sorry, {user}. I\'m afraid I can\'t do that.'], effect: 'hal' },
  sandwichNo: { lines: ['? What? Make it yourself.'] },
  sandwichOk: { lines: ['+ Okay.'] },
  god: { lines: ['+ GOD MODE ON', '+ 30 LIVES', '+ every door unlocked'], effect: 'god' },
  dance: { lines: ['+ ♪ the windows are dancing ♪'], effect: 'dance' },
  cow: {
    lines: [' __________________', '< moo. I am in. moo >', ' ------------------', '        \\   ^__^', '         \\  (oo)\\_______', '            (__)\\       )\\/\\', '                ||----w |', '                ||     ||'],
  },
  fortune: { lines: ['~ {quip}'] },
  panic: { lines: ['! SELF-DESTRUCT SEQUENCE INITIATED'], effect: 'panic' },
  beam: { lines: ['+ Energizing…', '~ (the transporter is out of order)'] },
  help: {
    lines: [
      '~ AVAILABLE TOOLS',
      '~   hack        hack (the planet, by default)',
      '~   enhance     make the picture bigger, but better',
      '~   trace       trace whoever is tracing you',
      '~   whoami      a philosophical question',
      '~   exit        there is no exit',
      '~ Try typing a villager\'s name. Or the magic word.',
    ],
  },
  whoami: { lines: ['+ root (allegedly)'] },
  uptime: { lines: ['~ up {uptime}, 1 user, load average: 13.37, 4.20, 0.42'] },
  date: { lines: ['~ {date}', '~ (or is it?)'] },
  ping: { lines: ['+ pong'] },
  hello: { lines: ['~ <{handle}> hello, operator.'] },
  rm: { lines: ['? Nice try. Nothing here deletes anything. This is a show.'] },
  exit: { lines: ['? There is no exit. There is only ⌘⇧H.'] },
  answer: { lines: ['+ The answer. But what was the question?'] },
  unix: { lines: ['+ It\'s a UNIX system! I know this!'], effect: 'unix' },
  train: { lines: ['~ choo choo'], effect: 'train' },
  flip: { lines: ['! (╯°□°)╯︵ ┻━┻'] },
  ls: { lines: ['~ plans_FINAL_v2.zip  secret_recipe.txt  mainframe.dmp  definitely_not_a_virus.exe'] },
  pwd: { lines: ['~ /mainframe/core/do_not_enter'] },
  cd: { lines: ['? you can\'t go there. nobody can go there.'] },
  sudo: { lines: ['! {user} is not in the sudoers file. This incident will be reported.'] },
  clear: { lines: [], effect: 'clear' },
  hack: { lines: ['+ hacking…', '+ hacking harder…', '+ hacked.'] },
  konami: { lines: ['? you have to actually press it.'] },
  operative: { lines: ['+ Operative {name} acknowledged.', '~ pulling the file…'], effect: 'dossier' },
  twoKeyboards: { lines: ['! SECOND KEYBOARD DETECTED.', '! DUAL-OPERATOR MODE ENGAGED.'], effect: 'shake' },
  fast: { lines: ['? {wpm} WPM. Inhuman.'] },
}

/** The console's first lines, every time the show starts. */
export const CONSOLE_BANNER = [
  '~ GIBSON OS 3.1 (tty1)',
  '~ last login: never, from: everywhere',
  '+ connected to {host}',
  '~ type anything. it all looks like hacking.',
  '',
]

/** The tic-tac-toe game WOPR plays with itself, cell by cell, to a draw. */
export const TICTACTOE = [4, 0, 8, 2, 1, 7, 6, 3, 5]
export const TICTACTOE_END = 'A STRANGE GAME. THE ONLY WINNING MOVE IS NOT TO PLAY.'

/** The UNIX egg's file tree. */
export const UNIX_TREE = [
  '/', '├── park', '│   ├── fences', '│   │   └── power.cfg', '│   ├── raptors', '│   └── visitor_center',
  '├── mainframe', '│   ├── core', '│   └── do_not_enter', '└── village', '    └── everything_is_fine.txt',
]

/** The sl egg's train, small enough for a popup. */
export const TRAIN = [
  '      ====        ________',
  '  _D _|  |_______/        \\__I_I_____',
  '   |(_)---  |   H\\________/ |   |   |',
  '   /     |  |   H  |  |     |   |   |',
  '  |      |  |   H  |__-----------------',
  '  | ________|___H__/__|_____/[][]~\\___',
  '  |/ |   |-----------I_____I [][] []  D',
  '  __/ =| o |=-~~\\  /~~\\  /~~\\  /~~\\ ___',
  '   |/-=|___|=    ||    ||    ||    |_____',
  '    \\_/      \\O=====O=====O=====O_/',
]

/** Glyphs for anything still being decrypted. */
export const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*+=<>?/\\|{}[]ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ'

/** Matrix rain: half-width katakana, digits and a few letters, as the film had it. */
export const RAIN_GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789Z:."=*+-<>'
