const $ = (sel) => document.querySelector(sel);

const els = {
  title: $('#title'),
  description: $('#description'),
  datetime: $('#datetime'),
  color: $('#color'),
  webhook: $('#webhook'),
  send: $('#send'),
  add: $('#add'),
  clear: $('#clear'),
  status: $('#status'),

  previewAccent: $('#previewAccent'),
  previewTitle: $('#previewTitle'),
  previewDesc: $('#previewDesc'),
  previewTime: $('#previewTime'),
  previewTag: $('#previewTag'),

  list: $('#list'),
};


let entries = [];

function pad2(n){ return String(n).padStart(2,'0'); }
function toLocalInputValue(date){
  const y = date.getFullYear();
  const m = pad2(date.getMonth()+1);
  const d = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function formatDateTime(date){
  // Example: 2026-06-22 13:45
  const y = date.getFullYear();
  const m = pad2(date.getMonth()+1);
  const d = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function hexToDiscordInt(hex){
  // Discord embed color expects integer (0xRRGGBB)
  const clean = hex.replace('#','').trim();
  const n = parseInt(clean, 16);
  return Number.isFinite(n) ? n : 0;
}

function setStatus(msg, kind){
  els.status.className = 'status';
  if(kind) els.status.classList.add(kind);
  els.status.textContent = msg || '';
}

function getFormState(){
  const title = (els.title.value || '').trim();
  const description = (els.description.value || '').trim();
  const color = els.color.value || '#7c5cff';

  const raw = els.datetime.value;
  let dt = null;
  if(raw){
    dt = new Date(raw);
    if(Number.isNaN(dt.getTime())) dt = null;
  }

  return { title, description, color, datetime: dt };
}

function renderList(){
  els.list.innerHTML = '';

  for(const e of entries){
    const div = document.createElement('div');
    div.className = 'entry';
    div.innerHTML = `
      <div class="top" style="--c:${escapeHtmlAttr(e.color)}"></div>
      <div class="content">
        <div class="rowmeta">
          <div class="t">${escapeHtml(e.title)}</div>
          <div class="muted small">${escapeHtml(e.timeText)}</div>
        </div>
        <div class="d">${escapeHtml(e.description)}</div>
      </div>
    `;
    els.list.appendChild(div);
  }
}

function escapeHtml(s){
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','<')
    .replaceAll('>','>')
    .replaceAll('"','"')
    .replaceAll("'",'&#039;');
}
function escapeHtmlAttr(s){
  return escapeHtml(s).replaceAll('`','');
}

function validateForDiscord(state){
  if(!state.title) return 'Title is required.';
  if(!state.description) return 'Description is required.';
  if(!state.datetime) return 'Date & time is required.';
  if(!state.color) return 'Change colour is required.';

  const webhook = (els.webhook.value || '').trim();
  if(!webhook) return 'Discord webhook URL is required.';
  try{
    // Ensure it looks like a URL
    new URL(webhook);
  } catch {
    return 'Discord webhook URL is invalid.';
  }

  return null;
}

async function sendToDiscord(){
  const state = getFormState();
  const err = validateForDiscord(state);
  if(err){
    setStatus(err, 'err');
    return;
  }

  const webhookUrl = els.webhook.value.trim();

  // Discord embed expects ISO timestamp for better formatting
  const iso = state.datetime.toISOString();
  const colorInt = hexToDiscordInt(state.color);

  const payload = {
    username: 'Changelog Bot',
    embeds: [
      {
        title: state.title,
        description: state.description,
        color: colorInt,
        timestamp: iso,
        footer: { text: 'Discord Changelog Builder' }
      }
    ]
  };

  setStatus('Sending…', null);

  try{
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if(!res.ok){
      const text = await res.text().catch(()=> '');
      throw new Error(`Discord returned ${res.status} ${res.statusText}${text ? `: ${text}` : ''}`);
    }

    setStatus('Sent to Discord successfully.', 'ok');
  } catch (e){
    setStatus(`Failed to send: ${e.message}`, 'err');
  }
}

function addToChangelog(){
  const state = getFormState();
  if(!state.title || !state.description || !state.datetime){
    setStatus('Fill title, description, and date & time first.', 'err');
    return;
  }

  const timeText = formatDateTime(state.datetime);
  entries.unshift({
    title: state.title,
    description: state.description,
    color: state.color,
    timeText,
    iso: state.datetime.toISOString()
  });

  renderList();
  setStatus('Added to changelog list.', 'ok');
}

function clearForm(){
  els.title.value = '';
  els.description.value = '';
  els.color.value = '#7c5cff';
  // datetime defaults to now
  const now = new Date();
  els.datetime.value = toLocalInputValue(now);
  setStatus('', null);
}


function updatePreview(){
  const state = getFormState();
  els.previewAccent.style.background = state.color || '#7c5cff';
  els.previewTitle.textContent = state.title || 'Your title…';
  els.previewDesc.textContent = state.description || 'Your description will appear here.';
  els.previewTag.textContent = 'Changelog';
  els.previewTime.textContent = state.datetime ? formatDateTime(state.datetime) : '—';
}

function hook(){
  const inputs = [els.title, els.description, els.datetime, els.color];
  for(const i of inputs){
    i.addEventListener('input', updatePreview);
    i.addEventListener('change', updatePreview);
  }

  els.send.addEventListener('click', sendToDiscord);
  els.add.addEventListener('click', addToChangelog);
  els.clear.addEventListener('click', clearForm);
}



(function init(){
  const now = new Date();
  els.datetime.value = toLocalInputValue(now);
  updatePreview();
  hook();
})();


