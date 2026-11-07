/* 共用函式：教師端、學生端都會用到 */
(function () {
  const C = CONFIG;
  const App = {};
  window.App = App;

  App.fmt = n => (Math.round(n)).toLocaleString('en-US');
  App.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  App.$ = (s, r) => (r || document).querySelector(s);
  App.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  App.cname = cc => C.countries[cc].name;

  /* ---------- 圖片 ---------- */
  App.flagSrc = cc => 'assets/flags/' + C.countries[cc].code + '.svg';
  App.flag = (cc, cls) => `<img class="flag ${cls || ''}" src="${App.flagSrc(cc)}" alt="${App.cname(cc)}國旗">`;
  /* 明信片：圖不存在時，以國家代表色＋國旗取代 */
  App.postcard = (cc, cls) => {
    const c = C.countries[cc];
    return `<div class="pc ${cls || ''}" style="background:${c.color}"><img class="pc-flag" src="${App.flagSrc(cc)}" alt=""><img class="pc-img" src="assets/postcard_${c.code}.jpg" alt="${c.name}明信片" onerror="this.remove()"></div>`;
  };
  App.preload = () => {
    const urls = ['assets/backpackers.jpg'];
    C.countryOrder.forEach(cc => { urls.push(App.flagSrc(cc), 'assets/postcard_' + C.countries[cc].code + '.jpg'); });
    urls.forEach(u => { const i = new Image(); i.src = u; });
  };

  /* ---------- 計算 ---------- */
  App.budget = (cc, round) => round === 2 ? C.wbLineTWD : C.countries[cc].daily;
  App.calcRound = (cc, rd, budget) => {
    rd = rd || {};
    const cart = rd.cart || {}, store = rd.store || {};
    const lines = C.needs.map(cat => {
      const ch = cart[cat.id];
      const opt = cat.options.find(o => o.id === ch);
      return { cat, state: ch === 'skip' ? 'skip' : (opt ? 'buy' : 'none'), opt, price: opt ? C.price[cc][opt.id] : 0 };
    });
    const needsTotal = lines.reduce((s, l) => s + l.price, 0);
    const extras = C.store.filter(it => store[it.id] > 0).map(it => ({ item: it, qty: store[it.id], price: C.price[cc][it.id], sub: C.price[cc][it.id] * store[it.id] }));
    const extrasTotal = extras.reduce((s, e) => s + e.sub, 0);
    const total = needsTotal + extrasTotal;
    return {
      lines, needsTotal, extras, extrasTotal, total, budget,
      remaining: Math.max(0, budget - total),
      anySkip: lines.some(l => l.state === 'skip'),
      // 放棄的品項是因為「連最便宜的選項都買不起」（提醒卡只在這種情況顯示）
      unaffordable: lines.some(l => l.state === 'skip' && Math.min(...l.cat.options.map(o => C.price[cc][o.id])) > budget - needsTotal),
      allDecided: lines.every(l => l.state !== 'none'),
      anyDecided: lines.some(l => l.state !== 'none')
    };
  };
  /* 某組在某個步驟的狀態：todo / doing / done / na */
  App.status = (step, g) => {
    g = g || {};
    const r1 = g.r1 || {}, r2 = g.r2 || {}, ans = g.ans || {};
    if (step === 0 || step === 1) return g.uid ? 'done' : 'todo';
    if (step === 2) return ans.ok ? 'done' : (ans.tries > 0 ? 'doing' : 'todo');
    if (step === 3) return r1.checkedOut ? 'done' : (r1.cart ? 'doing' : 'todo');
    if (step === 4) return r1.storeDone ? 'done' : (r1.checkedOut ? 'doing' : 'todo');
    if (step === 5) return r2.storeDone ? 'done' : ((r2.started || r2.cart || r2.checkedOut) ? 'doing' : 'todo');
    return 'na';
  };
  App.statusLabel = { todo: '未開始', doing: '進行中', done: '已完成', na: '' };

  /* ---------- 收據 / 明細表 ---------- */
  App.receiptTable = (cc, rd, budget, opt) => {
    opt = opt || {};
    const r = App.calcRound(cc, rd, budget);
    let h = '<table class="rcpt"><thead><tr><th>品項</th><th class="amt">金額</th></tr></thead><tbody>';
    r.lines.forEach(l => {
      const nm = l.cat.icon + ' ' + l.cat.name + (l.opt ? '：' + l.opt.name : '');
      if (l.state === 'buy') h += `<tr><td>${App.esc(nm)}</td><td class="amt">${App.fmt(l.price)}</td></tr>`;
      else if (l.state === 'skip') h += `<tr class="skip"><td>${l.cat.icon} ${l.cat.name}：✗ 買不起／放棄</td><td class="amt"></td></tr>`;
      else h += `<tr class="skip"><td>${l.cat.icon} ${l.cat.name}：（未選）</td><td class="amt"></td></tr>`;
    });
    h += `<tr class="sub"><td>小計：必需品共</td><td class="amt">${App.fmt(r.needsTotal)} 元</td></tr>`;
    if (!opt.noExtras) {
      h += '<tr class="sep"><td colspan="2">＋ 必需品之後，還能額外買到的東西</td></tr>';
      if (r.extras.length) r.extras.forEach(e => {
        h += `<tr><td>${e.item.icon} ${App.esc(e.item.name)}${e.qty > 1 ? ' ×' + e.qty : ''}</td><td class="amt">${App.fmt(e.sub)}</td></tr>`;
      });
      else h += '<tr class="skip"><td colspan="2">（沒有多的錢可以買）</td></tr>';
      h += `<tr class="total"><td>合計花費</td><td class="amt">${App.fmt(r.total)} 元</td></tr>`;
    }
    h += `<tr class="left"><td>預算 ${App.fmt(budget)} 元，剩下</td><td class="amt ${(budget - (opt.noExtras ? r.needsTotal : r.total)) <= 0 ? 'zero' : ''}">${App.fmt(Math.max(0, budget - (opt.noExtras ? r.needsTotal : r.total)))} 元</td></tr>`;
    h += '</tbody></table>';
    return h;
  };

  /* ---------- A3 海報 ---------- */
  App.posterHTML = (cc, num, g) => {
    const c = C.countries[cc];
    g = g || {};
    const tint = (hex, a) => '#' + [1, 3, 5].map(i => Math.round(255 - (255 - parseInt(hex.substr(i, 2), 16)) * a).toString(16).padStart(2, '0')).join('');
    return `<div class="poster" style="--cc:${c.color};--ccl:${tint(c.color, 0.14)}">
      <div class="p-head"><h1>世界的尺：背包客生存挑戰　比較海報</h1><div class="p-meta">六年<span class="blank"></span>班　第 ${num} 組</div></div>
      <div class="p-country">${App.flag(cc, 'p-flag')}<div class="p-cname">${c.name}${c.tag ? `<small>${c.tag}</small>` : ''}</div>${App.postcard(cc, 'p-pc')}</div>
      <div class="p-line">
        <div class="p-line-main"><div class="p-big">${c.name}的貧窮線，換算成台幣一天約 <b>${App.fmt(c.daily)}</b> 元</div>
        <div class="p-small">${App.esc(c.raw)}　｜　${App.esc(c.calc)}　→　${App.esc(c.calc2)}<br>資料來源：${App.esc(c.source)}</div></div>
        <div class="p-wb">世界銀行<br>每天 3 美元<br><b>≈ ${C.wbLineTWD} 元</b></div>
      </div>
      <div class="p-rounds">
        <div class="p-col"><h3>第一回合：用${c.name}的及格線（${App.fmt(c.daily)} 元）</h3>${App.receiptTable(cc, g.r1, c.daily)}</div>
        <div class="p-col"><h3>第二回合：用每天 3 美元（${C.wbLineTWD} 元）</h3>${App.receiptTable(cc, g.r2, C.wbLineTWD)}</div>
      </div>
      <div class="p-box"><span>請貼上小組手寫的「我的大發現」</span></div>
      <div class="p-foot">國家資料來源：${App.esc(c.source)}。物價來源：Numbeo 各國平均物價（2026 年 11 月）。${App.esc(C.rateDate)}。${App.esc(C.rateNote)}</div>
    </div>`;
  };
  App.PW = 1123; App.PH = 1587;
  App.mountPoster = (el, html, width) => {
    const s = width / App.PW;
    el.innerHTML = `<div class="pwrap" style="width:${width}px;height:${App.PH * s}px"><div class="pscale" style="transform:scale(${s})">${html}</div></div>`;
  };
  /* items: [{html}] → 一頁一張 A3 */
  App.exportPDF = async (items, filename, onProgress) => {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a3', orientation: 'portrait', compress: true });
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-20000px;top:0;width:1123px;';
    document.body.appendChild(host);
    try {
      for (let i = 0; i < items.length; i++) {
        host.innerHTML = items[i].html;
        const el = host.firstElementChild;
        if (document.fonts && document.fonts.ready) await document.fonts.ready;
        await Promise.all(Array.from(el.querySelectorAll('img')).map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; })));
        /* html2canvas 畫不好 SVG 國旗：先用瀏覽器自己把 SVG 轉成 PNG 再截圖 */
        for (const im of Array.from(el.querySelectorAll('img[src$=".svg"]'))) {
          try {
            const cv = document.createElement('canvas'); cv.width = 640; cv.height = 480;
            cv.getContext('2d').drawImage(im, 0, 0, 640, 480);
            im.src = cv.toDataURL('image/png');
            await new Promise(r => { im.onload = im.onerror = r; if (im.complete) r(); });
          } catch (e) { /* 失敗就維持原圖 */ }
        }
        const canvas = await html2canvas(el, { scale: 2.5, backgroundColor: '#ffffff', useCORS: true, logging: false });
        if (i > 0) pdf.addPage('a3', 'portrait');
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, 297, 420);
        if (onProgress) onProgress(i + 1, items.length);
      }
      pdf.save(filename);
    } finally { host.remove(); }
  };

  /* ---------- 小元件 ---------- */
  App.toast = msg => {
    let t = App.$('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(App._tt); App._tt = setTimeout(() => t.classList.remove('show'), 2600);
  };
  App.confirm = (msg, okLabel, cancelLabel) => new Promise(res => {
    const m = document.createElement('div');
    m.className = 'modal-bg';
    m.innerHTML = `<div class="modal"><p>${msg}</p><div class="modal-btns"><button class="btn ghost" data-v="0">${cancelLabel || '再想想'}</button><button class="btn primary" data-v="1">${okLabel || '確定'}</button></div></div>`;
    m.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { m.remove(); res(b.dataset.v === '1'); } });
    document.body.appendChild(m);
  });
  App.alert = (msg) => new Promise(res => {
    const m = document.createElement('div');
    m.className = 'modal-bg';
    m.innerHTML = `<div class="modal"><p>${msg}</p><div class="modal-btns"><button class="btn primary">知道了</button></div></div>`;
    m.addEventListener('click', e => { if (e.target.closest('button')) { m.remove(); res(); } });
    document.body.appendChild(m);
  });
  App.setTitleFlagColor = cc => { document.documentElement.style.setProperty('--cc', C.countries[cc].color); };
})();
