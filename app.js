// ISI DUA BARIS INI dari Supabase > Project Settings > API
const SUPABASE_URL = 'https://dgkidrhzdufjbxqrrrxw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRna2lkcmh6ZHVmamJ4cXJycnh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4MzIwNDMsImV4cCI6MjEwODQwODA0M30.EkW7zgHmCyYEm2r3TI2Lw8UK0XadQY5m_0S1PNevwrE';

const BUCKET = 'transfer', MAX = 50 * 1024 * 1024;
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = s => document.querySelector(s);
const h = (t, p = {}, ...k) => { const e = Object.assign(document.createElement(t), p); e.append(...k); return e; };
const fmt = n => n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' KB';
const ago = d => { const s = (Date.now() - Date.parse(d)) / 1000; return s < 60 ? 'baru saja' : s < 3600 ? Math.floor(s / 60) + ' mnt lalu' : s < 86400 ? Math.floor(s / 3600) + ' jam lalu' : Math.floor(s / 86400) + ' hari lalu'; };
const toast = m => { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 3500); };
const prog = v => { const p = $('#pg'); p.value = v; p.hidden = v >= 1; };
const copy = async t => { try { await navigator.clipboard.writeText(t); toast('Tersalin'); } catch { toast('Gagal menyalin'); } };

const ttl = $('#ttl'); ttl.value = localStorage.ttl || '0';
ttl.onchange = () => localStorage.ttl = ttl.value;
const exp = () => +ttl.value ? new Date(Date.now() + ttl.value * 1000).toISOString() : null;

// ---------- kirim teks & file ----------
async function sendText() {
  const t = $('#txt').value.trim(); if (!t) return;
  const { error } = await sb.from('items').insert({ kind: 'text', content: t, expires_at: exp() });
  if (error) return toast('Gagal kirim: ' + error.message);
  $('#txt').value = '';
}

async function shrink(f) {
  if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size < 3e5) return f;
  const b = await createImageBitmap(f), k = Math.min(1, 1600 / Math.max(b.width, b.height));
  const c = document.createElement('canvas'); c.width = b.width * k; c.height = b.height * k;
  c.getContext('2d').drawImage(b, 0, 0, c.width, c.height);
  const o = await new Promise(r => c.toBlob(r, 'image/jpeg', .82));
  return o && o.size < f.size ? new File([o], f.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : f;
}

async function sendFile(f) {
  if (f.type.startsWith('image/') && $('#cmp').checked) f = await shrink(f);
  if (f.size > MAX) return toast(f.name + ' lebih dari 50 MB. Pakai "Kirim langsung".');
  toast('Mengunggah ' + f.name + '…');
  const path = crypto.randomUUID() + '/' + f.name.replace(/[^\w.\-]/g, '_');
  const up = await sb.storage.from(BUCKET).upload(path, f, { contentType: f.type || 'application/octet-stream' });
  if (up.error) return toast('Gagal unggah: ' + up.error.message);
  await sb.from('items').insert({ kind: 'file', file_path: path, file_name: f.name, file_size: f.size, mime: f.type, expires_at: exp() });
  toast('Terkirim');
}

// ---------- daftar kiriman ----------
async function del(i, quiet) {
  if (i.file_path) await sb.storage.from(BUCKET).remove([i.file_path]);
  await sb.from('items').delete().eq('id', i.id);
  if (!quiet) load();
}

function render(list) {
  const box = $('#list'); box.replaceChildren(); $('#empty').hidden = list.length > 0;
  for (const i of list) {
    const a = h('article', {}, h('small', { textContent: ago(i.created_at) + (i.kind === 'file' ? ' · ' + fmt(i.file_size) : '') }));
    const row = h('div', { className: 'row' }); row.style.marginTop = 0;
    if (i.kind === 'text') {
      a.append(h('pre', { textContent: i.content }));
      row.append(h('button', { textContent: 'Salin', className: 'pri', onclick: () => copy(i.content) }));
    } else {
      const url = sb.storage.from(BUCKET).getPublicUrl(i.file_path, { download: i.file_name }).data.publicUrl;
      if ((i.mime || '').startsWith('image/')) a.append(h('img', { src: url.split('?')[0], loading: 'lazy', alt: i.file_name }));
      a.append(h('pre', {}, h('a', { href: url, textContent: i.file_name })));
      row.append(h('button', { textContent: 'Unduh', className: 'pri', onclick: () => location.href = url }));
    }
    row.append(h('button', { textContent: 'Hapus', className: 'del', onclick: () => del(i) }));
    a.append(row); box.append(a);
  }
}

