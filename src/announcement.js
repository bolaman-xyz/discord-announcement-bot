const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
} = require('discord.js');
const { UI, getStatusText } = require('./translations');

const LANG_BUTTONS = [
  { id: 'lang_de', emoji: '🇩🇪', lang: 'de' },
  { id: 'lang_fr', emoji: '🇫🇷', lang: 'fr' },
  { id: 'lang_es', emoji: '🇪🇸', lang: 'es' },
  { id: 'lang_br', emoji: '🇧🇷', lang: 'pt' },
];

function fieldBlock(label, value) {
  return `**${label}**\n\`\`\`\n${value}\n\`\`\``;
}

function buildChangelogBlock(lang, changelog) {
  return `\`\`\`\n${changelog}\n\`\`\``;
}

function buildAnnouncementComponents(data, lang = 'en', flagEmojis = {}) {
  const t = UI[lang] ?? UI.en;
  const statusText = getStatusText(data.status, lang);

  const container = new ContainerBuilder()
    .setAccentColor(parseInt((process.env.ACCENT_COLOR ?? data.accentColor).replace('#', ''), 16))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## ${t.title}`),
      new TextDisplayBuilder().setContent(fieldBlock(t.product, data.product)),
      new TextDisplayBuilder().setContent(fieldBlock(t.status, statusText)),
      new TextDisplayBuilder().setContent(t.statusLink(data.statusUrl)),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**${t.additionalInfo}**`),
      new TextDisplayBuilder().setContent(buildChangelogBlock(lang, data.changelog)),
    );

  if (data.imageUrl) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(data.imageUrl),
      ),
    );
  }

  const footer = data.footer?.trim();
  if (footer) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# ${footer}`),
    );
  }

  const buttonRow = new ActionRowBuilder().addComponents(
    ...LANG_BUTTONS.map(({ id }) => {
      const button = new ButtonBuilder()
        .setCustomId(id)
        .setStyle(ButtonStyle.Secondary);

      const customEmoji = flagEmojis[id];
      if (!customEmoji?.id) {
        throw new Error(`Missing flag emoji for ${id}. Restart the dashboard.`);
      }

      button.setEmoji({
        id: customEmoji.id,
        name: customEmoji.name,
        animated: customEmoji.animated ?? false,
      });

      return button;
    }),
  );

  container.addActionRowComponents(buttonRow);

  const components = [];

  if (data.pingEveryone) {
    components.push(new TextDisplayBuilder().setContent('@everyone'));
  }

  components.push(container);

  return {
    components,
    flags: MessageFlags.IsComponentsV2,
  };
}

module.exports = {
  LANG_BUTTONS,
  buildAnnouncementComponents,
};
