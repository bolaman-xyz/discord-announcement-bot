const $ = (id) => document.getElementById(id);

// ── Status colors ──────────────────────────────────────────────────────────
const STATUS_COLOR = { UNDETECTED:'#57f287', DETECTED:'#ed4245', UPDATING:'#faa61a', MAINTENANCE:'#faa61a' };
const STATUS_EMOJI = { UNDETECTED:'🟢', DETECTED:'🔴', UPDATING:'🟡', MAINTENANCE:'🟠' };

// ── Helpers ────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function md(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`(.+?)`/g,'<code>$1</code>')
    .replace(/\n/g,'<br>');
}
function showToast(msg, type='success') {
  const t = $('toast');
  t.textContent = msg;
  t.className = `show ${type==='error'?'error':''}`;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=>{ t.className=''; }, 3500);
}
async function api(path, opts={}) {
  const res = await fetch(path, { headers:{'Content-Type':'application/json'}, ...opts });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? 'Request failed');
  return body;
}

// ── Navigation ─────────────────────────────────────────────────────────────
function isMobile() { return window.innerWidth <= 700; }

function closePreviewSheet() {
  document.querySelectorAll('.preview-wrap').forEach(pw => pw.classList.remove('open'));
  const fab = $('previewFab');
  if (fab) { fab.textContent = ''; fab.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Preview'; }
}

function openPreviewSheet(panelId) {
  const pw = document.querySelector(`#${panelId} .preview-wrap`);
  if (pw) pw.classList.add('open');
}

function switchTab(tab) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab===tab));
  document.querySelectorAll('.mob-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab===tab));
  $('buildPanel').classList.toggle('active', tab==='build');
  $('generalPanel').classList.toggle('active', tab==='general');
  $('settingsPanel').classList.toggle('active', tab==='settings');
  const titles = { build:'Build announcement', general:'General announcement', settings:'Bot settings' };
  $('pageTitle').textContent = titles[tab] ?? '';
  $('topbarActions').style.display = (tab==='build'||tab==='general') ? '' : 'none';
  $('sendBtn').dataset.tab = tab;
  $('resetBtn').style.display = tab==='general' ? 'none' : '';

  // Mobile: show/hide FAB
  const fab = $('previewFab');
  if (fab) fab.style.display = (isMobile() && (tab==='build'||tab==='general')) ? 'flex' : 'none';
  closePreviewSheet();
}
document.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', ()=>switchTab(b.dataset.tab)));
document.querySelectorAll('.mob-nav-btn').forEach(b => b.addEventListener('click', ()=>switchTab(b.dataset.tab)));

// Preview FAB
const previewFab = $('previewFab');
if (previewFab) {
  previewFab.addEventListener('click', () => {
    const activeTab = document.querySelector('.mob-nav-btn.active')?.dataset.tab;
    const panelMap = { build: 'buildPanel', general: 'generalPanel' };
    const panelId = panelMap[activeTab];
    if (!panelId) return;
    const pw = document.querySelector(`#${panelId} .preview-wrap`);
    if (!pw) return;
    if (pw.classList.contains('open')) {
      closePreviewSheet();
    } else {
      openPreviewSheet(panelId);
    }
  });
}

// Preview close buttons (injected on mobile)
function ensurePreviewClose() {
  document.querySelectorAll('.preview-wrap').forEach(pw => {
    if (!pw.querySelector('.preview-close')) {
      const hdr = pw.querySelector('.preview-header');
      if (hdr) {
        const btn = document.createElement('button');
        btn.className = 'preview-close';
        btn.innerHTML = '<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg> Close';
        btn.addEventListener('click', closePreviewSheet);
        hdr.appendChild(btn);
      }
    }
  });
}
ensurePreviewClose();

// ── Status dot sync ────────────────────────────────────────────────────────
function syncStatusDot() {
  const sel = $('status');
  const c = sel.options[sel.selectedIndex]?.dataset.c ?? '#57f287';
  $('sdot').style.background = c;
}
$('status').addEventListener('change', ()=>{ syncStatusDot(); renderPreview(); });