async function load() {
  const { data, error } = await sb.from('items').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) return toast('Gagal memuat: ' + error.message);
  const dead = data.filter(i => i.expires_at && Date.parse(i.expires_at) < Date.now());
  for (const i of dead) await del(i, true);
  render(data.filter(i => !dead.includes(i)));
}

// ---------- kirim langsung (WebRTC, sinyal lewat Supabase Realtime) ----------
const me = crypto.randomUUID().slice(0, 8);
let pc, queue = [];
const sig = sb.channel('p2p', { config: { broadcast: { self: false }, presence: { key: me } } });
const say = o => sig.send({ type: 'broadcast', event: 's', payload: { ...o, from: me } });

sig.on('presence', { event: 'sync' }, () => {
  const n = Object.keys(sig.presenceState()).length - 1;
  $('#peer').textContent = n > 0 ? 'Perangkat lain online' : 'Perangkat lain offline';
  $('#peer').className = n > 0 ? 'on' : ''; $('#p2p').disabled = n < 1;
}).on('broadcast', { event: 's' }, ({ payload }) => onSig(payload))
  .subscribe(s => s === 'SUBSCRIBED' && sig.track({ t: Date.now() }));

function mk() {
  queue = [];
  pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  pc.onicecandidate = e => e.candidate && say({ t: 'ice', c: e.candidate });
}
async function flush() { for (const c of queue.splice(0)) try { await pc.addIceCandidate(c); } catch {} }

async function onSig(p) {
  if (p.t === 'offer') {
    mk(); pc.ondatachannel = e => recv(e.channel);
    await pc.setRemoteDescription(p.d); await flush();
    const a = await pc.createAnswer(); await pc.setLocalDescription(a); say({ t: 'answer', d: pc.localDescription });
  } else if (p.t === 'answer') { await pc.setRemoteDescription(p.d); await flush(); }
  else if (p.t === 'ice') { if (pc && pc.remoteDescription) try { await pc.addIceCandidate(p.c); } catch {} else queue.push(p.c); }
}

async function direct(f) {
  mk(); const dc = pc.createDataChannel('f'); dc.bufferedAmountLowThreshold = 1 << 20;
  dc.onopen = async () => {
    dc.send(JSON.stringify({ name: f.name, size: f.size, type: f.type }));
    for (let o = 0; o < f.size; o += 16384) {
      if (dc.bufferedAmount > 4 << 20) await new Promise(r => dc.onbufferedamountlow = r);
      dc.send(await f.slice(o, o + 16384).arrayBuffer()); prog(o / f.size);
    }
    dc.send('end'); prog(1); toast('Terkirim langsung: ' + f.name);
  };
  const o = await pc.createOffer(); await pc.setLocalDescription(o); say({ t: 'offer', d: pc.localDescription });
  toast('Menyambungkan…');
}

function recv(ch) {
  ch.binaryType = 'arraybuffer'; let meta, parts = [], got = 0;
  ch.onmessage = e => {
    if (typeof e.data === 'string') {
      if (e.data !== 'end') { meta = JSON.parse(e.data); parts = []; got = 0; return; }
      prog(1);
      const url = URL.createObjectURL(new Blob(parts, { type: meta.type }));
      $('#rx').prepend(h('article', {}, h('small', { textContent: 'Diterima langsung · ' + fmt(meta.size) + ' · hilang saat halaman ditutup' }),
        h('pre', {}, h('a', { href: url, download: meta.name, textContent: meta.name }))));
      toast('Diterima: ' + meta.name); return;
    }
    parts.push(e.data); got += e.data.byteLength; prog(got / meta.size);
  };
}

// ---------- event ----------
$('#st').onclick = sendText;
$('#txt').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendText(); });
$('#sf').onclick = () => $('#fi').click();
$('#fi').onchange = e => { [...e.target.files].forEach(sendFile); e.target.value = ''; };
$('#p2p').onclick = () => $('#di').click();
$('#di').onchange = e => { if (e.target.files[0]) direct(e.target.files[0]); e.target.value = ''; };
addEventListener('paste', e => { const fs = [...e.clipboardData.files]; if (fs.length) { e.preventDefault(); fs.forEach(sendFile); } });
addEventListener('dragover', e => e.preventDefault());
addEventListener('drop', e => { e.preventDefault(); [...e.dataTransfer.files].forEach(sendFile); });

sb.channel('items').on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, load).subscribe();
setInterval(load, 60000);
load();
