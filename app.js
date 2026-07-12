const $ = (sel) => document.querySelector(sel);

const els = {
  title: $('#title'),
  description: $('#description'),
  imageFile: $('#imageFile'),
  datetime: $('#datetime'),
  color: $('#color'),
  fontFamily: $('#fontFamily'),
  textColor: $('#textColor'),
  webhook: $('#webhook'),
  send: $('#send'),
  add: $('#add'),
  clear: $('#clear'),
  status: $('#status'),

  previewAccent: $('#previewAccent'),
  previewTitle: $('#previewTitle'),
  previewDesc: $('#previewDesc'),
  previewImage: $('#previewImage'),
  previewTime: $('#previewTime'),
  previewTag: $('#previewTag'),

  list: $('#list'),
};


let entries = [];
let currentImageFile = null;
let currentImageDataUrl = '';

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
  const y = date.getFullYear();
  const m = pad2(date.getMonth()+1);
  const d = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function hexToDiscordInt(hex){
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
  const image = currentImageDataUrl;
  const color = els.color.value || '#7c5cff';
  const fontFamily = els.fontFamily.value || '';
  const textColor = els.textColor.value || '#eaf0ff';

  const raw = els.datetime.value;
  let dt = null;
  if(raw){
    dt = new Date(raw);
    if(Number.isNaN(dt.getTime())) dt = null;
  }

  return { title, description, image, color, fontFamily, textColor, datetime: dt };
}

function renderList(){
  els.list.innerHTML = '';

  for(const e of entries){
    const div = document.createElement('div');
    div.className = 'entry';
    const imgHtml = e.image ? `<img src="${escapeHtmlAttr(e.image)}" alt="" class="entry__image" />` : '';
    div.innerHTML = `
      <div class="top" style="--c:${escapeHtmlAttr(e.color)}"></div>
      <div class="content" style="font-family:${escapeHtmlAttr(e.fontFamily)}; color:${escapeHtmlAttr(e.textColor)}">
        <div class="rowmeta">
          <div class="t">${escapeHtml(e.title)}</div>
          <div class="muted small">${escapeHtml(e.timeText)}</div>
        </div>
        <div class="d">${escapeHtml(e.description)}</div>
        ${imgHtml}
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
  if(!state.color) return 'Accent colour is required.';

  const webhook = (els.webhook.value || '').trim();
  if(!webhook) return 'Discord webhook URL is required.';
  try{
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
        ...(state.image && currentImageFile ? { image: { url: `attachment://${currentImageFile.name}` } } : {}),
        footer: { text: 'Discord Changelog Builder' }
      }
    ]
  };

  setStatus('Sending…', null);

  try{
    let res;
    if(currentImageFile){
      const form = new FormData();
      form.append('file1', currentImageFile);
      form.append('payload_json', JSON.stringify(payload));
      res = await fetch(webhookUrl, {
        method: 'POST',
        body: form
      });
    } else {
      res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

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
    image: state.image || undefined,
    color: state.color,
    fontFamily: state.fontFamily || undefined,
    textColor: state.textColor || undefined,
    timeText,
    iso: state.datetime.toISOString()
  });

  renderList();
  setStatus('Added to changelog list.', 'ok');
}

function clearForm(){
  els.title.value = '';
  els.description.value = '';
  els.imageFile.value = '';
  els.color.value = '#7c5cff';
  els.fontFamily.selectedIndex = 0;
  els.textColor.value = '#eaf0ff';
  currentImageFile = null;
  currentImageDataUrl = '';
  const now = new Date();
  els.datetime.value = toLocalInputValue(now);
  setStatus('', null);
  updatePreview();
}

function updatePreview(){
  const state = getFormState();

  els.previewAccent.style.background = state.color || '#7c5cff';
  els.previewTitle.textContent = state.title || 'Your title…';
  els.previewDesc.textContent = state.description || 'Your description will appear here.';
  els.previewTag.textContent = 'Changelog';
  els.previewTime.textContent = state.datetime ? formatDateTime(state.datetime) : '—';

  if(state.image){
    els.previewImage.src = state.image;
    els.previewImage.style.display = 'block';
  } else {
    els.previewImage.style.display = 'none';
    els.previewImage.removeAttribute('src');
  }

  if(state.fontFamily){
    els.previewTitle.style.fontFamily = state.fontFamily;
    els.previewDesc.style.fontFamily = state.fontFamily;
    els.previewTag.style.fontFamily = state.fontFamily;
    els.previewTime.style.fontFamily = state.fontFamily;
  }

  if(state.textColor){
    els.previewTitle.style.color = state.textColor;
    els.previewDesc.style.color = state.textColor;
    els.previewTag.style.color = state.textColor;
    els.previewTime.style.color = state.textColor;
  }
}

function hook(){
  const inputs = [els.title, els.description, els.datetime, els.color, els.fontFamily, els.textColor];
  for(const i of inputs){
    i.addEventListener('input', updatePreview);
    i.addEventListener('change', updatePreview);
  }

  els.imageFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(file){
      currentImageFile = file;
      const reader = new FileReader();
      reader.onload = () => {
        currentImageDataUrl = reader.result;
        updatePreview();
      };
      reader.readAsDataURL(file);
    } else {
      currentImageFile = null;
      currentImageDataUrl = '';
      updatePreview();
    }
  });

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
