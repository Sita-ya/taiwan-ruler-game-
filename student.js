/* 學生端 */
(function () {
  const C = CONFIG, A = App, $ = A.$, fmt = A.fmt, esc = A.esc;
  const root = $('#app');
  let R = null, N = null;          // 房間代碼、組別
  let S = null, G = null;          // 老師的狀態、本組資料
  let gotState = false, gotGroup = false;
  let unsubs = [];
  let viewCC = null;               // 搜尋站目前看的國家
  let draft = '';                  // 答案輸入框
  let hint = '';
  let joinDraft = '';

  const ses = {
    // 示範模式：每個分頁當作一台平板（用 sessionStorage）；正式模式用 localStorage（重開瀏覽器也能接續）
    st() { return DB.demo ? sessionStorage : localStorage; },
    get() { try { return JSON.parse(this.st().getItem('sgSession')); } catch (e) { return null; } },
    set(v) { try { this.st().setItem('sgSession', JSON.stringify(v)); } catch (e) {} },
    clear() { try { this.st().removeItem('sgSession'); } catch (e) {} }
  };
  const gp = p => `rooms/${R}/groups/${N}` + (p ? '/' + p : '');
  const W = (p, v) => DB.set(gp(p), v);

  DB.onConnection(ok => { $('#conn').className = 'conn ' + (ok ? 'ok' : 'bad'); $('#conn').title = ok ? '已連線' : '連線中斷，重新連線後會自動同步'; });
  A.preload();

  /* ---------- 加入流程 ---------- */
  function showJoin(msg, code) {
    unsub();
    R = null; N = null; S = null; G = null; gotState = gotGroup = false;
    joinDraft = code || joinDraft || (new URLSearchParams(location.search).get('room') || '');
    root.innerHTML = `<div class="center-card join">
      <h1>🎒 世界的尺</h1><h2>背包客生存挑戰</h2>
      ${msg ? `<p class="warn">${esc(msg)}</p>` : ''}
      <p>請輸入老師投影幕上的 4 位數房間代碼</p>
      <input id="code" class="code-input" inputmode="numeric" maxlength="4" value="${esc(joinDraft)}" placeholder="0000">
      <button class="btn primary big" data-act="code">下一步</button></div>`;
  }
  async function stepGroups(code) {
    const st = await DB.get(`rooms/${code}/state`);
    if (!st) { showJoin('找不到這個房間，請再確認代碼', code); return; }
    const groups = (await DB.get(`rooms/${code}/groups`)) || {};
    let h = `<div class="center-card join"><h1>房間 ${esc(code)}</h1><p>請選擇你們是第幾組</p><div class="group-pick">`;
    for (let i = 1; i <= st.groupCount; i++) {
      const u = groups[i] && groups[i].uid;
      const taken = u && u !== DB.uid;
      h += `<button class="btn ${taken ? 'disabled' : 'primary'} big" ${taken ? 'disabled' : ''} data-act="group" data-code="${code}" data-n="${i}">第 ${i} 組${taken ? '<small>已有平板</small>' : (u ? '<small>回到這組</small>' : '')}</button>`;
    }
    h += `</div><button class="btn ghost" data-act="back">換房間代碼</button></div>`;
    root.innerHTML = h;
  }
  async function join(code, n) {
    const existing = await DB.get(`rooms/${code}/groups/${n}/uid`);
    if (existing && existing !== DB.uid) { A.toast('這一組已經有平板加入了，請找老師'); return stepGroups(code); }
    try {
      await DB.update(`rooms/${code}/groups/${n}`, { uid: DB.uid, joined: Date.now() });
    } catch (e) { A.toast('加入失敗，這一組可能已被佔用'); return stepGroups(code); }
    ses.set({ room: code, group: n });
    start(code, n);
  }

  /* ---------- 訂閱 ---------- */
  function unsub() { unsubs.forEach(f => f()); unsubs = []; }
  function start(code, n) {
    unsub();
    R = code; N = n; S = null; G = null; gotState = gotGroup = false;
    unsubs.push(DB.on(`rooms/${R}/state`, v => { S = v; gotState = true; if (!v && gotState) { A.alert('這個房間已經不見了，請重新加入'); ses.clear(); return showJoin(); } render(); }));
    unsubs.push(DB.on(gp(), v => {
      const first = !gotGroup; gotGroup = true; G = v;
      if (!v || v.uid !== DB.uid) {
        const room = R, msg = v && v.uid ? '這一組現在是別台平板在用' : '你已經離開這一組，請重新選擇';
        ses.clear(); showJoin(msg, room);
        stepGroups(room).then(() => A.toast(msg)); return;
      }
      if (first) restoreBackup(v);
      try { localStorage.setItem(`sgBackup_${R}_${N}`, JSON.stringify(v)); } catch (e) {}
      render();
    }));
  }
  /* 雲端資料比平板備份少（例如斷線時寫入失敗）→ 把備份補回去 */
  function restoreBackup(v) {
    let b = null;
    try { b = JSON.parse(localStorage.getItem(`sgBackup_${R}_${N}`)); } catch (e) {}
    if (!b || b.uid !== v.uid) return;
    ['ans', 'r1', 'r2'].forEach(k => { if (b[k] && !v[k]) DB.set(gp(k), b[k]); });
  }

  /* ---------- 繪製 ---------- */
  function stepInfo() { return C.steps[S.step] || { title: '' }; }
  function render() {
    if (!S || !G) return;
    const cc = S.assign && S.assign[N];
    $('#pause').classList.toggle('hidden', !S.paused);
    $('#frozen').classList.toggle('hidden', !(S.frozen && S.frozen[N]) || S.paused);
    if (cc) A.setTitleFlagColor(cc);
    const head = `<div class="topbar"><div class="tb-l">${cc ? A.flag(cc, 'tb-flag') : '🎒'} 第 ${N} 組${cc ? '・' + A.cname(cc) : ''}</div><div class="tb-c">步驟 ${S.step}：${esc(stepInfo().title)}</div><div class="tb-r">房間 ${esc(R)}</div></div>`;
    let body = '';
    const st = S.step;
    if (st === 0) body = viewLobby();
    else if (!cc) body = wait('等待老師抽籤分配國家…', '⏳');
    else if (st === 1) body = viewCard(cc);
    else if (st === 2) body = viewSearch(cc);
    else if (st >= 3 && st <= 5) body = viewShop(cc, st);
    else if (st === 6) body = wait('請看大螢幕', '📺');
    else if (st === 7) body = viewPoster(cc);
    root.innerHTML = head + `<div class="stage">${body}</div>`;
    if (st === 7 && cc) A.mountPoster($('#posterBox'), A.posterHTML(cc, N, G), Math.min(window.innerWidth - 40, 640));
    const inp = $('#ans'); if (inp) { inp.value = draft; }
  }
  const wait = (msg, emoji) => `<div class="center-card"><div class="big-emoji">${emoji || '⏳'}</div><h1>${msg}</h1></div>`;

  function viewLobby() {
    return `<div class="center-card"><img class="lobby-img" src="assets/backpackers.jpg" alt="" onerror="this.outerHTML='<div class=big-emoji>🎒</div>'"><h1>第 ${N} 組已加入</h1><p class="big-p">等待老師開始…</p></div>`;
  }
  function viewCard(cc) {
    const c = C.countries[cc];
    return `<div class="passport flip-in" style="--cc:${c.color}">
      <div class="pp-head">✈️ 背包客任務卡　<small>第 ${N} 組</small></div>
      <div class="pp-body">${A.postcard(cc, 'pp-pc')}
        <div class="pp-info">${A.flag(cc, 'pp-flag')}<div class="pp-name">${c.name}</div>
        <p class="pp-task">你們是來到<b>${c.name}</b>的背包客！先找出這個國家的「及格線」。</p></div></div></div>`;
  }

  /* ----- 步驟 2：背包客搜尋站 ----- */
  function viewSearch(cc) {
    const mine = C.countries[cc], ans = G.ans || {};
    const logo = '<span style="color:#3A86C8">背</span><span style="color:#D7263D">包</span><span style="color:#E0A800">客</span><span style="color:#2E8B57">搜</span><span style="color:#3A86C8">尋</span><span style="color:#D7263D">站</span>';
    let h = `<div class="mycountry">你們的國家是 ${A.flag(cc, 'sm-flag')}<b>${mine.name}</b></div>
      <div class="search-page"><div class="s-logo">${logo}</div>
      <div class="s-bar"><span class="s-ico">🔍</span><span class="s-text">${viewCC ? C.countries[viewCC].name + ' 貧窮線' : '點下面的國家名稱，就會搜尋它的貧窮線'}</span></div>
      <div class="s-chips">${C.countryOrder.map(k => `<button class="chip ${viewCC === k ? 'on' : ''}" data-act="view" data-cc="${k}">${A.flag(k, 'chip-flag')}${C.countries[k].name}</button>`).join('')}</div>`;
    if (viewCC) h += dataCard(viewCC);
    h += '</div>';
    h += `<div class="answer-bar">${ans.ok
      ? `<div class="ans-ok">✅ 答對了！我們的國家，一天的及格線大約是 <b>${fmt(mine.daily)}</b> 元台幣。<br><small>這個數字就是第一回合的預算，請等老師的指令。</small></div>`
      : `<label>我們的國家，一天的及格線大約是 <input id="ans" class="ans-input" type="number" inputmode="numeric" min="0" placeholder="＿＿"> 元台幣</label>
         <button class="btn primary" data-act="answer">確認</button>${hint ? `<div class="hint">${esc(hint)}</div>` : ''}`}</div>`;
    return h;
  }
  function dataCard(cc) {
    const c = C.countries[cc];
    return `<div class="data-card" style="--cc:${c.color}">
      <div class="dc-top">${A.postcard(cc, 'dc-pc')}<div class="dc-title">${A.flag(cc, 'dc-flag')}<span>${c.name}${c.tag || ''}</span></div></div>
      <div class="dc-row"><span class="dc-k">這個國家怎麼定義貧窮？</span><p>${esc(c.how)}</p></div>
      <div class="dc-row"><span class="dc-k">原始金額</span><p class="dc-raw">${esc(c.raw)}</p></div>
      <div class="dc-row"><span class="dc-k">換算步驟</span><p>① 先換成「一天」：${esc(c.calc)}<br>② 再換成台幣：${esc(c.calc2)}</p></div>
      <div class="dc-big">一天大約 <b>${fmt(c.daily)}</b> 元台幣</div>
      <div class="dc-src">資料來源：${esc(c.source)}<br>${esc(C.rateNote)}</div></div>`;
  }

  /* ----- 步驟 3、4、5：採買 ----- */
  function viewShop(cc, st) {
    const round = st === 5 ? 2 : 1;
    const rd = G['r' + round] || {};
    const budget = A.budget(cc, round);
    if (round === 2 && !rd.started && !rd.cart && !rd.checkedOut) {
      return `<div class="center-card intro"><h2>🌍 世界銀行的線</h2><p class="big-p">世界銀行訂的極端貧窮線是<b>每人每天 3 美元</b>。用匯率換算，大約是 <b>${C.wbLineTWD} 元</b>台幣。</p><p class="big-p">現在用這筆錢，在<b>同一個國家</b>再買一次！</p><button class="btn primary big" data-act="startR2">開始採買</button></div>`;
    }
    if (!rd.checkedOut) return needsView(cc, round, rd, budget);
    if (!rd.storeDone && st >= 4) return storeView(cc, round, rd, budget);
    const full = !!rd.storeDone;
    const r = A.calcRound(cc, rd, budget);
    let h = '';
    if (round === 2 && rd.storeDone) {
      h = `<div class="compare"><div class="cmp-col"><h3>第一回合：用${A.cname(cc)}的及格線（${fmt(A.budget(cc, 1))} 元）</h3>${A.receiptTable(cc, G.r1, A.budget(cc, 1))}</div>
        <div class="cmp-col"><h3>第二回合：用每天 3 美元（${C.wbLineTWD} 元）</h3>${A.receiptTable(cc, G.r2, C.wbLineTWD)}</div></div>
        <div class="cmp-q">比一比：哪一次買得比較多？為什麼？</div>`;
      if (r.unaffordable) h += `<div class="reminder">💡 ${esc(C.reminderCard)}</div>`;
      return h;
    }
    h = `<div class="receipt-view"><h2>🧾 ${round === 1 ? '第一回合' : '第二回合'}收據</h2>${A.receiptTable(cc, rd, budget, { noExtras: !full })}`;
    if (r.unaffordable) h += `<div class="reminder">💡 ${esc(C.reminderCard)}</div>`;
    h += `<p class="big-p">${full ? '這一回合完成了，請等老師的指令。' : '結帳完成！請等老師的指令。'}</p></div>`;
    return h;
  }
  const moneyBar = (budget, remaining) => `<div class="moneybar"><div>今天的預算：<b>${fmt(budget)}</b> 元</div><div class="left ${remaining <= 0 ? 'zero' : ''}">剩餘金額 <b>${fmt(remaining)}</b> 元</div></div>`;

  function needsView(cc, round, rd, budget) {
    const r = A.calcRound(cc, rd, budget);
    let h = moneyBar(budget, r.remaining) + '<div class="needs">';
    r.lines.forEach(l => {
      const avail = budget - r.needsTotal + l.price;
      h += `<section class="need ${l.state}"><h3>${l.cat.icon} ${l.cat.name}<small>${l.state === 'none' ? '請做決定' : (l.state === 'skip' ? '已放棄' : '已買')}</small></h3><div class="opts">`;
      l.cat.options.forEach(o => {
        const p = C.price[cc][o.id], sel = l.opt && l.opt.id === o.id, no = !sel && p > avail;
        h += `<button class="opt ${sel ? 'sel' : ''} ${no ? 'no' : ''}" ${no ? 'disabled' : ''} data-act="pick" data-r="${round}" data-cat="${l.cat.id}" data-opt="${o.id}">
          <span class="o-name">${esc(o.name)}</span>${o.desc ? `<span class="o-desc">${esc(o.desc)}</span>` : ''}
          <span class="o-price">${fmt(p)} 元</span><span class="o-tag">${sel ? '✓ 已買（再按一次取消）' : (no ? '錢不夠' : '買下')}</span></button>`;
      });
      h += `<button class="opt giveup ${l.state === 'skip' ? 'sel' : ''}" data-act="skip" data-r="${round}" data-cat="${l.cat.id}"><span class="o-name">買不起／放棄</span><span class="o-tag">${l.state === 'skip' ? '✓ 已放棄（再按一次取消）' : ''}</span></button>`;
      h += '</div></section>';
    });
    h += '</div>';
    h += r.allDecided ? `<div class="checkout-bar"><button class="btn primary big pulse" data-act="checkout" data-r="${round}">🧾 結帳</button></div>`
      : `<div class="checkout-bar"><p>每一欄都要做決定（買下，或按「買不起／放棄」）才能結帳</p></div>`;
    return h;
  }
  function storeView(cc, round, rd, budget) {
    const r = A.calcRound(cc, rd, budget);
    const minP = Math.min(...C.store.map(s => C.price[cc][s.id]));
    let h = moneyBar(budget, r.remaining);
    h += `<div class="store-title">🏪 當地商店 <small>必需品之後，還能額外買到的東西</small></div>`;
    if (r.remaining < minP) h += `<div class="nomoney">${r.remaining <= 0 && r.extras.length === 0 ? '' : ''}沒有多的錢可以買其他東西了</div>`;
    h += '<div class="store-grid">';
    C.store.forEach(it => {
      const p = C.price[cc][it.id], q = (rd.store || {})[it.id] || 0, can = p <= r.remaining;
      h += `<div class="item ${!can && !q ? 'no' : ''}"><div class="i-icon">${it.icon}</div><div class="i-name">${esc(it.name)}</div><div class="i-price">${fmt(p)} 元</div>
        <div class="qty"><button class="qbtn" ${q ? '' : 'disabled'} data-act="qty" data-r="${round}" data-id="${it.id}" data-d="-1">−</button><span class="q">${q}</span><button class="qbtn" ${can ? '' : 'disabled'} data-act="qty" data-r="${round}" data-id="${it.id}" data-d="1">＋</button></div>
        ${!can && !q ? '<div class="i-no">錢不夠</div>' : ''}</div>`;
    });
    h += '</div>';
    h += `<div class="checkout-bar"><button class="btn primary big ${r.remaining < minP ? 'pulse' : ''}" data-act="storeDone" data-r="${round}">✅ 完成</button></div>`;
    return h;
  }

  /* ----- 步驟 7：海報 ----- */
  function viewPoster(cc) {
    return `<div class="poster-view"><h2>📄 我們的比較海報</h2><div id="posterBox" class="poster-preview"></div>
      <div class="checkout-bar"><button class="btn primary big" data-act="pdf">⬇️ 下載 PDF</button></div></div>`;
  }

  /* ---------- 事件 ---------- */
  document.addEventListener('input', e => { if (e.target.id === 'ans') draft = e.target.value; if (e.target.id === 'code') joinDraft = e.target.value; });
  document.addEventListener('keydown', e => { if (e.key === 'Enter') { if (e.target.id === 'code') $('[data-act=code]').click(); if (e.target.id === 'ans') $('[data-act=answer]').click(); } });
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const d = b.dataset, act = d.act;
    if (act === 'code') { const c = (joinDraft || '').trim(); if (!/^\d{4}$/.test(c)) return A.toast('請輸入 4 位數字'); return stepGroups(c); }
    if (act === 'back') return showJoin();
    if (act === 'group') return join(d.code, +d.n);
    if (!S || !G) return;
    if (S.paused || (S.frozen && S.frozen[N])) return;
    const cc = S.assign && S.assign[N];
    if (act === 'view') { viewCC = d.cc; hint = ''; return render(); }
    if (act === 'answer' && S.step === 2) {
      const v = parseFloat(draft);
      if (isNaN(v)) return A.toast('請先輸入一個數字');
      const ok = Math.abs(v - C.countries[cc].daily) <= C.tolerance;
      const tries = ((G.ans && G.ans.tries) || 0) + 1;
      hint = ok ? '' : '再看一次資料卡最大的數字喔！';
      await W('ans', { tries, ok, value: v });
      if (ok) draft = '';
      return;
    }
    if (act === 'startR2') return W('r2/started', true);
    const round = +d.r, rd = G['r' + round] || {};
    const budget = A.budget(cc, round);
    if (act === 'pick' || act === 'skip') {
      if (rd.checkedOut) return;
      const r = A.calcRound(cc, rd, budget);
      const line = r.lines.find(l => l.cat.id === d.cat);
      const cur = (rd.cart || {})[d.cat];
      if (act === 'skip') return W(`r${round}/cart/${d.cat}`, cur === 'skip' ? null : 'skip');
      if (cur === d.opt) return W(`r${round}/cart/${d.cat}`, null);
      if (C.price[cc][d.opt] > budget - r.needsTotal + line.price) return A.toast('錢不夠');
      return W(`r${round}/cart/${d.cat}`, d.opt);
    }
    if (act === 'checkout') {
      if (!(await A.confirm('結帳後就不能再改囉！', '確定結帳', '再想想'))) return;
      return W(`r${round}/checkedOut`, true);
    }
    if (act === 'qty') {
      if (rd.storeDone) return;
      const r = A.calcRound(cc, rd, budget), q = (rd.store || {})[d.id] || 0, dl = +d.d;
      if (dl > 0 && C.price[cc][d.id] > r.remaining) return A.toast('錢不夠');
      if (q + dl < 0) return;
      return W(`r${round}/store/${d.id}`, q + dl > 0 ? q + dl : null);
    }
    if (act === 'storeDone') {
      if (!(await A.confirm('完成後這一回合就鎖定囉！', '完成', '再逛逛'))) return;
      return W(`r${round}/storeDone`, true);
    }
    if (act === 'pdf') {
      b.disabled = true; b.textContent = '產生中…';
      try { await A.exportPDF([{ html: A.posterHTML(cc, N, G) }], `第${N}組_${A.cname(cc)}_海報.pdf`); }
      catch (err) { console.error(err); A.toast('匯出失敗，請再按一次'); }
      b.disabled = false; b.textContent = '⬇️ 下載 PDF';
    }
  });

  /* ---------- 啟動 ---------- */
  DB.ready.then(() => {
    const s = ses.get();
    if (s && s.room && s.group) start(s.room, s.group);
    else showJoin();
  }).catch(err => { root.innerHTML = `<div class="center-card"><h1>連線失敗</h1><p>${esc(err.message || err)}</p><p>請確認 Firebase 設定與網路。</p></div>`; });
})();

