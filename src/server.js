const express = require('express');
const path = require('node:path');
const { connectBot, getBotStatus, listGuildChannels, sendAnnouncement, getHistory, editAnnouncement } = require('./bot');
const { loadSettings, saveSettings, maskToken } = require('./settings');

const app = express();
const PORT = process.env.PORT || 3847;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

function publicSettings(settings) {
  return {
    guildId: settings.guildId,
    defaultChannelId: settings.defaultChannelId,
    defaults: settings.defaults,
    hasToken: Boolean(settings.botToken),
    maskedToken: maskToken(settings.botToken),
  };
}

app.get('/api/settings', (_req, res) => {
  res.json(publicSettings(loadSettings()));
});

app.post('/api/settings', async (req, res) => {
  try {
    const current = loadSettings();
    const next = {
      ...current,
      guildId: req.body.guildId?.trim() ?? current.guildId,
      defaultChannelId: req.body.defaultChannelId?.trim() ?? current.defaultChannelId,
      defaults: { ...current.defaults, ...req.body.defaults },
    };

    const token = req.body.botToken?.trim();
    if (token) {
      next.botToken = token;
    }

    if (next.botToken) {
      await connectBot(next.botToken);
    }

    saveSettings(next);
    res.json({ ok: true, settings: publicSettings(next), bot: await getBotStatus() });
  } catch (error) {
    res.status(400).json({ error: error.message ?? 'Failed to save settings.' });
  }
});

app.get('/api/bot/status', async (_req, res) => {
  res.json(await getBotStatus());
});

app.get('/api/channels', async (_req, res) => {
  try {
    const settings = loadSettings();
    if (!settings.botToken) {
      res.status(400).json({ error: 'Add your bot token in Settings first.' });
      return;
    }

    if (!settings.guildId) {
      res.status(400).json({ error: 'Add your server (guild) ID in Settings first.' });
      return;
    }

    await connectBot(settings.botToken);
    const channels = await listGuildChannels(settings.guildId);
    res.json({ channels });
  } catch (error) {
    res.status(400).json({ error: error.message ?? 'Failed to load channels.' });
  }
});

app.post('/api/announce', async (req, res) => {
  try {
    const settings = loadSettings();
    if (!settings.botToken) {
      res.status(400).json({ error: 'Add your bot token in Settings first.' });
      return;
    }

    const channelId = req.body.channelId?.trim() || settings.defaultChannelId;
    if (!channelId) {
      res.status(400).json({ error: 'Pick a channel or set a default channel in Settings.' });
      return;
    }

    const data = {
      product: req.body.product ?? settings.defaults.product,
      status: req.body.status ?? settings.defaults.status,
      statusUrl: req.body.statusUrl ?? settings.defaults.statusUrl,
      changelog: req.body.changelog ?? settings.defaults.changelog,
      imageUrl: req.body.imageUrl ?? settings.defaults.imageUrl,
      footer: req.body.footer ?? settings.defaults.footer,
      accentColor: req.body.accentColor ?? settings.defaults.accentColor,
      pingEveryone: req.body.pingEveryone ?? settings.defaults.pingEveryone,
    };

    await connectBot(settings.botToken);
    const result = await sendAnnouncement(channelId, data);
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message ?? 'Failed to send announcement.' });
  }
});

app.post('/api/announce/general', async (req, res) => {
  try {
    const settings = loadSettings();
    if (!settings.botToken) {
      res.status(400).json({ error: 'Add your bot token in Settings first.' });
      return;
    }
    const channelId = req.body.channelId?.trim() || settings.defaultChannelId;
    if (!channelId) {
      res.status(400).json({ error: 'Pick a channel.' });
      return;
    }
    await connectBot(settings.botToken);
    const { sendGeneralAnnouncement } = require('./bot');
    const result = await sendGeneralAnnouncement(channelId, {
      header:       req.body.header,
      blocks:       req.body.blocks,
      footer:       req.body.footer,
      accentColor:  req.body.accentColor,
      pingEveryone: req.body.pingEveryone,
    });
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message ?? 'Failed to send.' });
  }
});

app.get('/api/history', (_req, res) => {
  res.json({ history: getHistory() });
});

app.post('/api/announce/edit', async (req, res) => {
  try {
    const settings = loadSettings();
    if (!settings.botToken) return res.status(400).json({ error: 'Add your bot token in Settings first.' });
    await connectBot(settings.botToken);
    const { messageId, channelId, data } = req.body;
    if (!messageId || !data) return res.status(400).json({ error: 'messageId and data are required.' });
    const result = await editAnnouncement(messageId, channelId, data);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message ?? 'Failed to edit.' });
  }
});

async function start() {
  const settings = loadSettings();

  if (settings.botToken) {
    try {
      await connectBot(settings.botToken);
      console.log('Bot connected from saved settings.');
    } catch (error) {
      console.error('Could not connect bot on startup:', error.message);
    }
  }

  app.listen(PORT, () => {
    console.log(`Dashboard running at http://localhost:${PORT}`);
    console.log('Build: guild flag buttons enabled');
  });
}

start();
