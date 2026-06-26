const fs = require('node:fs');
const path = require('node:path');
const { Client, GatewayIntentBits } = require('discord.js');
const { ensureFlagEmojis } = require('../src/flag-emojis');
const { buildAnnouncementComponents } = require('../src/announcement');

async function main() {
  const settings = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'data', 'settings.json'), 'utf8'),
  );

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await new Promise((resolve, reject) => {
    client.once('ready', resolve);
    client.once('error', reject);
    client.login(settings.botToken).catch(reject);
  });

  const flagEmojis = await ensureFlagEmojis(client);
  const channelId = process.argv[2];

  if (!channelId) {
    console.error('Usage: node scripts/send-test.js <channelId>');
    await client.destroy();
    process.exit(1);
  }

  const payload = buildAnnouncementComponents(
    {
      ...settings.defaults,
      pingEveryone: false,
    },
    'en',
    flagEmojis,
  );

  const channel = await client.channels.fetch(channelId);
  const message = await channel.send(payload);
  console.log('Sent test message:', message.url);
  await client.destroy();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
