const DEEPL_LANG = {
  en: 'EN',
  de: 'DE',
  fr: 'FR',
  es: 'ES',
  pt: 'PT-BR',
};

async function translateText(text, targetLang) {
  if (!text?.trim()) return text;
  if (targetLang === 'en') return text;

  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) return text;

  const endpoint = apiKey.endsWith(':fx')
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate';

  const target = DEEPL_LANG[targetLang] ?? 'EN';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `DeepL-Auth-Key ${apiKey}` },
    body: JSON.stringify({ text: [text], target_lang: target }),
  });

  if (!res.ok) return text;
  const data = await res.json();
  return data.translations?.[0]?.text ?? text;
}

async function translateAnnouncementData(data, lang) {
  if (lang === 'en') return data;

  const [product, changelog, footer] = await Promise.all([
    translateText(data.product, lang),
    translateText(data.changelog, lang),
    translateText(data.footer, lang),
  ]);

  return { ...data, product, changelog, footer };
}

async function translateGeneralData(data, lang) {
  if (lang === 'en') return data;

  const [header, footer] = await Promise.all([
    translateText(data.header, lang),
    translateText(data.footer, lang),
  ]);

  const blocks = await Promise.all((data.blocks ?? []).map(async (block) => {
    if (block.type === 'text') {
      return { ...block, content: await translateText(block.content, lang) };
    }
    if (block.type === 'section') {
      return { ...block, text: await translateText(block.text, lang) };
    }
    return block;
  }));

  return { ...data, header, footer, blocks };
}

module.exports = { translateText, translateAnnouncementData, translateGeneralData };
