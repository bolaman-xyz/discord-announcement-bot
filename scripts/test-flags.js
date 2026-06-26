require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client, GatewayIntentBits } = require('discord.js');
const { ensureFlagEmojis } = require('../src/flag-emojis');

async function main() {
  const settingsPath = path.join(__dirname, '..', 'data', 'settings.json');
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  const token = settings.botToken;

  if (!token) {
    console.error('No bot token in data/settings.json');
    process.exit(1);
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  await new Promise((resolve, reject) => {
    client.once('ready', resolve);
    client.once('error', reject);
    client.login(token).catch(reject);
  });

  try {
    const map = await ensureFlagEmojis(client);
    console.log('Success:', Object.keys(map).map((key) => `${key}=${map[key].id}`).join(', '));
  } catch (error) {
    console.error('Failed:', error.message);
    if (error.rawError) console.error(JSON.stringify(error.rawError, null, 2));
    if (error.stack) console.error(error.stack);
  } finally {
    await client.destroy();
  }
}

main();
