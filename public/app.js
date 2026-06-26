const $ = (id) => document.getElementById(id);

// ── Status colors ──────────────────────────────────────────────────────────
const STATUS_COLOR = {
  UNDETECTED: '#57f287',
  DETECTED:   '#ed4245',
  UPDATING:   '#faa61a',
  MAINTENANCE:'#faa61a',
};

const STATUS_EMOJI = {
  UNDETECTED: '🟢',
  DETECTED:   '🔴',
  UPDATING:   '🟡',
  MAINTENANCE:'🟠',
};

// ── Helpers ────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function md(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/`(.+?)`/g,       '<code>$1</code>')
    .replace(/\n/g,            '<br>');
}

function showToast(msg, type = 'success') {
  const t = $('toast');
  t.textContent = msg;
  t.className = `show ${type === 'error' ? 'error' : ''}`;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { t.className = ''; }, 3500);
}

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? 'Request failed');
  return body;
}

// ── Navigation ─────────────────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $('buildPanel').classList.toggle('active', tab === 'build');
  $('settingsPanel').classList.toggle('active', tab === 'settings');
  $('pageTitle').textContent = tab === 'build' ? 'Build announcement' : 'Bot settings';
  $('topbarActions').style.display = tab === 'build' ? '' : 'none';
}

document.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

// ── Status dot sync ────────────────────────────────────────────────────────
function syncStatusDot() {
  const sel = $('status');
  const c = sel.options[sel.selectedIndex]?.dataset.c ?? '#57f287';
  $('sdot').style.background = c;
}

$('status').addEventListener('change', () => { syncStatusDot(); renderPreview(); });

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

function setFormData(d = {}) {
  $('product').value      = d.product     ?? '';
  $('status').value       = d.status      ?? 'UNDETECTED';
  $('statusUrl').value    = d.statusUrl   ?? '';
  $('changelog').value    = d.changelog   ?? '';
  $('imageUrl').value     = d.imageUrl    ?? '';
  $('footer').value       = d.footer      ?? '';
  $('accentColor').value  = d.accentColor ?? '#9900ff';
  $('pingEveryone').checked = d.pingEveryone ?? true;
  syncStatusDot();
  renderPreview();
}

// Wire all form inputs to live preview
['product','statusUrl','changelog','imageUrl','footer','accentColor','pingEveryone'].forEach(id => {
  const el = $(id);
  el.addEventListener('input',  renderPreview);
  el.addEventListener('change', renderPreview);
});

