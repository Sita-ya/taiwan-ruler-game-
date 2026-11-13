/* 教師控制台 + 投影模式 */
(function () {
  const C = CONFIG, A = App, $ = A.$, fmt = A.fmt, esc = A.esc;
  const root = $('#app'), projEl = $('#proj');
  let CODE = null, M = null, unsub = null, tab = 'ctrl', projMode = false, exporting = false;
  let setDraft = null;
  let createDraft ={ n: 6, cs: C.countryOrder.slice() };
  const DEFAULTS = { 4: ['KE', 'IN', 'JP', 'TW'], 5: ['KE', 'IN', 'JP', 'US', 'TW'], 6: C.countryOrder.slice() };

  /* ---------- 密碼 ---------- */
  const hash = async s => { try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('sg:' + s)); return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join(''); } catch (e) { return 'p:' + btoa(unescape(encodeURIComponent(s))); } };
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  function showLogin() {
    const has = lsGet('sgPw', null);
    root.innerHTML = `<div class="center-card login"><h1>🧭 教師控制台</h1><h2>世界的尺：背包客生存挑戰</h2>
      <p>${has ? '請輸入教師密碼' : '第一次使用，請自訂一組教師密碼（只存在這台電腦）'}</p>
      <input id="pw" type="password" class="code-input" placeholder="密碼" autocomplete="off">
      ${has ? '' : '<input id="pw2" type="password" class="code-input" placeholder="再輸入一次" autocomplete="off">'}
      <button class="btn primary big" data-act="login">${has ? '進入' : '設定並進入'}</button>
      ${DB.demo ? '<p class="warn">⚠ 目前是「本機示範模式」（還沒填 Firebase 設定），只能在同一台電腦測試。</p>' : ''}</div>`;
  }
  async function doLogin() {
    const has = lsGet('sgPw', null), p = $('#pw').value;
    if (!p) return A.toast('請輸入密碼');
    if (has) { if ((await hash(p)) !== has) return A.toast('密碼不對'); }
    else { if (p.length < 4) return A.toast('密碼至少 4 個字'); if (p !== $('#pw2').value) return A.toast('兩次輸入不一樣'); lsSet('sgPw', await hash(p)); }
    try { sessionStorage.setItem('sgTeacherOk', '1'); } catch (e) {}
    showHome();
  }

  /* ---------- 首頁：開新局 / 歷史紀錄 ---------- */
  async function showHome() {
    if (unsub) { unsub(); unsub = null; }
    CODE = null; M = null;
    const now = Date.now(), limit = C.retainDays * 86400000;
    let hist = lsGet('sgHist', []);
    const old = hist.filter(h => now - h.createdAt > limit);
    hist = hist.filter(h => now - h.createdAt <= limit);
    lsSet('sgHist', hist);
    old.forEach(h => DB.remove('rooms/' + h.code).catch(() => {}));
    const cs = createDraft;
    root.innerHTML = `<div class="home">
      <h1>🧭 世界的尺：背包客生存挑戰　<small>教師控制台</small></h1>
      <section class="panel"><h2>開新的一局</h2>
        <div class="row">本局組數：${[4, 5, 6].map(n => `<label class="pill"><input type="radio" name="gc" value="${n}" ${cs.n === n ? 'checked' : ''}> ${n} 組</label>`).join('')}</div>
        <div class="row">使用的國家（要剛好選 <b id="needN">${cs.n}</b> 個）：<span id="csBox">${csBoxHTML(cs)}</span></div>
        <button class="btn primary big" data-act="create">開始新的一局</button></section>
      <section class="panel"><h2>歷史紀錄（保留 ${C.retainDays} 天）</h2>
        ${hist.length ? `<table class="hist"><tr><th>房間代碼</th><th>建立時間</th><th>組數</th><th></th></tr>${hist.slice().reverse().map(h => `<tr><td><b>${h.code}</b></td><td>${new Date(h.createdAt).toLocaleString('zh-TW')}</td><td>${h.groupCount}</td><td><button class="btn" data-act="open" data-code="${h.code}">打開</button> <button class="btn ghost" data-act="forget" data-code="${h.code}">移除</button></td></tr>`).join('')}</table>` : '<p>還沒有紀錄。</p>'}
        <div class="row">用代碼打開房間：<input id="openCode" class="mini-input" maxlength="4" inputmode="numeric" placeholder="4 位數"> <button class="btn" data-act="openCode">打開</button></div></section>
      <p class="muted">教師密碼只存在這台電腦。<button class="btn ghost" data-act="resetpw">重設密碼</button> <button class="btn ghost" data-act="logout">登出</button></p></div>`;
  }
  const csBoxHTML = cs => C.countryOrder.map(cc => `<label class="pill"><input type="checkbox" class="cs" value="${cc}" ${cs.cs.includes(cc) ? 'checked' : ''} ${cs.n === 6 ? 'disabled' : ''}> ${A.flag(cc, 'chip-flag')}${A.cname(cc)}</label>`).join('');

  async function createRoom() {
    const cs = createDraft.cs;
    if (cs.length !== createDraft.n) return A.toast(`請剛好選 ${createDraft.n} 個國家`);
    if (cs.indexOf('TW') < 0 && createDraft.n < 6) { if (!(await A.confirm('沒有選到台灣（對照組），確定嗎？', '確定'))) return; }
    let code, tries = 0;
    do { code = String(Math.floor(1000 + Math.random() * 9000)); tries++; } while ((await DB.get('rooms/' + code)) && tries < 30);
    const countries = {}; cs.forEach(k => countries[k] = true);
    const createdAt = Date.now();
    await DB.set('rooms/' + code, { owner: DB.uid, createdAt, state: { step: 0, sub: 0, paused: false, groupCount: createDraft.n, countries } });
    const hist = lsGet('sgHist', []); hist.push({ code, createdAt, groupCount: createDraft.n }); lsSet('sgHist', hist);
    openRoom(code);
  }

  /* ---------- 房間 ---------- */
  async function openRoom(code) {
    const ex = await DB.get(`rooms/${code}/state`);
    if (!ex) return A.toast('找不到這個房間（可能已超過保留期限）');
    const hist = lsGet('sgHist', []);
    if (!hist.find(h => h.code === code)) { const m = await DB.get(`rooms/${code}`); hist.push({ code, createdAt: (m && m.createdAt) || Date.now(), groupCount: ex.groupCount }); lsSet('sgHist', hist); }
    if (unsub) unsub();
    CODE = code; tab = 'ctrl'; M = null;
    unsub = DB.on('rooms/' + code, v => { M = v; if (!v) { A.toast('房間已被刪除'); return showHome(); } renderAll(); });
  }
  const own = () => M && M.owner === DB.uid;
  const ST = (p, v) => own() ? DB.set(`rooms/${CODE}/state/${p}`, v) : (A.toast('這個房間不是用這台電腦／瀏覽器開的，只能檢視'), Promise.resolve());
  const state = () => M.state;
  const nGroups = () => state().groupCount;
  const gl = () => Array.from({ length: nGroups() }, (_, i) => i + 1);
  const grp = n => (M.groups && M.groups[n]) || {};
  const asg = n => state().assign && state().assign[n];
  const ccList = () => C.countryOrder.filter(k => state().countries && state().countries[k]);
  const maxSub = () => Proj.maxSub(M);
  const joinedCount = () => gl().filter(n => grp(n).uid).length;
  const allDone = () => { const s = state().step; return s >= 2 && s <= 5 && gl().every(n => App.status(s, grp(n)) === 'done'); };
  let lastPv = null, lastProj = null;   // 上一次畫的 {step, sub}，用來判斷要不要播動畫
  const mark = () => ({ step: state().step, sub: state().sub || 0 });

  /* 導覽 */
  function next() {
    const s = state();
    if (s.step === 6 && s.sub < maxSub()) return ST('sub', s.sub + 1);
    if (s.step >= 7) return;
    if (s.step === 1 && !gl().every(n => asg(n))) return A.toast('還有組別沒有分到國家，請先抽籤');
    return DB.update(`rooms/${CODE}/state`, { step: s.step + 1, sub: 0 });
  }
  function prev() {
    const s = state();
    if (s.step === 6 && s.sub > 0) return ST('sub', s.sub - 1);
    if (s.step <= 0) return;
    return DB.update(`rooms/${CODE}/state`, { step: s.step - 1, sub: s.step - 1 === 6 ? maxSub() : 0 });
  }
  const togglePause = () => ST('paused', !state().paused);

  /* ---------- 繪製 ---------- */
  function renderAll() {
    if (!M) return;
    if (!projMode) renderCtrl();
    renderProj();
  }
  function renderCtrl() {
    const s = state(), step = s.step;
    let h = `<div class="ctrl-top">
      <div class="ctrl-brand"><div class="ctrl-title">🧭 ${esc(C.title)}</div>
        <div class="room-code">房間代碼 <b>${CODE}</b><small>${joinedCount()} / ${nGroups()} 組已加入</small></div></div>
      <div class="tabs"><button class="tab ${tab === 'ctrl' ? 'on' : ''}" data-act="tab" data-t="ctrl">控制台</button><button class="tab ${tab === 'poster' ? 'on' : ''}" data-act="tab" data-t="poster">海報總覽</button></div>
      <button class="btn pausebtn ${s.paused ? 'on' : ''}" data-act="pause">${s.paused ? '▶ 解除暫停' : '👀 全班暫停'}</button>
      <button class="btn" data-act="projwin" title="開一個只有投影畫面的新視窗，拖到電子白板後按「⛶ 全螢幕」（電腦螢幕設定成「延伸」時使用）">🖥 開啟投影視窗</button>
      <button class="btn" data-act="proj" title="這個視窗直接切換成投影畫面（電腦螢幕設定成「複製」時使用）">📽 投影模式</button>
      <button class="btn fsbtn ${s.fs ? 'on' : ''}" data-act="fs" title="學生平板會出現『點一下進入全螢幕』，再按一次關閉">${s.fs ? '📱 平板全螢幕 ✓' : '📱 平板全螢幕'}</button>
      <button class="btn ghost" data-act="home">← 首頁</button></div>`;
    if (!own()) h += '<div class="banner">👁 這個房間不是用這台電腦／瀏覽器建立的，只能檢視與匯出海報，無法控制。</div>';
    if (tab === 'poster') { root.innerHTML = h + posterTabHTML(); mountThumbs(); return; }
    h += '<div class="ctrl-main"><nav class="steplist">' + C.steps.map((x, i) => `<button class="stepbtn ${i === step ? 'on' : ''} ${i < step ? 'past' : ''}" data-act="jump" data-i="${i}"><b>${i}</b> ${esc(x.title)}</button>`).join('') + '</nav>';
    h += `<div class="stepbody"><h2>步驟 ${step}：${esc(C.steps[step].title)}${step === 6 ? `　<small>（顯示進度 ${s.sub} / ${maxSub()}）</small>` : ''}</h2>
      <div class="tip"><span>🗣 教師口白（只有你看得到）</span>${esc(C.steps[step].tip)}</div>`;
    h += stepControls();
    h += `<div class="navbtns"><button class="btn big" data-act="prev" ${step === 0 && s.sub === 0 ? 'disabled' : ''}>◀ 上一步</button>
      <button class="btn primary big ${allDone() ? 'pulse' : ''}" data-act="next" ${step === 7 ? 'disabled' : ''}>${allDone() ? '✅ 全部完成　' : ''}${step === 6 && s.sub < maxSub() ? '顯示下一個 ▶' : '下一步 ▶'}</button></div>`;
    h += '<h3>各組狀態</h3><div class="gcards">' + gl().map(groupCard).join('') + '</div>';
    h += `<p class="muted"><button class="btn ghost" data-act="restart">🔄 重新開始（清空所有組別的作答）</button></p></div>`;
    h += `<aside class="pv"><div class="pv-label">📽 投影幕目前的畫面 <small>（點一下進入投影模式）</small></div>
      <div class="pv-box" id="pvBox" data-act="proj"><div class="pj-stage pv-stage">${Proj.render(M, Proj.env(CODE), lastPv)}</div></div></aside></div>`;
    lastPv = mark();
    root.innerHTML = h;
    fitPreview();
  }
  /* 控制台右側的投影預覽：同一份 1920×1080 畫面縮小顯示 */
  function fitPreview() {
    const box = $('#pvBox'); if (!box) return;
    const w = box.clientWidth;
    box.style.height = w * 1080 / 1920 + 'px';
    Proj.fit(box.firstElementChild, w, w * 1080 / 1920);
  }
  function stepControls() {
    const s = state(), step = s.step;
    if (step <= 1) {
      let h = '';
      if (step === 0) {
        const dn = setDraft ? setDraft.n : s.groupCount, dc = setDraft ? setDraft.cs : ccList();
        h += `<div class="panel mini"><b>本局設定</b>（開始之後不能改；改完要按「套用設定」）<div class="row">組數：${[4, 5, 6].map(n => `<label class="pill"><input type="radio" name="sgc" value="${n}" ${dn === n ? 'checked' : ''}> ${n} 組</label>`).join('')}</div>
          <div class="row">國家：${C.countryOrder.map(cc => `<label class="pill"><input type="checkbox" class="sc" value="${cc}" ${dc.includes(cc) ? 'checked' : ''}> ${A.flag(cc, 'chip-flag')}${A.cname(cc)}</label>`).join('')} <button class="btn" data-act="applySettings">套用設定</button></div></div>`;
      } else {
        h += `<div class="panel mini"><button class="btn primary big" data-act="draw">🎲 抽籤分配國家</button><div class="assign-list">` +
          gl().map(n => `<label>第 ${n} 組 <select class="keep" data-act="assign" data-n="${n}"><option value="">（未分配）</option>${ccList().map(cc => `<option value="${cc}" ${asg(n) === cc ? 'selected' : ''}>${A.cname(cc)}</option>`).join('')}</select></label>`).join('') + '</div>';
        const vals = gl().map(asg).filter(Boolean);
        if (new Set(vals).size !== vals.length) h += '<p class="warn">⚠ 有國家被分配給不只一組</p>';
        h += '</div>';
      }
      return h;
    }
    if (step === 5) return `<div class="panel mini">第二回合預算：每天 3 美元 ≈ <b>${C.wbLineTWD}</b> 元</div>`;
    if (step === 6) return `<div class="panel mini">每按一次「顯示下一個」，投影幕上就多出一個國家（由小到大）；最後依序出現世界銀行線、提問、各組剩下的錢。</div>`;
    if (step === 7) return `<div class="panel mini"><button class="btn primary" data-act="tab" data-t="poster">前往海報總覽 ▶</button></div>`;
    return '';
  }
  function groupCard(n) {
    const s = state(), g = grp(n), cc = asg(n), st = App.status(s.step, g);
    const joined = !!g.uid;
    return `<div class="gcard ${st} ${joined ? '' : 'offline'}" ${cc ? `style="--cc:${C.countries[cc].color}"` : ''}>
      <div class="g-top"><b>第 ${n} 組</b> ${cc ? A.flag(cc, 'chip-flag') + A.cname(cc) : '<span class="muted">未分配</span>'}</div>
      <div class="g-st"><span class="dot ${joined ? 'on' : ''}"></span>${joined ? '已連線' : '未加入'}　<span class="chip-st ${st}">${st === 'na' ? '—' : App.statusLabel[st]}</span>${s.frozen && s.frozen[n] ? ' 🔒' : ''}${s.fs && joined ? (g.fs ? ' <span class="fs-ok">⛶ 全螢幕</span>' : ' <span class="fs-no">⚠ 未全螢幕</span>') : ''}</div>
      <div class="g-btns"><button class="btn sm" data-act="kick" data-n="${n}" ${joined ? '' : 'disabled'}>踢出</button>
        <button class="btn sm" data-act="freeze" data-n="${n}">${s.frozen && s.frozen[n] ? '解鎖' : '鎖定'}</button>
        <button class="btn sm" data-act="redo" data-n="${n}" data-r="1">重做第1回合</button><button class="btn sm" data-act="redo" data-n="${n}" data-r="2">重做第2回合</button></div></div>`;
  }

  /* ----- 海報總覽 ----- */
  function posterTabHTML() {
    const list = gl().filter(n => asg(n));
    if (!list.length) return '<div class="center-card"><p>還沒有分配國家，尚無海報。</p></div>';
    return `<div class="poster-tab"><div class="row"><button class="btn primary big" data-act="exportAll" ${exporting ? 'disabled' : ''}>${exporting ? '產生中，請稍候…' : '⬇️ 全部匯出（多頁 PDF，每組一頁 A3）'}</button><span class="muted">按下縮圖可只匯出該組。海報資料來自雲端，以後也能從歷史紀錄重新匯出。</span></div>
      <div class="thumbs">${list.map(n => `<div class="thumb" data-act="exportOne" data-n="${n}"><div class="th-cap">第 ${n} 組・${A.cname(asg(n))}</div><div class="th-box" id="th${n}"></div></div>`).join('')}</div></div>`;
  }
  function mountThumbs() { gl().filter(n => asg(n)).forEach(n => { const el = $('#th' + n); if (el) A.mountPoster(el, A.posterHTML(asg(n), n, grp(n)), 300); }); }
  async function doExport(list, fname) {
    if (exporting) return; exporting = true; renderCtrl();
    try { await A.exportPDF(list.map(n => ({ html: A.posterHTML(asg(n), n, grp(n)) })), fname, (i, t) => A.toast(`已完成 ${i} / ${t} 頁`)); }
    catch (e) { console.error(e); A.toast('匯出失敗：' + (e.message || e)); }
    exporting = false; renderCtrl();
  }

  /* ---------- 投影模式（畫面內容在 projection.js，和投影視窗共用） ---------- */
  function renderProj() {
    if (!M) return;
    projEl.classList.toggle('hidden', !projMode);
    document.body.classList.toggle('proj-on', projMode);
    if (!projMode) { lastProj = null; return; }
    projEl.innerHTML = `<div id="pjs" class="pj-stage">${Proj.render(M, Proj.env(CODE), lastProj)}</div>` + '<div class="pj-hint">→ 空白鍵 下一步　← 上一步　P 暫停　Esc 離開</div>';
    lastProj = mark();
    Proj.fit($('#pjs'));
  }
  const refit = () => { Proj.fit($('#pjs')); fitPreview(); };
  window.addEventListener('resize', refit);
  document.addEventListener('visibilitychange', refit);
  try { new ResizeObserver(refit).observe(document.documentElement); } catch (e) {}
  document.addEventListener('fullscreenchange', refit);
  document.addEventListener('webkitfullscreenchange', refit);

  /* 獨立投影視窗：固定視窗名稱，重複按只會叫回同一個視窗 */
  function openProjector() {
    const url = new URL('projector.html?room=' + CODE + (DB.demo ? '&local=1' : ''), location.href).href;
    const w = window.open(url, 'sg_projector', 'popup,width=1280,height=760');
    if (!w) return A.alert('瀏覽器擋下了新視窗：請在網址列右邊允許「彈出式視窗」後再按一次。');
    try { w.focus(); } catch (e) {}
    A.toast('已開啟投影視窗：把它拖到電子白板，再按視窗裡的「⛶ 全螢幕」。');
  }

  /* ---------- 事件 ---------- */
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id === 'pw') return $('[data-act=login]').click();
    if (!projMode || !M || !own()) { if (projMode && e.key === 'Escape') { projMode = false; renderAll(); } return; }
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    else if (e.key === 'p' || e.key === 'P') togglePause();
    else if (e.key === 'Escape') { projMode = false; if (document.fullscreenElement) document.exitFullscreen(); renderAll(); }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.name === 'gc') { createDraft.n = +t.value; createDraft.cs = DEFAULTS[createDraft.n].slice(); $('#needN').textContent = createDraft.n; $('#csBox').innerHTML = csBoxHTML(createDraft); }
    else if (t.classList.contains('cs')) { createDraft.cs = $$('.cs:checked').map(x => x.value); }
    else if (t.name === 'sgc') { const n = +t.value, d = DEFAULTS[n]; $$('.sc').forEach(x => { x.checked = d.includes(x.value); }); setDraft = { n, cs: d.slice() }; }
    else if (t.classList.contains('sc')) { setDraft = { n: +($('[name=sgc]:checked') || {}).value, cs: $$('.sc:checked').map(x => x.value) }; }
    else if (t.dataset && t.dataset.act === 'assign') { t.blur(); ST('assign/' + t.dataset.n, t.value || null); }
  });
  const $$ = A.$$;
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b || b.tagName === 'SELECT') return;
    const d = b.dataset, act = d.act;
    if (act === 'login') return doLogin();
    if (act === 'create') return createRoom();
    if (act === 'open') return openRoom(d.code);
    if (act === 'openCode') { const c = $('#openCode').value.trim(); return /^\d{4}$/.test(c) ? openRoom(c) : A.toast('請輸入 4 位數代碼'); }
    if (act === 'forget') { lsSet('sgHist', lsGet('sgHist', []).filter(h => h.code !== d.code)); return showHome(); }
    if (act === 'logout') { try { sessionStorage.removeItem('sgTeacherOk'); } catch (e) {} return showLogin(); }
    if (act === 'resetpw') { if (await A.confirm('要重設教師密碼嗎？', '重設')) { try { localStorage.removeItem('sgPw'); } catch (e) {} showLogin(); } return; }
    if (!M) return;
    if (act === 'tab') { tab = d.t; return renderCtrl(); }
    if (act === 'home') return showHome();
    if (act === 'proj') { projMode = true; renderAll(); try { document.documentElement.requestFullscreen(); } catch (e) {} return; }
    if (act === 'projwin') return openProjector();
    if (act === 'exportAll') return doExport(gl().filter(asg), `世界的尺_房間${CODE}_全部海報.pdf`);
    if (act === 'exportOne') return doExport([+d.n], `第${d.n}組_${A.cname(asg(+d.n))}_海報.pdf`);
    if (!own()) return A.toast('只能檢視，無法控制這個房間');
    if (act === 'pause') return togglePause();
    if (act === 'fs') { const on = !state().fs; await ST('fs', on); return A.toast(on ? '學生平板會出現「點一下進入全螢幕」，請學生點一下。' : '已關閉平板全螢幕，學生平板會離開全螢幕。'); }
    if (act === 'next') return next();
    if (act === 'prev') return prev();
    if (act === 'jump') return DB.update(`rooms/${CODE}/state`, { step: +d.i, sub: +d.i === 6 ? 0 : 0 });
    if (act === 'draw') {
      const list = ccList().slice(); for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
      const a = {}; gl().forEach((n, i) => a[n] = list[i]); return ST('assign', a);
    }
    if (act === 'applySettings') {
      const n = +($('[name=sgc]:checked') || {}).value, cs = $$('.sc:checked').map(x => x.value);
      if (cs.length !== n) return A.toast(`請剛好選 ${n} 個國家`);
      const countries = {}; cs.forEach(k => countries[k] = true);
      setDraft = null;
      await DB.update(`rooms/${CODE}/state`, { groupCount: n, countries, assign: null });
      return A.toast('已套用設定');
    }
    if (act === 'kick') { if (await A.confirm(`要把第 ${d.n} 組踢出嗎？它的進度會保留，可用另一台平板重新加入。`, '踢出')) { await DB.set(`rooms/${CODE}/groups/${d.n}/uid`, null); A.toast('已踢出'); } return; }
    if (act === 'freeze') return ST('frozen/' + d.n, (state().frozen && state().frozen[d.n]) ? null : true);
    if (act === 'redo') { if (await A.confirm(`要清除第 ${d.n} 組的「第${d.r}回合」採買紀錄，讓他們重新採買嗎？`, '清除重做')) { await DB.remove(`rooms/${CODE}/groups/${d.n}/r${d.r}`); } return; }
    if (act === 'restart') {
      if (!(await A.confirm('重新開始會清空所有組別的作答，並回到大廳。確定嗎？', '重新開始'))) return;
      for (const n of gl()) { await DB.update(`rooms/${CODE}/groups/${n}`, { ans: null, r1: null, r2: null }); }
      await DB.update(`rooms/${CODE}/state`, { step: 0, sub: 0, paused: false, assign: null, frozen: null });
    }
  });

  /* ---------- 啟動 ---------- */
  DB.ready.then(() => {
    let ok = false; try { ok = sessionStorage.getItem('sgTeacherOk') === '1'; } catch (e) {}
    ok && lsGet('sgPw', null) ? showHome() : showLogin();
  }).catch(err => { root.innerHTML = `<div class="center-card"><h1>連線失敗</h1><p>${esc(err.message || err)}</p></div>`; });
})();
