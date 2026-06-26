const fs = require('node:fs');
const path = require('node:path');

const FLAG_DEFS = [
  { id: 'lang_en', name: 'flag_us', code: 'us' },
  { id: 'lang_de', name: 'flag_de', code: 'de' },
  { id: 'lang_fr', name: 'flag_fr', code: 'fr' },
  { id: 'lang_es', name: 'flag_es', code: 'es' },
  { id: 'lang_br', name: 'flag_br', code: 'br' },
];

const dataDir = path.join(__dirname, '..', 'data');
const flagsDir = path.join(__dirname, '..', 'assets', 'flags');

function cachePathFor(guildId) {
  const suffix = guildId ? `guild-${guildId}` : 'application';
  return path.join(dataDir, `flag-emojis-${suffix}.json`);
}

function readCache(guildId) {
  const cachePath = cachePathFor(guildId);
  if (!fs.existsSync(cachePath)) return {};

  try {
    return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } catch {
    return {};
  }
}

function writeCache(guildId, map) {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(cachePathFor(guildId), JSON.stringify(map, null, 2));
}

function isComplete(map) {
  return Object.keys(map).length === FLAG_DEFS.length
    && FLAG_DEFS.every((flag) => map[flag.id]?.id);
}

function loadFlagBuffer(code) {
  const localPath = path.join(flagsDir, `${code}.png`);
  if (!fs.existsSync(localPath)) {
    throw new Error(`Missing local flag image for ${code}.`);
  }
  return fs.readFileSync(localPath);
}

async function createMissingEmojis(existing, createEmoji, guildId) {
  const map = {};

  for (const flag of FLAG_DEFS) {
    let emoji = existing.find((entry) => entry.name === flag.name);

    if (!emoji) {
      const buffer = loadFlagBuffer(flag.code);
      emoji = await createEmoji(flag.name, buffer);
      console.log(`Uploaded flag emoji ${flag.name} (${emoji.id})`);
    }

    map[flag.id] = {
      id: emoji.id,
      name: emoji.name,
      animated: emoji.animated ?? false,
    };
  }

  writeCache(guildId, map);
  return map;
}

async function ensureGuildFlagEmojis(client, guildId) {
  const cached = readCache(guildId);
  if (isComplete(cached)) return cached;

  const guild = await client.guilds.fetch(guildId);
  const existing = await guild.emojis.fetch();

  return createMissingEmojis(
    [...existing.values()],
    (name, attachment) =>
      guild.emojis.create({
        name,
        attachment,
        reason: 'Announcement language buttons',
      }),
    guildId,
  );
}

async function ensureApplicationFlagEmojis(client) {
  const cached = readCache(null);
  if (isComplete(cached)) return cached;

  const application = await client.application.fetch();
  const existing = await application.emojis.fetch();

  return createMissingEmojis(
    [...existing.values()],
    (name, attachment) => application.emojis.create({ name, attachment }),
    null,
  );
}

async function ensureFlagEmojis(client, guildId) {
  if (guildId) {
    try {
      return await ensureGuildFlagEmojis(client, guildId);
    } catch (error) {
      console.error(`Guild flag upload failed (${error.message}). Falling back to application emojis.`);
    }
  }

  return ensureApplicationFlagEmojis(client);
}

module.exports = {
  FLAG_DEFS,
  ensureFlagEmojis,
  readCache,
  isComplete,
};