// ── Form data ──────────────────────────────────────────────────────────────
function getFormData() {
  return {
    channelId:    $('channelId').value,
    pingEveryone: $('pingEveryone').checked,
    product:      $('product').value.trim(),
    status:       $('status').value,
    statusUrl:    'https://odservices.cc/status',
    changelog:    $('changelog').value.trim(),
    imageUrl:     $('imageUrl').value.trim(),
    footer:       $('footer').value.trim(),
    accentColor:  $('accentColor').value,
  };
}
function setFormData(d={}) {
  $('product').value     = d.product    ?? '';
  $('status').value      = d.status     ?? 'UNDETECTED';
  $('changelog').value   = d.changelog  ?? '';
  $('imageUrl').value    = d.imageUrl   ?? '';
  $('footer').value      = d.footer     ?? '';
  $('accentColor').value = d.accentColor ?? '#9900ff';
  $('pingEveryone').checked = d.pingEveryone ?? true;
  syncStatusDot();
  renderPreview();
}
['product','changelog','imageUrl','footer','accentColor','pingEveryone'].forEach(id => {
  const el = $(id);
  el.addEventListener('input',  renderPreview);
  el.addEventListener('change', renderPreview);
});

// ── Live preview (Build tab) ───────────────────────────────────────────────
function renderPreview() {
  const d     = getFormData();
  const color = d.accentColor || '#9900ff';
  const sc    = STATUS_COLOR[d.status] ?? '#57f287';
  const emoji = STATUS_EMOJI[d.status] ?? '⚪';
  const sel   = $('status');
  const sLabel = (sel.options[sel.selectedIndex]?.text ?? d.status).toUpperCase();
  const changelogBlock = d.changelog ? `<pre>${esc(d.changelog)}</pre>` : '';
  const bannerHtml = d.imageUrl ? `<div class="cv2-media"><img src="${esc(d.imageUrl)}" alt="banner" onerror="this.parentElement.style.display='none'"></div>` : '';
  const avatarHtml = window._botAvatar ? `<img src="${esc(window._botAvatar)}" alt="avatar">` : (window._botName??'A').charAt(0).toUpperCase();
  const botName = window._botName ?? 'Announce';
  const now = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});

  $('preview').innerHTML = `
    <div class="msg-row">
      <div class="msg-avatar">${avatarHtml}</div>
      <div class="msg-col">
        <div class="msg-author">${esc(botName)} <span class="msg-time">Today at ${now}</span></div>
        ${d.pingEveryone ? '<div class="msg-ping">@everyone</div>' : ''}
        <div class="cv2-container">
          <div class="cv2-accent-wrap">
            <div class="cv2-bar" style="background:${color}"></div>
            <div class="cv2-inner">
              <div class="cv2-text"><h2>📢 Product Announcement</h2></div>
              <div class="cv2-section" style="padding-top:8px">
                <div class="cv2-section-label">Product</div>
                <div class="cv2-section-box">${esc(d.product||'Your product')}</div>
              </div>
              <div class="cv2-section" style="padding-top:8px">
                <div class="cv2-section-label">Current Status</div>
                <div class="cv2-section-box">${emoji} ${sLabel}</div>
              </div>
              <div class="cv2-text" style="padding-top:8px;font-size:13px">View live status: <a href="https://odservices.cc/status" target="_blank">https://odservices.cc/status</a></div>
              ${d.changelog ? `<div class="cv2-sep"></div><div class="cv2-section"><div class="cv2-section-label">Additional Information</div><div class="cv2-text">${changelogBlock}</div></div>` : ''}
              ${bannerHtml}
              ${d.footer ? `<div class="cv2-text" style="padding-top:6px;font-size:12px;color:#80848e">${esc(d.footer)}</div>` : ''}
              <div class="flag-row" style="padding-top:8px">
                ${['us','de','fr','es','br'].map(c=>`<div class="flag-btn"><img src="https://flagcdn.com/w40/${c}.png" alt="${c}"></div>`).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

// ── Block editor (General tab) ─────────────────────────────────────────────
let gBlocks = [];
let gBlockId = 0;

const BLOCK_ICONS = {
  text: '📝', section: '📐', action_list: '🔘', media: '🖼️',
  file: '📎', separator: '➖', buttons: '⬇️',
};
const BLOCK_LABELS = {
  text: 'Text', section: 'Section', action_list: 'Action List',
  media: 'Media', file: 'File', separator: 'Separator', buttons: 'Buttons Below',
};

function addBlock(type) {
  const id = ++gBlockId;
  const block = { id, type, collapsed: false };
  if (type === 'text')        block.content = '';
  if (type === 'section')     { block.text = ''; block.imageUrl = ''; }
  if (type === 'action_list') block.buttons = [{ label:'', url:'' }];
  if (type === 'buttons')     block.buttons = [{ label:'', url:'' }];
  if (type === 'media')       block.urls = [''];
  if (type === 'file')        { block.url = ''; block.name = ''; }
  if (type === 'separator')   {}
  gBlocks.push(block);
  renderBlocks();
  renderGeneralPreview();
}

function removeBlock(id) {
  gBlocks = gBlocks.filter(b => b.id !== id);
  renderBlocks();
  renderGeneralPreview();
}

function updateBlock(id, key, value) {
  const b = gBlocks.find(b => b.id === id);
  if (b) b[key] = value;
  renderGeneralPreview();
}

function toggleCollapse(id) {
  const b = gBlocks.find(b => b.id === id);
  if (b) { b.collapsed = !b.collapsed; renderBlocks(); }
}

function moveBlock(id, dir) {
  const idx = gBlocks.findIndex(b => b.id === id);
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= gBlocks.length) return;
  [gBlocks[idx], gBlocks[newIdx]] = [gBlocks[newIdx], gBlocks[idx]];
  renderBlocks();
  renderGeneralPreview();
}

function renderBlocks() {
  const container = $('blocksContainer');
  container.innerHTML = '';
  gBlocks.forEach(block => {
    const el = document.createElement('div');
    el.className = 'block-card' + (block.collapsed ? ' collapsed' : '');
    const idx = gBlocks.indexOf(block);
    el.innerHTML = `
      <div class="block-header">
        <span class="block-icon">${BLOCK_ICONS[block.type]}</span>
        <span class="block-title">${BLOCK_LABELS[block.type]}</span>
        <div class="block-actions">
          <button class="block-hbtn" data-collapse="${block.id}">${block.collapsed ? '▶' : '▼'}</button>
          <button class="block-hbtn" data-move="${block.id}" data-dir="-1" ${idx === 0 ? 'disabled' : ''}>↑</button>
          <button class="block-hbtn" data-move="${block.id}" data-dir="1" ${idx === gBlocks.length-1 ? 'disabled' : ''}>↓</button>
          <button class="block-hbtn danger" data-remove="${block.id}">✕</button>
        </div>
      </div>
      ${block.collapsed ? '' : `<div class="block-body">${renderBlockFields(block)}</div>`}
    `;
    container.appendChild(el);
  });

  // wire collapse/remove/move buttons
  container.querySelectorAll('[data-collapse]').forEach(btn => {
    btn.addEventListener('click', () => toggleCollapse(Number(btn.dataset.collapse)));
  });
  container.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => removeBlock(Number(btn.dataset.remove)));
  });
  container.querySelectorAll('[data-move]').forEach(btn => {
    btn.addEventListener('click', () => moveBlock(Number(btn.dataset.move), Number(btn.dataset.dir)));
  });

  // wire field inputs
  container.querySelectorAll('[data-bid]').forEach(input => {
    const bid = Number(input.dataset.bid);
    const key = input.dataset.key;
    const idx = input.dataset.idx !== undefined ? Number(input.dataset.idx) : null;
    const subkey = input.dataset.subkey;

    const handler = () => {
      const b = gBlocks.find(b => b.id === bid);
      if (!b) return;
      const val = input.type === 'checkbox' ? input.checked : input.value;
      if (idx !== null && subkey) {
        b[key][idx][subkey] = val;
      } else if (idx !== null) {
        b[key][idx] = val;
      } else {
        b[key] = val;
      }
      renderGeneralPreview();
    };
    input.addEventListener('input', handler);
    input.addEventListener('change', handler);
  });

  // wire add-button buttons inside action_list/buttons blocks
  container.querySelectorAll('[data-addbtn]').forEach(btn => {
    btn.addEventListener('click', () => {
      const bid = Number(btn.dataset.addbtn);
      const b = gBlocks.find(b => b.id === bid);
      if (b) { b.buttons.push({ label:'', url:'' }); renderBlocks(); }
    });
  });

  // wire remove-button buttons
  container.querySelectorAll('[data-rmbtn]').forEach(btn => {
    btn.addEventListener('click', () => {
      const bid = Number(btn.dataset.bid);
      const idx = Number(btn.dataset.rmbtn);
      const b = gBlocks.find(b => b.id === bid);
      if (b && b.buttons.length > 1) { b.buttons.splice(idx, 1); renderBlocks(); renderGeneralPreview(); }
    });
  });

  // wire add-url buttons inside media blocks
  container.querySelectorAll('[data-addurl]').forEach(btn => {
    btn.addEventListener('click', () => {
      const bid = Number(btn.dataset.addurl);
      const b = gBlocks.find(b => b.id === bid);
      if (b) { b.urls.push(''); renderBlocks(); }
    });
  });
}

function renderBlockFields(block) {
  const b = block;
  switch (b.type) {
    case 'text':
      return `<textarea rows="4" placeholder="Markdown text…" data-bid="${b.id}" data-key="content">${esc(b.content)}</textarea>`;

    case 'section':
      return `
        <textarea rows="3" placeholder="Section text…" data-bid="${b.id}" data-key="text">${esc(b.text)}</textarea>
        <label class="field-label" style="margin-top:8px">Thumbnail URL</label>
        <input type="url" placeholder="https://…" value="${esc(b.imageUrl)}" data-bid="${b.id}" data-key="imageUrl" />`;

    case 'action_list':
    case 'buttons':
      return `
        ${b.buttons.map((btn, i) => `
          <div class="btn-row-fields">
            <input type="text" placeholder="Label" value="${esc(btn.label)}" data-bid="${b.id}" data-key="buttons" data-idx="${i}" data-subkey="label" />
            <input type="url"  placeholder="https://…" value="${esc(btn.url)}" data-bid="${b.id}" data-key="buttons" data-idx="${i}" data-subkey="url" />
            <button class="block-hbtn danger" data-bid="${b.id}" data-rmbtn="${i}">✕</button>
          </div>
        `).join('')}
        <button class="block-add-btn" style="margin-top:6px" data-addbtn="${b.id}">+ Add button</button>`;

    case 'media':
      return `
        ${b.urls.map((u, i) => `
          <div style="margin-bottom:8px">
            <label class="field-label">Media URL</label>
            <input type="url" placeholder="https://example.com/image.png" value="${esc(u)}" data-bid="${b.id}" data-key="urls" data-idx="${i}" style="margin-top:4px" />
          </div>
        `).join('')}
        <button class="block-add-btn" style="width:100%;text-align:center;padding:8px" data-addurl="${b.id}">+ Media Item</button>`;

    case 'file':
      return `
        <label class="field-label">Attachment URL</label>
        <input type="url" placeholder="https://…" value="${esc(b.url)}" data-bid="${b.id}" data-key="url" style="margin-top:4px" />
        <label class="field-label" style="margin-top:10px">Display name (optional)</label>
        <input type="text" placeholder="e.g. Void External downloads" value="${esc(b.name)}" data-bid="${b.id}" data-key="name" style="margin-top:4px" />`;

    case 'separator':
      return `<p style="color:#80848e;font-size:12px;margin:0">Adds a horizontal divider line.</p>`;

    default:
      return '';
  }
}

// General preview from blocks
function renderGeneralPreview() {
  const color  = $('gAccentColor').value || '#9900ff';
  const ping   = $('gPingEveryone').checked;
  const footer = $('gFooter').value.trim();
  const header = $('gHeader').value.trim();
  const avatarHtml = window._botAvatar ? `<img src="${esc(window._botAvatar)}" alt="avatar">` : (window._botName??'A').charAt(0).toUpperCase();
  const botName = window._botName ?? 'Announce';
  const now = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});

  let innerHtml = header ? `<div class="cv2-text"><h2>${esc(header)}</h2></div>` : '';
  let belowHtml = '';

  gBlocks.forEach(block => {
    switch (block.type) {
      case 'text':
        if (block.content) innerHtml += `<div class="cv2-text" style="padding:3px 0">${md(block.content)}</div>`;
        break;
      case 'section':
        innerHtml += `<div class="cv2-section-row">
          <div class="cv2-text" style="flex:1">${md(block.text)}</div>
          ${block.imageUrl ? `<img class="cv2-thumb" src="${esc(block.imageUrl)}" onerror="this.style.display='none'">` : ''}
        </div>`;
        break;
      case 'media':
        const validUrls = block.urls.filter(u=>u.trim());
        if (validUrls.length) innerHtml += `<div class="cv2-media-grid">${validUrls.map(u=>`<img src="${esc(u)}" onerror="this.style.display='none'">`).join('')}</div>`;
        break;
      case 'separator':
        innerHtml += `<div class="cv2-sep"></div>`;
        break;
      case 'action_list':
        const abtns = block.buttons.filter(b=>b.label);
        if (abtns.length) innerHtml += `<div class="flag-row" style="padding:4px 0">${abtns.map(b=>`<div class="flag-btn" style="padding:4px 10px;font-size:12px;color:#dbdee1">${esc(b.label)}</div>`).join('')}</div>`;
        break;
      case 'file':
        if (block.url) innerHtml += `<div class="cv2-file-preview">📎 ${esc(block.name||block.url)}</div>`;
        break;
      case 'buttons':
        const bbtns = block.buttons.filter(b=>b.label);
        if (bbtns.length) belowHtml += `<div class="flag-row" style="margin-top:4px">${bbtns.map(b=>`<div class="flag-btn" style="padding:4px 10px;font-size:12px;color:#dbdee1">${esc(b.label)}</div>`).join('')}</div>`;
        break;
    }
  });

  if (footer) innerHtml += `<div class="cv2-text" style="padding-top:6px;font-size:12px;color:#80848e">${esc(footer)}</div>`;
  innerHtml += `<div class="flag-row" style="padding-top:4px">${['us','de','fr','es','br'].map(c=>`<div class="flag-btn"><img src="https://flagcdn.com/w40/${c}.png" alt="${c}"></div>`).join('')}</div>`;
  belowHtml += `<div class="flag-row" style="margin-top:6px"><div class="flag-btn" style="padding:4px 12px;font-size:13px;color:#dbdee1">🔗 Website</div></div>`;

  $('gPreview').innerHTML = `
    <div class="msg-row">
      <div class="msg-avatar">${avatarHtml}</div>
      <div class="msg-col">
        <div class="msg-author">${esc(botName)} <span class="msg-time">Today at ${now}</span></div>
        ${ping ? '<div class="msg-ping">@everyone</div>' : ''}
        <div class="cv2-container">
          <div class="cv2-accent-wrap">
            <div class="cv2-bar" style="background:${color}"></div>
            <div class="cv2-inner">${innerHtml || '<span style="color:#4e5058;font-size:13px">Add blocks to build your message…</span>'}</div>
          </div>
        </div>
        ${belowHtml}
      </div>
    </div>`;
}

// wire general top-level inputs to preview
['gHeader','gFooter','gAccentColor','gPingEveryone'].forEach(id => {
  $(id).addEventListener('input',  renderGeneralPreview);
  $(id).addEventListener('change', renderGeneralPreview);
});

// block toolbar buttons
document.querySelectorAll('.block-add-btn[data-add]').forEach(btn => {
  btn.addEventListener('click', () => addBlock(btn.dataset.add));
});
$('collapseAll').addEventListener('click', () => { gBlocks.forEach(b=>b.collapsed=true); renderBlocks(); });
$('expandAll').addEventListener('click',   () => { gBlocks.forEach(b=>b.collapsed=false); renderBlocks(); });

// ── Bot status polling ─────────────────────────────────────────────────────
async function refreshBotStatus() {
  try {
    const s = await api('/api/bot/status');
    const dot = $('botDot'), label = $('botLabel');
    if (s.online) {
      window._botName   = s.username;
      window._botAvatar = s.avatar;
      dot.className   = 'dot ' + (s.flagsReady ? 'online' : 'loading');
      label.textContent = s.username + (s.flagsReady ? '' : ' · loading flags…');
    } else {
      dot.className = 'dot';
      label.textContent = 'Bot offline';
    }
    renderPreview();
    renderGeneralPreview();
  } catch (_) {}
}

// ── Channels ───────────────────────────────────────────────────────────────
async function loadChannels() {
  try {
    const { channels } = await api('/api/channels');
    const sel = $('channelId'), cur = sel.value;
    sel.innerHTML = '<option value="">Select a channel…</option>';
    channels.forEach(ch => {
      const o = document.createElement('option');
      o.value = ch.id; o.textContent = '#' + ch.name;
      sel.appendChild(o);
    });
    if (cur) sel.value = cur;

    const gSel = $('gChannelId'), gCur = gSel.value;
    gSel.innerHTML = '<option value="">Select a channel…</option>';
    channels.forEach(ch => {
      const o = document.createElement('option');
      o.value = ch.id; o.textContent = '#' + ch.name;
      gSel.appendChild(o);
    });
    if (gCur) gSel.value = gCur;
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ── Settings ───────────────────────────────────────────────────────────────
async function loadSettings() {
  const s = await api('/api/settings');
  $('guildId').value          = s.guildId          ?? '';
  $('defaultChannelId').value = s.defaultChannelId ?? '';
  $('tokenHint').textContent  = s.hasToken ? `Saved token: ${s.maskedToken}` : 'No token saved yet.';
}

$('saveSettingsBtn').addEventListener('click', async () => {
  try {
    const result = await api('/api/settings', {
      method: 'POST',
      body: JSON.stringify({
        botToken: $('botToken').value.trim(),
        guildId:  $('guildId').value.trim(),
        defaultChannelId: $('defaultChannelId').value.trim(),
        defaults: {
          product: $('product').value.trim(), status: $('status').value,
          statusUrl: 'https://odservices.cc/status',
          changelog: $('changelog').value.trim(), imageUrl: $('imageUrl').value.trim(),
          footer: $('footer').value.trim(), accentColor: $('accentColor').value,
          pingEveryone: $('pingEveryone').checked,
        },
      }),
    });
    $('botToken').value = '';
    $('tokenHint').textContent = result.settings?.hasToken ? `Saved token: ${result.settings.maskedToken}` : 'No token saved yet.';
    await refreshBotStatus();
    await loadChannels();
    showToast('Settings saved and bot connected.');
    switchTab('build');
  } catch (e) { showToast(e.message, 'error'); }
});

$('loadChannelsBtn').addEventListener('click', async () => { await loadChannels(); showToast('Channels reloaded.'); });
$('resetBtn').addEventListener('click', async () => { await loadSettings(); showToast('Reset to saved defaults.'); });

// ── Send ───────────────────────────────────────────────────────────────────
$('sendBtn').addEventListener('click', async () => {
  const status = await api('/api/bot/status');
  if (!status.online) { showToast('Bot is offline. Check your token in Settings.', 'error'); return; }

  const tab = $('sendBtn').dataset.tab || 'build';

  if (tab === 'general') {
    if (!gBlocks.length) { showToast('Add at least one block.', 'error'); return; }
    $('overlay').classList.add('show');
    try {
      const result = await api('/api/announce/general', {
        method: 'POST',
        body: JSON.stringify({
          channelId:    $('gChannelId').value,
          pingEveryone: $('gPingEveryone').checked,
          header:       $('gHeader').value.trim(),
          footer:       $('gFooter').value.trim(),
          accentColor:  $('gAccentColor').value,
          blocks:       gBlocks,
        }),
      });
      showToast(`✓ Sent to #${result.channelName}`);
    } catch (e) { showToast(e.message, 'error'); }
    finally { $('overlay').classList.remove('show'); }
    return;
  }

  if (!status.flagsReady) { showToast('Flag buttons are still loading — wait a moment and try again.', 'error'); return; }
  const data = getFormData();
  if (!data.product) { showToast('Product name is required.', 'error'); return; }
  $('overlay').classList.add('show');
  try {
    const result = await api('/api/announce', { method:'POST', body:JSON.stringify(data) });
    showToast(`✓ Sent to #${result.channelName}`);
  } catch (e) { showToast(e.message, 'error'); }
  finally { $('overlay').classList.remove('show'); }
});

// ── Init ───────────────────────────────────────────────────────────────────
(async function init() {
  try {
    await loadSettings();
    await refreshBotStatus();
    await loadChannels();
  } catch (e) { showToast(e.message, 'error'); }
  renderPreview();
  renderGeneralPreview();
  setInterval(refreshBotStatus, 5000);
})();
