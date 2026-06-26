const fs = require('node:fs');
const path = require('node:path');

const dataDir = path.join(__dirname, '..', 'data');
const settingsPath = path.join(dataDir, 'settings.json');

const defaultSettings = {
  botToken: '',
  guildId: '',
  defaultChannelId: '',
  defaults: {
    product: 'AimBetter CS2',
    status: 'UNDETECTED',
    statusUrl: 'https://example.com/status',
    changelog: '- Added Streamproof\n- Added China Hat\n- Added Crosshairs\n- Reworked ESP Preview',
    imageUrl: '',
    footer: 'OD Services Updates',
    accentColor: '#9900ff',
    pingEveryone: true,
  },
};

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function loadSettings() {
  ensureDataDir();

  const saved = fs.existsSync(settingsPath)
    ? JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    : {};

  const merged = {
    ...defaultSettings,
    ...saved,
    defaults: { ...defaultSettings.defaults, ...saved.defaults },
  };

  // Environment variables take priority — used when deployed to Railway/Render/etc.
  if (process.env.DISCORD_TOKEN) merged.botToken  = process.env.DISCORD_TOKEN;
  if (process.env.GUILD_ID)      merged.guildId   = process.env.GUILD_ID;

  return merged;
}

function saveSettings(settings) {
  ensureDataDir();
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

function maskToken(token) {
  if (!token) return '';
  if (token.length <= 10) return '••••••••';
  return `${token.slice(0, 6)}••••••••${token.slice(-4)}`;
}

module.exports = { loadSettings, saveSettings, maskToken, defaultSettings };
