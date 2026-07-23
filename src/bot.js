const fs = require('node:fs');
const path = require('node:path');
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const { buildAnnouncementComponents, LANG_BUTTONS } = require('./announcement');
const { ensureFlagEmojis, readCache, isComplete } = require('./flag-emojis');
const { loadSettings } = require('./settings');
const { translateAnnouncementData, translateGeneralData } = require('./translate');

const STORE_PATH = path.join(__dirname, '..', 'data', 'announcements.json');

function loadStore() {
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    return new Map(Object.entries(JSON.parse(raw)));
  } catch {
    return new Map();
  }
}

function saveStore(map) {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(Object.fromEntries(map)));
  } catch {}
}

const announcementStore = loadStore();

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
      await interaction.deferReply({ ephemeral: true });
      const emojis = await resolveFlagEmojis();
      let payload;
      if (data._type === 'general') {
        const translated = await translateGeneralData(data, langButton.lang);
        payload = await buildGeneralPayload(translated, emojis);
      } else {
        const translatedData = await translateAnnouncementData(data, langButton.lang);
        payload = buildAnnouncementComponents(translatedData, langButton.lang, emojis);
      }
      await interaction.editReply({ ...payload, ephemeral: true });
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
  announcementStore.set(message.id, { ...data, _type: 'build', _channelId: channel.id, _channelName: channel.name, _sentAt: Date.now() });
  saveStore(announcementStore);

  return {
    messageId: message.id,
    channelId: channel.id,
    channelName: channel.name,
  };
}

async function buildGeneralPayload(data, emojis) {
  const {
    ContainerBuilder, TextDisplayBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder,
    SeparatorBuilder, SeparatorSpacingSize, SectionBuilder, ThumbnailBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, FileBuilder, MessageFlags,
  } = require('discord.js');

  const color = parseInt((process.env.ACCENT_COLOR ?? data.accentColor ?? '#9900ff').replace('#', ''), 16);
  const container = new ContainerBuilder().setAccentColor(color);
  const belowButtons = []; // all below-container link buttons collected here

  if (data.header?.trim())
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${data.header.trim()}`));

  for (const block of (data.blocks ?? [])) {
    switch (block.type) {
      case 'banner':
        if (block.url?.trim())
          container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(block.url.trim()))
          );
        break;
      case 'text':
        if (block.content?.trim())
          container.addTextDisplayComponents(new TextDisplayBuilder().setContent(block.content.trim()));
        break;
      case 'section': {
        const sectionText = block.text?.trim();
        if (!sectionText && !block.imageUrl?.trim()) break;
        const section = new SectionBuilder()
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(sectionText || '​'));
        if (block.imageUrl?.trim())
          section.setThumbnailAccessory(new ThumbnailBuilder().setURL(block.imageUrl.trim()));
        container.addSectionComponents(section);
        break;
      }
      case 'media': {
        const urls = (block.urls ?? []).filter(u => u?.trim());
        if (urls.length) {
          const gallery = new MediaGalleryBuilder();
          urls.forEach(u => gallery.addItems(new MediaGalleryItemBuilder().setURL(u.trim())));
          container.addMediaGalleryComponents(gallery);
        }
        break;
      }
      case 'separator':
        container.addSeparatorComponents(
          new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        );
        break;
      case 'action_list': {
        const btns = (block.buttons ?? []).filter(b => b.label?.trim() && b.url?.trim());
        if (btns.length) {
          container.addActionRowComponents(new ActionRowBuilder().addComponents(
            ...btns.map(b => new ButtonBuilder().setLabel(b.label.trim()).setURL(b.url.trim()).setStyle(ButtonStyle.Link)),
          ));
        }
        break;
      }
      case 'file':
        if (block.url?.trim()) {
          const file = new FileBuilder().setURL(block.url.trim());
          if (block.name?.trim()) file.setFilename(block.name.trim());
          container.addFileComponents(file);
        }
        break;
      case 'buttons': {
        const btns = (block.buttons ?? []).filter(b => b.label?.trim() && b.url?.trim());
        btns.forEach(b => belowButtons.push(
          new ButtonBuilder().setLabel(b.label.trim()).setURL(b.url.trim()).setStyle(ButtonStyle.Link)
        ));
        break;
      }
    }
  }

  if (data.footer?.trim())
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${data.footer.trim()}`));

  if (emojis && Object.keys(emojis).length) {
    const { LANG_BUTTONS } = require('./announcement');
    const flagRow = new ActionRowBuilder().addComponents(
      ...LANG_BUTTONS.map(({ id }) => {
        const btn = new ButtonBuilder().setCustomId(id).setStyle(ButtonStyle.Secondary);
        const e = emojis[id];
        if (e?.id) btn.setEmoji({ id: e.id, name: e.name, animated: e.animated ?? false });
        return btn;
      }),
    );
    container.addActionRowComponents(flagRow);
  }

  // Merge all below-container buttons into one row (Website first, then user buttons, max 5)
  const websiteBtn = new ButtonBuilder().setLabel('Website').setURL('https://odservices.cc/').setStyle(ButtonStyle.Link).setEmoji('🔗');
  const allBelowBtns = [websiteBtn, ...belowButtons].slice(0, 5);
  const belowRow = new ActionRowBuilder().addComponents(...allBelowBtns);

  const components = [];
  if (data.pingEveryone) components.push(new TextDisplayBuilder().setContent('@everyone'));
  components.push(container);
  components.push(belowRow);

  return { components, flags: MessageFlags.IsComponentsV2 };
}

