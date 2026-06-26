const STATUS_LABELS = {
  UNDETECTED: { emoji: '🟢', en: 'UNDETECTED', de: 'UNENTDECKT', fr: 'INDÉTECTÉ', es: 'INDETECTABLE', pt: 'INDETECTÁVEL' },
  DETECTED: { emoji: '🔴', en: 'DETECTED', de: 'ENTDECKT', fr: 'DÉTECTÉ', es: 'DETECTADO', pt: 'DETECTADO' },
  UPDATING: { emoji: '🟡', en: 'UPDATING', de: 'WIRD AKTUALISIERT', fr: 'MISE À JOUR', es: 'ACTUALIZANDO', pt: 'ATUALIZANDO' },
  MAINTENANCE: { emoji: '🟠', en: 'MAINTENANCE', de: 'WARTUNG', fr: 'MAINTENANCE', es: 'MANTENIMIENTO', pt: 'MANUTENÇÃO' },
};

const UI = {
  en: {
    title: '📢 Product Announcement',
    product: 'Product',
    status: 'Current Status',
    statusLink: (url) => `View live status: ${url}`,
    additionalInfo: 'Additional Information',
    changelogHeader: 'Changelog:',
    closing: 'Any issues let us know 💖',
  },
  de: {
    title: '📢 Produktankündigung',
    product: 'Produkt',
    status: 'Aktueller Status',
    statusLink: (url) => `Live-Status ansehen: ${url}`,
    additionalInfo: 'Zusätzliche Informationen',
    changelogHeader: 'Änderungsprotokoll:',
    closing: 'Bei Problemen meldet euch 💖',
  },
  fr: {
    title: '📢 Annonce produit',
    product: 'Produit',
    status: 'Statut actuel',
    statusLink: (url) => `Voir le statut en direct : ${url}`,
    additionalInfo: 'Informations supplémentaires',
    changelogHeader: 'Journal des modifications :',
    closing: 'En cas de problème, contactez-nous 💖',
  },
  es: {
    title: '📢 Anuncio de producto',
    product: 'Producto',
    status: 'Estado actual',
    statusLink: (url) => `Ver estado en vivo: ${url}`,
    additionalInfo: 'Información adicional',
    changelogHeader: 'Registro de cambios:',
    closing: 'Si hay problemas, avísanos 💖',
  },
  pt: {
    title: '📢 Anúncio de produto',
    product: 'Produto',
    status: 'Status atual',
    statusLink: (url) => `Ver status ao vivo: ${url}`,
    additionalInfo: 'Informações adicionais',
    changelogHeader: 'Registro de alterações:',
    closing: 'Qualquer problema, nos avise 💖',
  },
};

function getStatusText(statusKey, lang) {
  const normalized = statusKey.toUpperCase();
  const entry = STATUS_LABELS[normalized] ?? {
    emoji: '⚪',
    [lang]: normalized,
    en: normalized,
  };

  const label = entry[lang] ?? entry.en;
  return `${entry.emoji} ${label}`;
}

module.exports = { UI, getStatusText };