// ── Live preview ───────────────────────────────────────────────────────────
function renderPreview() {
  const d     = getFormData();
  const color = d.accentColor || '#9900ff';
  const sc    = STATUS_COLOR[d.status] ?? '#57f287';
  const emoji = STATUS_EMOJI[d.status] ?? '⚪';
  const sel   = $('status');
  const sLabel = (sel.options[sel.selectedIndex]?.text ?? d.status).toUpperCase();

  // Matches actual bot output: code block with Changelog: header
  const changelogBlock = d.changelog
    ? `<pre>${esc(d.changelog)}</pre>`
    : '';

  // Rendered markdown version shown under "Additional Information" label
  const changelogMd = d.changelog
    ? md(d.changelog)
    : '';

  const bannerHtml = d.imageUrl
    ? `<div class="cv2-media"><img src="${esc(d.imageUrl)}" alt="banner" onerror="this.parentElement.style.display='none'"></div>`
    : '';

  const footerHtml = d.footer
    ? `<div class="cv2-text" style="padding-top:4px;font-size:12px;color:#80848e">${esc(d.footer)}</div>`
    : '';

  const avatarHtml = window._botAvatar
    ? `<img src="${esc(window._botAvatar)}" alt="avatar">`
    : (window._botName ?? 'A').charAt(0).toUpperCase();

  const botName = window._botName ?? 'Announce';
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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
                <div class="cv2-section-box">${esc(d.product || 'Your product')}</div>
              </div>

              <div class="cv2-section" style="padding-top:8px">
                <div class="cv2-section-label">Current Status</div>
                <div class="cv2-section-box">
                  ${emoji} ${sLabel}
                </div>
              </div>

              ${d.statusUrl ? `<div class="cv2-text" style="padding-top:8px;font-size:13px">View live status: <a href="${esc(d.statusUrl)}" target="_blank">${esc(d.statusUrl)}</a></div>` : ''}

              ${d.changelog ? `
                <div class="cv2-sep"></div>
                <div class="cv2-section">
                  <div class="cv2-section-label">Additional Information</div>
                  <div class="cv2-text">${changelogBlock}</div>
                </div>
              ` : ''}

              ${bannerHtml}
              ${d.footer ? `<div class="cv2-text" style="padding-top:6px;font-size:12px;color:#80848e">${esc(d.footer)}</div>` : ''}

              <div class="flag-row" style="padding-top:8px">
                ${['us','de','fr','es','br'].map(c => `<div class="flag-btn"><img src="https://flagcdn.com/w40/${c}.png" alt="${c}"></div>`).join('')}
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>`;
}

// ── Bot status polling ─────────────────────────────────────────────────────
async function refreshBotStatus() {
  try {
    const s = await api('/api/bot/status');
    const dot   = $('botDot');
    const label = $('botLabel');
    if (s.online) {
      window._botName   = s.username;
      window._botAvatar = s.avatar;
      dot.className   = 'dot ' + (s.flagsReady ? 'online' : 'loading');
      label.textContent = s.username + (s.flagsReady ? '' : ' · loading flags…');
    } else {
      dot.className   = 'dot';
      label.textContent = 'Bot offline';
    }
    renderPreview();
  } catch (_) {}
}

// ── Channels ───────────────────────────────────────────────────────────────
async function loadChannels() {
  try {
    const { channels } = await api('/api/channels');
    const sel = $('channelId');
    const cur = sel.value;
    sel.innerHTML = '<option value="">Select a channel…</option>';
    channels.forEach(ch => {
      const o = document.createElement('option');
      o.value = ch.id;
      o.textContent = '#' + ch.name;
      sel.appendChild(o);
    });
    const def = $('defaultChannelId').value;
    if (cur) sel.value = cur;
    else if (def) sel.value = def;
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ── Settings ───────────────────────────────────────────────────────────────
async function loadSettings() {
  const s = await api('/api/settings');
  $('guildId').value          = s.guildId          ?? '';
  $('defaultChannelId').value = s.defaultChannelId ?? '';
  $('tokenHint').textContent  = s.hasToken
    ? `Saved token: ${s.maskedToken}`
    : 'No token saved yet.';
}

$('saveSettingsBtn').addEventListener('click', async () => {
  try {
    const result = await api('/api/settings', {
      method: 'POST',
      body: JSON.stringify({
        botToken:         $('botToken').value.trim(),
        guildId:          $('guildId').value.trim(),
        defaultChannelId: $('defaultChannelId').value.trim(),
        defaults: {
          product:      $('product').value.trim(),
          status:       $('status').value,
          statusUrl:    'https://odservices.cc/status',
          changelog:    $('changelog').value.trim(),
          imageUrl:     $('imageUrl').value.trim(),
          footer:       $('footer').value.trim(),
          accentColor:  $('accentColor').value,
          pingEveryone: $('pingEveryone').checked,
        },
      }),
    });
    $('botToken').value = '';
    $('tokenHint').textContent = result.settings?.hasToken
      ? `Saved token: ${result.settings.maskedToken}`
      : 'No token saved yet.';
    await refreshBotStatus();
    await loadChannels();
    showToast('Settings saved and bot connected.');
    switchTab('build');
  } catch (e) {
    showToast(e.message, 'error');
  }
});

$('loadChannelsBtn').addEventListener('click', async () => {
  await loadChannels();
  showToast('Channels reloaded.');
});

// ── Reset ──────────────────────────────────────────────────────────────────
$('resetBtn').addEventListener('click', async () => {
  await loadSettings();
  showToast('Reset to saved defaults.');
});

// ── Send ───────────────────────────────────────────────────────────────────
$('sendBtn').addEventListener('click', async () => {
  const status = await api('/api/bot/status');

  if (!status.online) {
    showToast('Bot is offline. Check your token in Settings.', 'error');
    return;
  }
  if (!status.flagsReady) {
    showToast('Flag buttons are still loading — wait a moment and try again.', 'error');
    return;
  }

  const data = getFormData();
  if (!data.product) {
    showToast('Product name is required.', 'error');
    return;
  }

  $('overlay').classList.add('show');
  try {
    const result = await api('/api/announce', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    showToast(`✓ Sent to #${result.channelName}`);
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    $('overlay').classList.remove('show');
  }
});

// ── Init ───────────────────────────────────────────────────────────────────
(async function init() {
  try {
    await loadSettings();
    await refreshBotStatus();
    await loadChannels();
  } catch (e) {
    showToast(e.message, 'error');
  }
  renderPreview();
  // Poll bot status every 5s so flags-loading state updates automatically
  setInterval(refreshBotStatus, 5000);
})();
