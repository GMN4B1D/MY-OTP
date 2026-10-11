/* GMFLIX cloud.js — index.html-এর </body>-এর ঠিক আগে এই লাইনটা বসান: <script src="cloud.js"></script>
   ভিডিও MEGA-তে, ভিডিওর তালিকা GitHub-এর videos.json-এ। সবাই তালিকা দেখে MEGA প্লেয়ারে ভিডিও চালায়। */
(function () {
  const dec = b => decodeURIComponent(escape(atob(b.replace(/\s/g, ''))));
  const enc = s => btoa(unescape(encodeURIComponent(s)));
  const cfg = () => LS('cloud', {});
  const owner = location.hostname.endsWith('.github.io') ? location.hostname.split('.')[0] : '';
  const seg = location.pathname.split('/')[1] || '';
  const repoGuess = owner ? owner + '/' + (seg && !seg.includes('.') ? seg : owner + '.github.io') : '';
  const MSG = { 401: 'GitHub টোকেন ভুল বা মেয়াদ শেষ', 403: 'টোকেনে Contents: Read and write অনুমতি নেই', 404: 'রেপো পাওয়া যায়নি (রেপোর নাম আর টোকেনের রেপো মিলিয়ে দেখুন)' };
  const run = f => async (...a) => { try { await f(...a) } catch (e) { alert('হয়নি: ' + (e.message || e)) } };

  // ---- GitHub: videos.json ----
  async function api(m, p, b) {
    const c = cfg(); if (!c.repo || !c.token) throw new Error('আগে Cloud সেটিংসে রেপো আর টোকেন দিন');
    const r = await fetch('https://api.github.com/repos/' + c.repo + '/contents/' + p, { method: m, headers: { Authorization: 'Bearer ' + c.token, Accept: 'application/vnd.github+json' }, body: b ? JSON.stringify(b) : undefined });
    if (r.status === 404 && m === 'GET') return null;
    if (!r.ok) { const e = new Error(MSG[r.status] || 'GitHub ত্রুটি ' + r.status); e.status = r.status; throw e }
    return r.json();
  }
  async function rd() {
    const r = await api('GET', 'videos.json'); if (!r) return { sha: undefined, d: { videos: [] } };
    const t = r.content ? dec(r.content) : await (await fetch(r.download_url, { cache: 'no-store' })).text();
    return { sha: r.sha, d: JSON.parse(t || '{"videos":[]}') };
  }
  let local = null, lt = 0;
  function apply(d) {
    videos = (d.videos || []).slice().sort((a, b) => (b.pinned - a.pinned) || (b.created - a.created));
    renderGrid(); renderAdmin();
  }
  async function mut(fn) {
    for (let i = 0; i < 3; i++) {
      const { sha, d } = await rd(); d.videos = d.videos || []; fn(d);
      try { await api('PUT', 'videos.json', { message: 'GMFLIX update', content: enc(JSON.stringify(d)), sha }); local = d; lt = Date.now(); apply(d); return }
      catch (e) { if (e.status !== 409 && e.status !== 422) throw e }
    }
    throw new Error('একসাথে অনেক বদল হয়েছে, আবার চেষ্টা করুন');
  }
  const upd = v => mut(m => { const i = m.videos.findIndex(x => x.id === v.id); i < 0 ? m.videos.push(v) : m.videos[i] = v });

  // সবাই (লগইন ছাড়াই) পাবলিক videos.json পড়ে। নতুন সেভের পর ৩ মিনিট নিজের ডেটাই দেখায় (Pages আপডেট হতে সময় নেয়)।
  refresh = async function () {
    if (local && Date.now() - lt < 180000) return apply(local);
    try { const r = await fetch('videos.json?t=' + Date.now(), { cache: 'no-store' }); apply(r.ok ? await r.json() : { videos: [] }) }
    catch { apply({ videos: [] }) }
  };
  bg = function (v, dark) {
    if (v.poster) return 'linear-gradient(to top,rgba(0,0,0,.85),transparent 60%),url("' + v.poster + '") center/cover';
    const h = v.created % 360; return `linear-gradient(to top,hsl(${h} 50% ${dark}% / .95),hsl(${h} 60% 38% / .85))`;
  };
  const shrink = f => new Promise((ok, no) => {
    const i = new Image(), u = URL.createObjectURL(f);
    i.onload = () => { const s = Math.min(1, 320 / i.width), c = document.createElement('canvas'); c.width = i.width * s; c.height = i.height * s; c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); URL.revokeObjectURL(u); ok(c.toDataURL('image/jpeg', .7)) };
    i.onerror = () => no(new Error('পোস্টার ছবি পড়া যায়নি')); i.src = u;
  });

  // ---- MEGA প্লেয়ার (embed) ----
  const embed = l => l.includes('/file/') ? l.replace('/file/', '/embed/') : l.replace('mega.nz/#!', 'mega.nz/embed#!');
  const css = document.createElement('style');
  css.textContent = '#mf{display:none;position:absolute;inset:0;width:100%;height:100%;border:0;background:#000}#pw.m #mf{display:block}#pw.m video{display:none}#pw.m .ov{background:none;pointer-events:none}#pw.m .ov>*{display:none}#pw.m .ov>.ot{display:flex;pointer-events:auto;position:absolute;top:calc(env(safe-area-inset-top) + 8px);left:10px}#pw.m .ot b,#pw.m #gear{display:none}';
  document.head.appendChild(css);
  vid.insertAdjacentHTML('afterend', '<iframe id="mf" src="about:blank" allow="autoplay; fullscreen; encrypted-media" allowfullscreen></iframe>');
  $('dlg').addEventListener('close', () => { $('mf').src = 'about:blank' });
  const _play = play;
  play = function (v, q) {
    if (!v.mega || !user) { $('pw').classList.remove('m'); $('mf').src = 'about:blank'; return _play(v, q) }
    queue = q || []; cur = v; vid.pause(); $('pw').classList.add('m');
    $('mf').src = embed(v.mega); $('pt').textContent = (v.season ? v.season + ' · ' : '') + v.title;
    if (!$('dlg').open) $('dlg').showModal(); ping();
    const h = LS('hist:' + user, []).filter(x => x.id !== v.id); h.unshift({ id: v.id, title: v.title, at: Date.now() }); SV('hist:' + user, h.slice(0, 50));
  };

  // ---- অ্যাডমিন তালিকা ----
  row = function (v, ep) {
    const d = document.createElement('div'); d.className = 'item' + (ep ? ' ep' : '');
    d.innerHTML = '<span></span><span class="row" style="margin:0"><button class="btn s sm"></button><button class="btn s sm">Edit</button><button class="btn s sm">Poster</button><button class="btn s sm"></button><button class="btn d sm">Delete</button></span>';
    d.firstChild.textContent = (v.pinned ? '📌 ' : '') + (ep ? (v.ep || '') + '. ' : '') + v.title;
    const [p, e, po, g, x] = d.querySelectorAll('button'), L = [''].concat(G);
    p.textContent = v.pinned ? 'Unpin' : 'Pin'; g.textContent = v.genre || 'Mix';
    p.onclick = run(() => upd({ ...v, pinned: v.pinned ? 0 : 1 }));
    g.onclick = run(() => upd({ ...v, genre: L[(L.indexOf(v.genre || '') + 1) % L.length] }));
    e.onclick = run(() => { const n = prompt('নতুন টাইটেল', v.title); if (n && n.trim()) return upd({ ...v, title: n.trim() }) });
    po.onclick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = run(async () => { if (i.files[0]) return upd({ ...v, poster: await shrink(i.files[0]) }) }); i.click() };
    x.onclick = run(() => { if (confirm('"' + v.title + '" তালিকা থেকে মুছবেন? (MEGA-র ফাইল থাকবে)')) return mut(m => { m.videos = m.videos.filter(y => y.id !== v.id) }) });
    return d;
  };
  renderAdmin = function () {
    const c = $('sn').value, ss = seasons();
    $('sn').replaceChildren(...(ss.length ? ss.map(n => new Option(n, n)) : [new Option('— আগে + চেপে Season বানান —', '')]));
    if (ss.includes(c)) $('sn').value = c;
    const a = $('al'); a.innerHTML = videos.length || ss.length ? '' : '<p class="muted">কিছু নেই।</p>';
    ss.forEach(n => {
      const h = document.createElement('div'); h.className = 'item'; h.innerHTML = '<b></b><button class="btn d sm">Delete season</button>';
      h.firstChild.textContent = '📺 ' + n;
      h.lastChild.onclick = run(async () => {
        if (!confirm('"' + n + '" Season আর এর সব পার্ট তালিকা থেকে মুছবেন?')) return;
        await mut(m => { m.videos = m.videos.filter(x => x.season !== n) });
        SV('seasons', LS('seasons', []).filter(x => x !== n)); apply(local);
      });
      a.appendChild(h);
      videos.filter(v => v.season === n).sort(byEp).forEach(v => a.appendChild(row(v, true)));
    });
    videos.filter(v => !v.season).forEach(v => a.appendChild(row(v)));
  };

  // ---- MEGA আপলোড (megajs) ----
  const lib = () => window.mega ? 0 : new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://unpkg.com/megajs@1/dist/main.browser-umd.js'; s.onload = ok; s.onerror = () => no(new Error('MEGA লাইব্রেরি লোড হয়নি, নেট দেখুন')); document.head.appendChild(s) });
  async function megaUp(blob, name) {
    const c = cfg(); if (!c.me || !c.mp) throw new Error('Cloud সেটিংসে MEGA ইমেইল আর পাসওয়ার্ড দিন');
    if (blob.size > 300e6) throw new Error('ফাইল ৩০০MB-র বেশি, ব্রাউজার থেকে আপলোড নিরাপদ না। MEGA অ্যাপে আপলোড করে লিংক পেস্ট করুন');
    await lib(); note('MEGA-তে লগইন হচ্ছে...');
    const st = await new mega.Storage({ email: c.me, password: c.mp }).ready;
    note('ফাইল তৈরি হচ্ছে...'); const buf = new Uint8Array(await blob.arrayBuffer());
    const up = st.upload({ name, size: buf.length }, buf);
    up.on('progress', p => note('MEGA-তে আপলোড হচ্ছে... ' + Math.min(100, Math.round(((p && p.bytesUploaded) || 0) / buf.length * 100)) + '%'));
    return await (await up.complete).link();
  }
  $('up').onclick = async () => {
    if (!isAdmin()) return;
    const f = $('af').files[0], ln = $('ml').value.trim(), t = $('at').value.trim(), on = $('sc').checked, sea = on ? $('sn').value : '';
    if (!f && !ln) return note('ভিডিও ফাইল বাছুন, অথবা MEGA লিংক দিন');
    if (!t) return note('একটা টাইটেল দিন');
    if (on && !sea) return note('আগে + চেপে একটা Season বানিয়ে বেছে নিন');
    $('up').disabled = true;
    try {
      let link = ln;
      if (!link) { const blob = isMkv(f) ? (await convert()).mp4 : f; link = await megaUp(blob, isMkv(f) ? f.name.replace(/\.mkv$/i, '.mp4') : f.name) }
      const poster = $('pf').files[0] ? await shrink($('pf').files[0]) : '';
      const ep = sea ? (+$('se').value || Math.max(0, ...videos.filter(x => x.season === sea).map(x => x.ep || 0)) + 1) : null;
      note('GitHub-এ তালিকা সেভ হচ্ছে...');
      await mut(m => m.videos.push({ id: crypto.randomUUID(), title: t, genre: $('ag').value, season: sea || null, ep, pinned: 0, created: Date.now(), mega: link, poster }));
      note('✅ হয়ে গেছে, সবাই এখন দেখতে পাবে'); $('tk').classList.add('hide'); tr = [];
      ['at', 'af', 'pf', 'sf', 'se', 'ml'].forEach(i => $(i).value = '');
    } catch (e) { note('হয়নি: ' + (e.message || e)) }
    $('up').disabled = false;
  };

  // ---- অ্যাডমিন প্যানেলে সেটিংস বক্স ----
  $('v-admin').querySelector('h2').insertAdjacentHTML('afterend',
    '<div class="glass p"><b>Cloud সেটিংস</b><p class="muted">এগুলো শুধু এই ফোনের ব্রাউজারে থাকে, সাইটের কোডে নয়।</p>' +
    '<div class="row"><input id="kr" placeholder="GitHub রেপো (যেমন GMN4B1D/gmn4b1d.github.io)" autocomplete="off"></div>' +
    '<div class="row"><input id="kt" type="password" placeholder="GitHub টোকেন (github_pat_...)" autocomplete="off"></div>' +
    '<div class="row"><input id="km" placeholder="MEGA ইমেইল" autocomplete="off"></div>' +
    '<div class="row"><input id="kp" type="password" placeholder="MEGA পাসওয়ার্ড" autocomplete="off"></div>' +
    '<div class="row"><button class="btn" id="ks">Save & Test</button><span id="kst" class="muted"></span></div></div>');
  const c0 = cfg(); $('kr').value = c0.repo || repoGuess; $('kt').value = c0.token || ''; $('km').value = c0.me || ''; $('kp').value = c0.mp || '';
  $('ks').onclick = async () => {
    const c = { repo: $('kr').value.trim(), token: $('kt').value.trim(), me: $('km').value.trim(), mp: $('kp').value }; SV('cloud', c);
    $('kst').textContent = 'যাচাই হচ্ছে...';
    try {
      const r = await fetch('https://api.github.com/repos/' + c.repo, { headers: { Authorization: 'Bearer ' + c.token } });
      if (!r.ok) throw new Error(MSG[r.status] || 'GitHub ত্রুটি ' + r.status);
      $('kst').textContent = '✅ GitHub রেপো পাওয়া গেছে';
    } catch (e) { $('kst').textContent = '❌ ' + (e.message || e) }
  };
  $('af').closest('.row').insertAdjacentHTML('afterend', '<div class="row"><input id="ml" placeholder="অথবা MEGA শেয়ার লিংক পেস্ট করুন (ফাইল বাছা লাগবে না)"></div>');
  $('sf').closest('.row').insertAdjacentHTML('beforebegin', '<p class="muted" style="color:#ffd60a">⚠ MEGA প্লেয়ারে সাবটাইটেল/অডিও ভাষা বাছাই কাজ করে না। MKV-র সবকিছু MP4-তে থাকলেও MEGA প্লেয়ার শুধু ডিফল্ট ট্র্যাক চালায়।</p>');
})();
