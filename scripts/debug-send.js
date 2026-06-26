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
    client.once('clientReady', resolve);
    client.login(settings.botToken).catch(reject);
  });

  const flagEmojis = await ensureFlagEmojis(client);
  console.log('Flag map:', JSON.stringify(flagEmojis, null, 2));

  const guild = await client.guilds.fetch(settings.guildId);
  const channels = await guild.channels.fetch();
  const channel = [...channels.values()].find((c) => c?.isTextBased?.());

  const payload = buildAnnouncementComponents(
    { ...settings.defaults, pingEveryone: false },
    'en',
    flagEmojis,
  );

  console.log('Payload flags:', payload.flags);
  console.log('Button row:', JSON.stringify(payload.components.at(-1).toJSON(), null, 2));

  const message = await channel.send(payload);
  console.log('Sent:', message.url);

  const fetched = await channel.messages.fetch(message.id);
  const row = fetched.components.at(-1);
  console.log('Fetched button row:', JSON.stringify(row?.toJSON?.() ?? row, null, 2));

  for (const [index, btn] of row.components.entries()) {
    console.log(`Button ${index}:`, {
      customId: btn.customId,
      emoji: btn.data?.emoji ?? btn.emoji,
      label: btn.label,
    });
  }

  await client.destroy();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