async function sendGeneralAnnouncement(channelId, data) {
  if (!client?.isReady()) throw new Error('Bot is not connected.');

  const emojis = await resolveFlagEmojis(true);
  const { MessageFlags } = require('discord.js');

  const channel = await client.channels.fetch(channelId);
  if (!channel?.isTextBased()) throw new Error('That channel is not a text channel.');

  const payload = await buildGeneralPayload(data, emojis);
  const message = await channel.send(payload);

  announcementStore.set(message.id, { ...data, _type: 'general', _channelId: channel.id, _channelName: channel.name, _sentAt: Date.now() });
  saveStore(announcementStore);

  return { messageId: message.id, channelId: channel.id, channelName: channel.name };
}

function getHistory() {
  const entries = [];
  for (const [messageId, data] of announcementStore.entries()) {
    entries.push({
      messageId,
      type: data._type ?? 'build',
      channelId: data._channelId ?? null,
      channelName: data._channelName ?? null,
      sentAt: data._sentAt ?? null,
      title: data._type === 'general' ? (data.header || '(no header)') : (data.product || '(no product)'),
      data,
    });
  }
  return entries.sort((a, b) => (b.sentAt ?? 0) - (a.sentAt ?? 0));
}

async function editAnnouncement(messageId, channelId, data) {
  if (!client?.isReady()) throw new Error('Bot is not connected.');

  // Fall back to stored channelId for entries saved before metadata was added
  const resolvedChannelId = channelId || announcementStore.get(messageId)?._channelId;
  if (!resolvedChannelId) throw new Error('Channel ID unknown — resend this announcement to re-link it.');

  const emojis = await resolveFlagEmojis();
  const channel = await client.channels.fetch(resolvedChannelId);
  const message = await channel.messages.fetch(messageId);

  let payload;
  if (data._type === 'general') {
    payload = await buildGeneralPayload(data, emojis);
  } else {
    payload = buildAnnouncementComponents(data, 'en', emojis);
  }

  await message.edit(payload);

  const existing = announcementStore.get(messageId) ?? {};
  announcementStore.set(messageId, { ...existing, ...data, _editedAt: Date.now() });
  saveStore(announcementStore);

  return { ok: true };
}

module.exports = {
  connectBot,
  getBotStatus,
  listGuildChannels,
  sendAnnouncement,
  sendGeneralAnnouncement,
  getHistory,
  editAnnouncement,
};
