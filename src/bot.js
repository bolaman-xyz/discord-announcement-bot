const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const { buildAnnouncementComponents, LANG_BUTTONS } = require('./announcement');
const { ensureFlagEmojis, readCache, isComplete } = require('./flag-emojis');
const { loadSettings } = require('./settings');

const announcementStore = new Map();

let client = null;
let currentToken = null;
let readyPromise = null;
let flagEmojis = {};
let flagEmojiPromise = null;
let activeGuildId = null;

const FLAG_BUTTON_COUNT = 5;

function createClient() {
  return new Client({ intents: [GatewayIntentBits.Guilds] });
}

function getGuildId() {
  return loadSettings().guildId?.trim() || null;
}

async function resolveFlagEmojis(force = false) {
  if (!client?.isReady()) {
    throw new Error('Bot is not connected.');
  }

  const guildId = getGuildId();

  if (!force) {
    const cached = readCache(guildId);
    if (isComplete(cached)) {
      flagEmojis = cached;
      return cached;
    }

    if (isComplete(flagEmojis)) {
      return flagEmojis;
    }
  }

  if (!flagEmojiPromise) {
    flagEmojiPromise = ensureFlagEmojis(client, guildId)
      .then((map) => {
        flagEmojis = map;
        activeGuildId = guildId;
        console.log(`Flag emojis ready (${guildId ? `guild ${guildId}` : 'application'}).`);
        return map;
      })
      .finally(() => {
        flagEmojiPromise = null;
      });
  }

  return flagEmojiPromise;
}

function attachHandlers(discordClient) {
  discordClient.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const langButton = LANG_BUTTONS.find((entry) => entry.id === interaction.customId);
    if (!langButton) return;

    const data = announcementStore.get(interaction.message.id);
    if (!data) {
      await interaction.reply({
        content: 'Announcement data expired. Post a new announcement from the dashboard.',
        ephemeral: true,
      });
      return;
    }

    try {
      const emojis = await resolveFlagEmojis();
      const payload = buildAnnouncementComponents(data, langButton.lang, emojis);
      await interaction.update(payload);
    } catch (error) {
      console.error(error);
      const reply = { content: 'Failed to update language.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  });
}

async function connectBot(token) {
  if (!token) {
    throw new Error('Bot token is required.');
  }

  const guildId = getGuildId();

  if (client?.isReady() && token === currentToken && guildId === activeGuildId) {
    await resolveFlagEmojis();
    return client;
  }

  if (client) {
    await client.destroy();
    client = null;
    currentToken = null;
    readyPromise = null;
    flagEmojis = {};
    flagEmojiPromise = null;
    activeGuildId = null;
  }

  client = createClient();
  attachHandlers(client);
  currentToken = token;

  readyPromise = new Promise((resolve, reject) => {
    const onReady = async () => {
      try {
        await resolveFlagEmojis(true);
      } catch (error) {
        console.error('Flag emoji setup failed on connect:', error.message);
      }
      cleanup();
      resolve(client);
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      client.off('clientReady', onReady);
      client.off('error', onError);
    };

    client.once('clientReady', onReady);
    client.once('error', onError);
  });

  await client.login(token);
  return readyPromise;
}

async function getBotStatus() {
  if (!client?.isReady()) {
    return { online: false, username: null, avatar: null, flagsReady: false };
  }

  const guildId = getGuildId();
  const cached = readCache(guildId);
  const ready = isComplete(cached) || isComplete(flagEmojis);

  return {
    online: true,
    username: client.user.tag,
    avatar: client.user.displayAvatarURL({ size: 128 }),
    flagsReady: ready,
  };
}

async function listGuildChannels(guildId) {
  if (!client?.isReady()) {
    throw new Error('Bot is not connected. Save your token first.');
  }

  const guild = await client.guilds.fetch(guildId);
  const channels = await guild.channels.fetch();

  return [...channels.values()]
    .filter((channel) => channel?.type === ChannelType.GuildText)
    .map((channel) => ({ id: channel.id, name: channel.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function sendAnnouncement(channelId, data) {
  if (!client?.isReady()) {
    throw new Error('Bot is not connected. Save your token in Settings.');
  }

  const emojis = await resolveFlagEmojis(true);
  if (!isComplete(emojis)) {
    throw new Error('Flag buttons are not ready. Check the bot has Manage Emojis permission, then restart.');
  }

  console.log('Sending announcement with flag emoji IDs:', Object.values(emojis).map((e) => e.id).join(', '));

  const channel = await client.channels.fetch(channelId);
  if (!channel?.isTextBased()) {
    throw new Error('That channel is not a text channel.');
  }

  const payload = buildAnnouncementComponents(data, 'en', emojis);
  const message = await channel.send(payload);
  announcementStore.set(message.id, data);

  return {
    messageId: message.id,
    channelId: channel.id,
    channelName: channel.name,
  };
}

module.exports = {
  connectBot,
  getBotStatus,
  listGuildChannels,
  sendAnnouncement,
};
