(() => {
  'use strict';

  const cfg = window.APP_CONFIG;
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const $ = (id) => document.getElementById(id);
  const els = {
    text: $('text'),
    send: $('sendBtn'),
    paste: $('pasteBtn'),
    fileBtn: $('fileBtn'),
    fileInput: $('fileInput'),
    list: $('list'),
    status: $('status'),
    drop: $('drop'),
    toast: $('toast'),
  };

  let items = [];
  let lastSig = null;
  let lastRender = 0;
  let busy = false;
  const urlCache = new Map(); // path -> { url, exp }

  /* ---------- util ---------- */

  let toastTimer;
  function toast(msg, ms = 2200) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), ms);
  }

  function setStatus(ok) {
    els.status.className = 'status ' + (ok ? 'on' : 'off');
    els.status.textContent = ok ? 'Tersambung' : 'Tidak tersambung';
  }

  function uid() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function stamp() {
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  }

  function fmtSize(n) {
    if (!n && n !== 0) return '';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }

  const rtf = new Intl.RelativeTimeFormat('id', { numeric: 'auto' });
  function timeAgo(iso) {
    const s = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
    const a = Math.abs(s);
    if (a < 45) return 'baru saja';
    if (a < 3600) return rtf.format(Math.round(s / 60), 'minute');
    if (a < 86400) return rtf.format(Math.round(s / 3600), 'hour');
    return rtf.format(Math.round(s / 86400), 'day');
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      if (!ok) throw new Error('copy failed');
    }
  }

  async function toPngBlob(url) {
    const res = await fetch(url);
    const blob = await res.blob();
    if (blob.type === 'image/png') return blob;
    const bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas');
    c.width = bmp.width;
    c.height = bmp.height;
    c.getContext('2d').drawImage(bmp, 0, 0);
    return new Promise((ok, no) =>
      c.toBlob((b) => (b ? ok(b) : no(new Error('png'))), 'image/png')
    );
  }

  /* ---------- data ---------- */

  async function ensureUrls() {
    const now = Date.now();
    const need = items
      .filter((i) => i.kind === 'image' && i.file_path)
      .map((i) => i.file_path)
      .filter((p) => !urlCache.has(p) || urlCache.get(p).exp < now);
    if (!need.length) return;
    const { data, error } = await sb.storage.from(cfg.BUCKET).createSignedUrls(need, 3600);
    if (error) throw error;
    data.forEach((d) => {
      if (d.signedUrl) urlCache.set(d.path, { url: d.signedUrl, exp: now + 50 * 60 * 1000 });
    });
  }

  async function loadItems(force = false) {
    try {
      const { data, error } = await sb
        .from('items')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(cfg.LIMIT);
      if (error) throw error;
      setStatus(true);
      if (Date.now() - lastRender > 45 * 60 * 1000) force = true;
      const sig = data.map((i) => i.id).join(',');
      if (!force && sig === lastSig) return;
      lastSig = sig;
      items = data;
      await ensureUrls();
      render();
    } catch (e) {
      console.error(e);
      setStatus(false);
    }
  }

  async function sendText() {
    const value = els.text.value.trim();
    if (!value) {
      toast('Tulis atau tempel sesuatu dulu');
      return;
    }
    const { error } = await sb.from('items').insert({ kind: 'text', content: value });
    if (error) throw error;
    els.text.value = '';
  }

  async function uploadFile(file) {
    if (file.size > cfg.MAX_MB * 1024 * 1024) {
      toast(file.name + ' lebih dari ' + cfg.MAX_MB + ' MB');
      return;
    }
    const name = file.name || 'file-' + stamp();
    const safe = name.normalize('NFKD').replace(/[^\w.\-]+/g, '_').slice(-80) || 'file';
    const path = uid() + '/' + safe;
    const store = sb.storage.from(cfg.BUCKET);
    const up = await store.upload(path, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
    if (up.error) throw up.error;
    const kind = (file.type || '').startsWith('image/') ? 'image' : 'file';
    const ins = await sb.from('items').insert({
      kind,
      file_path: path,
      file_name: name,
      file_size: file.size,
      mime: file.type || null,
    });
    if (ins.error) {
      await store.remove([path]);
      throw ins.error;
    }
  }

  async function run(label, fn) {
    if (busy) return;
    busy = true;
    [els.send, els.paste, els.fileBtn].forEach((b) => (b.disabled = true));
    if (label) toast(label, 8000);
    try {
      await fn();
      toast('Terkirim');
      await loadItems(true);
    } catch (e) {
      console.error(e);
      toast('Gagal: ' + (e.message || 'coba lagi'), 3500);
    } finally {
      busy = false;
      [els.send, els.paste, els.fileBtn].forEach((b) => (b.disabled = false));
    }
  }

  const sendFiles = (files) =>
    run('Mengunggah ' + files.length + ' file…', async () => {
      for (const f of files) await uploadFile(f);
    });

  /* ---------- actions ---------- */

  async function pasteFromClipboard() {
    const files = [];
    const texts = [];
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const clip = await navigator.clipboard.read();
        for (const it of clip) {
          const img = it.types.find((t) => t.startsWith('image/'));
          if (img) {
            const blob = await it.getType(img);
            files.push(new File([blob], 'tempel-' + stamp() + '.' + (img.split('/')[1] || 'png'), { type: img }));
          } else if (it.types.includes('text/plain')) {
            texts.push(await (await it.getType('text/plain')).text());
          }
        }
      } else {
        texts.push(await navigator.clipboard.readText());
      }
    } catch (e) {
      toast('Izinkan akses clipboard, atau tempel manual ke kotak teks', 3500);
      return;
    }
    const text = texts.join('\n').trim();
    if (!files.length && !text) {
      toast('Clipboard kosong');
      return;
    }
    await run('Mengirim…', async () => {
      if (text) {
        const { error } = await sb.from('items').insert({ kind: 'text', content: text });
        if (error) throw error;
      }
      for (const f of files) await uploadFile(f);
    });
  }

  async function copyImage(item) {
    const cached = urlCache.get(item.file_path);
    if (!cached) return toast('Gambar belum siap');
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': toPngBlob(cached.url) })]);
      toast('Gambar disalin');
    } catch (e) {
      console.error(e);
      toast('Browser ini belum bisa salin gambar, pakai Unduh', 3500);
    }
  }

  async function download(item) {
    const { data, error } = await sb.storage
      .from(cfg.BUCKET)
      .createSignedUrl(item.file_path, 120, { download: item.file_name || true });
    if (error) return toast('Gagal mengunduh');
    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function remove(item) {
    try {
      if (item.file_path) {
        const { error } = await sb.storage.from(cfg.BUCKET).remove([item.file_path]);
        if (error) throw error;
        urlCache.delete(item.file_path);
      }
      const { error } = await sb.from('items').delete().eq('id', item.id);
      if (error) throw error;
      toast('Dihapus');
      await loadItems(true);
    } catch (e) {
      console.error(e);
      toast('Gagal menghapus', 3000);
    }
  }

  /* ---------- render ---------- */

  function btn(label, cls, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls || '';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function deleteButton(item) {
    let armed = false;
    let timer;
    const b = btn('Hapus', 'quiet', async () => {
      if (!armed) {
        armed = true;
        b.textContent = 'Yakin?';
        b.className = 'danger';
        timer = setTimeout(() => {
          armed = false;
          b.textContent = 'Hapus';
          b.className = 'quiet';
        }, 3000);
        return;
      }
      clearTimeout(timer);
      b.disabled = true;
      await remove(item);
    });
    return b;
  }

  function renderItem(item) {
    const el = document.createElement('article');
    el.className = 'item';
    const btns = document.createElement('div');
    btns.className = 'btns';

    if (item.kind === 'text') {
      const p = document.createElement('p');
      p.className = 'text';
      p.textContent = item.content;
      p.title = 'Ketuk untuk melihat semua';
      p.addEventListener('click', () => p.classList.toggle('open'));
      el.appendChild(p);
      btns.appendChild(
        btn('Salin', 'primary', async () => {
          try {
            await copyText(item.content);
            toast('Teks disalin');
          } catch (_) {
            toast('Gagal menyalin, tekan lama untuk memilih teks', 3500);
          }
        })
      );
    } else if (item.kind === 'image') {
      const cached = urlCache.get(item.file_path);
      if (cached) {
        const img = document.createElement('img');
        img.className = 'thumb';
        img.alt = item.file_name || 'Gambar';
        img.loading = 'lazy';
        img.src = cached.url;
        img.addEventListener('click', () => img.classList.toggle('open'));
        el.appendChild(img);
      }
      btns.appendChild(btn('Salin', 'primary', () => copyImage(item)));
      btns.appendChild(btn('Unduh', '', () => download(item)));
    } else {
      const f = document.createElement('div');
      f.className = 'file';
      const name = document.createElement('b');
      name.textContent = item.file_name || 'File';
      const meta = document.createElement('span');
      meta.textContent = fmtSize(item.file_size);
      f.append(name, meta);
      el.appendChild(f);
      btns.appendChild(btn('Unduh', 'primary', () => download(item)));
    }

    btns.appendChild(deleteButton(item));

    const foot = document.createElement('div');
    foot.className = 'foot';
    const t = document.createElement('time');
    t.dateTime = item.created_at;
    t.dataset.ts = item.created_at;
    t.textContent = timeAgo(item.created_at);
    foot.append(t, btns);
    el.appendChild(foot);
    return el;
  }

  function render() {
    lastRender = Date.now();
    els.list.textContent = '';
    if (!items.length) {
      const e = document.createElement('p');
      e.className = 'empty';
      e.textContent = 'Belum ada isi. Tempel teks atau gambar di atas untuk mulai.';
      els.list.appendChild(e);
      return;
    }
    const frag = document.createDocumentFragment();
    items.forEach((i) => frag.appendChild(renderItem(i)));
    els.list.appendChild(frag);
  }

  /* ---------- events ---------- */

  els.send.addEventListener('click', () => run('', sendText));
  els.paste.addEventListener('click', pasteFromClipboard);
  els.fileBtn.addEventListener('click', () => els.fileInput.click());
  els.fileInput.addEventListener('change', () => {
    const files = [...els.fileInput.files];
    els.fileInput.value = '';
    if (files.length) sendFiles(files);
  });

  els.text.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      run('', sendText);
    }
  });

  // Ctrl+V di mana saja: gambar/file langsung terkirim, teks masuk ke kotak
  document.addEventListener('paste', (e) => {
    const files = [...(e.clipboardData?.files || [])];
    if (files.length) {
      e.preventDefault();
      sendFiles(files);
      return;
    }
    if (document.activeElement !== els.text) {
      const t = e.clipboardData?.getData('text/plain');
      if (t) {
        e.preventDefault();
        els.text.value += (els.text.value ? '\n' : '') + t;
        els.text.focus();
      }
    }
  });

  // Seret & lepas
  let dragDepth = 0;
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  window.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth++;
    els.drop.classList.add('show');
  });
  window.addEventListener('dragover', (e) => {
    if (hasFiles(e)) e.preventDefault();
  });
  window.addEventListener('dragleave', (e) => {
    if (!hasFiles(e)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) els.drop.classList.remove('show');
  });
  window.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    els.drop.classList.remove('show');
    const files = [...e.dataTransfer.files];
    if (files.length) sendFiles(files);
  });

  /* ---------- start ---------- */

  loadItems(true);
  setInterval(() => {
    if (!document.hidden && !busy) loadItems();
  }, cfg.POLL_MS);
  setInterval(() => {
    document.querySelectorAll('time[data-ts]').forEach((t) => (t.textContent = timeAgo(t.dataset.ts)));
  }, 30000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) loadItems();
  });
})();
