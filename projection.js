/* 投影畫面（給全班看的內容）——「投影模式」、控制台預覽、獨立投影視窗 共用這一份
   程式一律用「步驟代號」判斷（App.sid），不寫死步驟編號。 */
(function () {
  const C = CONFIG, A = App, fmt = A.fmt, esc = A.esc, br = A.br;
  const P = {};
  window.Proj = P;

  /* 投影需要的環境資料：房間代碼、學生網址、QR code（同一個代碼只算一次）
     preview = true 代表「控制台的小預覽」：影片頁不放 iframe，避免筆電和白板同時出聲 */
  const envCache = {};
  P.env = (code, preview) => {
    if (!envCache[code]) {
      const url = new URL('student.html?room=' + code + (DB.demo ? '&demo=1' : ''), location.href).href;
      let qr = '';
      try { const q = qrcode(0, 'M'); q.addData(url); q.make(); qr = q.createSvgTag({ cellSize: 8, margin: 2, scalable: true }); } catch (e) {}
      envCache[code] = { code, url, qr };
    }
    return Object.assign({}, envCache[code], { preview: !!preview });
  };

  /* 記錄這一次畫的是什麼（下一次用來判斷要不要播動畫、要不要跳過重畫） */
  P.mark = M => {
    const s = M.state;
    return { step: s.step, sub: s.sub || 0, spot: s.spot && A.atOrAfter(s.step, 'round1') ? +s.spot : 0, paused: !!s.paused };
  };

  /* 影片播放中不能重畫（iframe 一重建影片就從頭開始）：同一個影片步驟、畫面上已有 iframe、暫停狀態沒變 → 跳過重畫 */
  P.shouldSkip = (root, M, prev) => {
    const s = M.state, sd = C.steps[s.step] || {};
    if (sd.kind !== 'video' || !prev || prev.step !== s.step || prev.paused !== !!s.paused) return false;
    return !!(root && root.querySelector('iframe.pj-vframe'));
  };

  /* 老師的遙控指令 state/vid = {cmd, n}：n 改變才執行。lastN 為 undefined（剛打開頁面）時只記住，不重播舊指令 */
  P.handleVid = (root, M, lastN) => {
    const v = M.state.vid;
    if (lastN === undefined) return v ? v.n : 0;     // 第一次：只記住目前的 n
    if (!v || v.n === lastN) return lastN;
    const f = root && root.querySelector('iframe.pj-vframe');
    const sd = C.steps[M.state.step] || {}, vv = (C.videos || {})[sd.video] || {};
    if (f && f.contentWindow) {
      const send = (func, args) => f.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: args || [] }), '*');
      if (v.cmd === 'play') send('playVideo');
      else if (v.cmd === 'pause') send('pauseVideo');
      else if (v.cmd === 'restart') { send('seekTo', [vv.start || 0, true]); send('playVideo'); }
    }
    return v.n;
  };

  P.embedUrl = v => {
    let u = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.youtubeId)}?rel=0&modestbranding=1&playsinline=1&enablejsapi=1`;
    if (v.start) u += '&start=' + (+v.start);
    if (v.end) u += '&end=' + (+v.end);
    if (/^https?:$/.test(location.protocol)) u += '&origin=' + encodeURIComponent(location.origin);
    return u;
  };
  P.watchUrl = v => `https://www.youtube.com/watch?v=${encodeURIComponent(v.youtubeId)}${v.start ? '&t=' + (+v.start) + 's' : ''}`;
  /* 不能嵌入的影片：另開 YouTube 視窗（固定視窗名稱，重複按只會叫回同一個視窗） */
  P.openVideo = key => {
    const v = (C.videos || {})[key]; if (!v) return null;
    const w = window.open(P.watchUrl(v), 'sg_video', 'popup,width=1280,height=760');
    try { w && w.focus(); } catch (e) {}
    return w;
  };
  document.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('[data-openvideo]');
    if (!t) return;
    if (!P.openVideo(t.dataset.openvideo)) A.alert('瀏覽器擋下了新視窗：請在網址列右邊允許「彈出式視窗」後再按一次。');
  });

  /* 共用元件 */
  const askBar = text => text ? `<div class="pj-ask"><span class="pj-ask-tag">❓ 想一想</span><span class="pj-ask-text">${br(text)}</span></div>` : '';
  const subLine = text => text ? `<div class="pj-sub">${br(text)}</div>` : '';
  const pointsBox = (points, point) => (points && points.length) || point
    ? `<div class="pj-points">${(points || []).map(p => `<div class="pj-pt">✔ ${br(p)}</div>`).join('')}${point ? `<div class="pj-pt1">${br(point)}</div>` : ''}</div>` : '';

  /* M：整個房間資料；env：P.env(code)；prev：P.mark() 的上一次結果（null 代表第一次畫，不播動畫） */
  P.render = (M, env, prev) => {
    const s = M.state, step = s.step, id = A.sid(step), sd = C.steps[step] || {}, sl = A.SL(id);
    const gl = Array.from({ length: s.groupCount }, (_, i) => i + 1);
    const grp = n => (M.groups && M.groups[n]) || {};
    const asg = n => s.assign && s.assign[n];
    const spot = s.spot && asg(s.spot) && A.atOrAfter(step, 'round1') ? +s.spot : 0;
    const enter = prev && (prev.step !== step || (prev.spot || 0) !== spot || (id === 'card' && prev.sub !== (s.sub || 0))) ? 'enter' : '';
    // 全班暫停：projPauseFrom 之前的步驟，投影幕也蓋上「眼睛看老師」；之後（各組上台分享）投影幕照常顯示，只在角落標示
    if (s.paused && !A.atOrAfter(step, C.projPauseFrom)) return '<div class="pj-paused"><div><div class="big-emoji">👀</div><h1>眼睛看老師</h1></div></div>';
    const badge = s.paused ? '<div class="pj-pausebadge">⏸ 學生平板暫停中</div>' : '';
    return body() + badge;

    function body() {
      if (spot) return spotlight(M, spot, step, enter);
      if (sd.kind === 'video') return videoSlide(sd, sl, env, enter);
      if (sd.kind === 'videoSum') return videoSumSlide(sl, enter);
      if (id === 'lobby') {
        return `<div class="pj pj-lobby ${enter}"><div class="pj-l"><h1>${esc(C.title)}</h1>${subLine(sl.sub)}<img class="lobby-img" src="assets/backpackers.jpg" alt="" onerror="this.remove()">
          <div class="pj-groups">${gl.map(n => `<div class="pj-g ${grp(n).uid ? 'on' : ''}">第 ${n} 組<br><small>${grp(n).uid ? '已加入 ✓' : '等待中'}</small></div>`).join('')}</div></div>
          <div class="pj-r"><div class="pj-codelabel">房間代碼</div><div class="pj-code">${esc(env.code)}</div><div class="pj-qr">${env.qr}</div><div class="pj-url">平板開啟 student.html，輸入代碼<br>或掃描 QR code</div></div></div>`;
      }
      if (id === 'card' && (s.sub || 0) >= 1) return worldMap(gl, asg, sl, enter);
      if (id === 'card') {
        return `<div class="pj ${enter}"><h1 class="pj-h">各組的國家任務</h1><div class="pj-cards">${gl.map(n => asg(n) ? `<div class="pj-card" style="--cc:${C.countries[asg(n)].color}">${A.postcard(asg(n), 'pj-pc')}<div class="pj-cn">${A.flag(asg(n), 'pj-flag')}<b>${A.cname(asg(n))}</b></div><div class="pj-gn">第 ${n} 組</div></div>` : `<div class="pj-card empty"><div class="big-emoji">❓</div><div class="pj-gn">第 ${n} 組</div></div>`).join('')}</div></div>`;
      }
      if (id === 'search') {
        return `<div class="pj ${enter}"><h1 class="pj-h">${esc(sd.title)}</h1>${subLine(sl.sub)}
          <div class="pj-status">${gl.map(n => { const st = A.status(step, grp(n)), cc = asg(n); return `<div class="pj-s ${st}" ${cc ? `style="--cc:${C.countries[cc].color}"` : ''}>${cc ? A.flag(cc, 'pj-flag') : ''}<b>第 ${n} 組</b><span>${cc ? A.cname(cc) : ''}</span><em>${A.statusLabel[st]}</em></div>`; }).join('')}</div>${askBar(sl.ask)}</div>`;
      }
      if (id === 'round1' || id === 'store' || id === 'round2') return collection(gl, grp, asg, id, sl, enter);
      if (id === 'numberline') return numberLine(M, gl, grp, asg, prev, enter);
      // poster
      return `<div class="pj pj-poster ${enter}"><h1 class="pj-h">比較海報完成！</h1>${subLine(sl.sub)}
        <div class="pj-chips">${gl.map(n => { const cc = asg(n); return `<div class="pj-chip" ${cc ? `style="--cc:${C.countries[cc].color}"` : ''}>${cc ? A.flag(cc, 'chip-flag') : ''}第 ${n} 組 ${cc ? A.cname(cc) : ''} 📄</div>`; }).join('')}</div>
        <div class="pj-box"><div class="pj-box-h">海報上要有：</div>${pointsBox(sl.points, sl.point)}</div>
        <p class="pj-note">下一節課要正式發表，請貼上手寫的「我的大發現」。</p>${askBar(sl.ask)}</div>`;
    }
  };

  /* 🗺 世界地圖：開箱國家任務卡之後，標出各組國家的位置（同一國有好幾組時，合成一個標記） */
  function worldMap(gl, asg, sl, enter) {
    const W = window.WORLD_MAP;
    if (!W) return `<div class="pj ${enter}"><h1 class="pj-h">世界地圖</h1><div class="cl-wait">地圖檔 worldmap.js 沒有載入</div></div>`;
    const byCC = {};
    gl.forEach(n => { const cc = asg(n); if (cc) (byCC[cc] = byCC[cc] || []).push(n); });
    const ccs = Object.keys(byCC);
    const shapes = Object.keys(W.countries).map(cc => `<path class="wm-c ${byCC[cc] ? 'on' : ''}" d="${W.countries[cc]}" ${byCC[cc] ? `style="fill:${C.countries[cc].color}"` : ''}/>`).join('');
    const pins = ccs.map((cc, i) => {
      const c = C.countries[cc], m = c.map || { lat: 0, lon: 0 };
      const x = (m.lon + 180) * W.scale / W.w * 100, y = (W.latTop - m.lat) * W.scale / W.h * 100;
      return `<div class="wm-pin lbl-${m.label || 'right'}" style="left:${x}%;top:${y}%;--cc:${c.color};animation-delay:${enter ? i * 0.15 : 0}s">
        <i></i><span>${A.flag(cc, 'wm-flag')}<b>${c.name}</b><small>第 ${byCC[cc].join('、')} 組</small></span></div>`;
    }).join('');
    return `<div class="pj pj-map ${enter} ${sl.ask ? 'has-ask' : ''}"><h1 class="pj-h">🗺 世界地圖${sl.mapSub ? `　<small>${esc(sl.mapSub)}</small>` : ''}</h1>
      <div class="wm-box"><svg class="wm-svg" viewBox="0 0 ${W.w} ${W.h}" preserveAspectRatio="xMidYMid meet"><path class="wm-land" d="${W.land}"/>${shapes}</svg>${pins}</div>
      <div class="wm-src">地圖：Natural Earth（公有領域）</div>${askBar(sl.ask)}</div>`;
  }

  /* 🎬 影片頁 */
  function videoSlide(sd, sl, env, enter) {
    const v = (C.videos || {})[sd.video] || {};
    let box;
    if (v.embed && !env.preview) {
      box = `<iframe class="pj-vframe" src="${esc(P.embedUrl(v))}" title="${esc(v.title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    } else {
      const msg = v.embed
        ? '🎬 影片在「投影畫面」播放<small>請用控制台下方的 ▶ 播放／⏸ 暫停／⏮ 從頭</small>'
        : `▶ 影片在另一個 YouTube 視窗播放<small>${env.preview ? '請按控制台的「▶ 開啟影片」' : '請按控制台的「▶ 開啟影片」，或點這裡開啟'}</small>`;
      box = `<div class="pj-vthumb" ${!v.embed && !env.preview ? `data-openvideo="${esc(sd.video)}"` : ''}><img src="https://i.ytimg.com/vi/${encodeURIComponent(v.youtubeId)}/hqdefault.jpg" alt="" onerror="this.remove()"><div class="pj-vmsg">${msg}</div></div>`;
    }
    return `<div class="pj pj-video ${enter}"><h1 class="pj-h">${esc(v.heading || sd.title)}</h1>${subLine(sl.sub)}
      <div class="pj-vbox">${box}</div><div class="pj-credit">${esc(v.title || '')}${v.length ? `（${esc(v.length)}）` : ''}｜${esc(v.credit || '')}</div></div>`;
  }

  /* 影片之後的收攏頁 */
  function videoSumSlide(sl, enter) {
    const stats = (sl.stats || []).slice(0, 3);
    return `<div class="pj pj-vsum ${enter}"><h1 class="pj-h">${esc(sl.title || '影片之後')}</h1>${subLine(sl.sub)}
      ${stats.length ? `<div class="vs-stats">${stats.map((x, i) => `<div class="vs-card c${i}"><div class="vs-big">${esc(x.big)}</div><div class="vs-label">${br(x.label)}</div></div>`).join('')}</div>` : ''}
      ${sl.source ? `<div class="vs-source">${br(sl.source)}</div>` : ''}
      ${sl.statement ? `<div class="vs-statement">${br(sl.statement)}</div>` : ''}${askBar(sl.ask)}</div>`;
  }

  /* 各組採買清單大集合：第一回合、當地商店、第二回合 */
  function collection(gl, grp, asg, id, sl, enter) {
    const round = id === 'round2' ? 2 : 1;
    const title = id === 'round1' ? '第一回合：各組的採買清單'
      : id === 'store' ? '第一回合＋當地商店：各組買到的東西'
        : `第二回合（每天 3 美元 ≈ ${C.wbLineTWD} 元）：各組的採買清單`;
    const list = gl.filter(asg);
    const cards = list.map(n => {
      const cc = asg(n), c = C.countries[cc], g = grp(n), rd = g['r' + round] || {};
      const budget = A.budget(cc, round), r = A.calcRound(cc, rd, budget);
      let inner;
      if (!rd.checkedOut) inner = '<div class="cl-wait">🛒 採買中…</div>';
      else {
        inner = '<ul class="cl-lines">' + r.lines.map(l => l.state === 'buy'
          ? `<li><span>${l.cat.icon} ${l.cat.name}：${esc(l.opt.name)}</span><b>${fmt(l.price)}</b></li>`
          : `<li class="skip"><span>${l.cat.icon} ${l.cat.name}：✗ 買不起／放棄</span><b></b></li>`).join('') + '</ul>';
        if (id !== 'round1') {
          const ex = r.extras.map(e => `<span class="cl-chip">${e.item.icon}${e.qty > 1 ? '×' + e.qty : ''}</span>`).join('');
          inner += `<div class="cl-extra">＋ ${ex || (rd.storeDone ? '沒有多的錢買其他東西' : '當地商店選購中…')}</div>`;
        }
        inner += `<div class="cl-foot"><span>必需品 ${fmt(r.needsTotal)} 元${r.extrasTotal ? `＋額外 ${fmt(r.extrasTotal)} 元` : ''}</span><span class="cl-left ${r.remaining <= 0 ? 'zero' : ''}">剩 <b>${fmt(r.remaining)}</b> 元</span></div>`;
      }
      return `<div class="cl-card" style="--cc:${c.color}"><div class="cl-head">${A.flag(cc, 'cl-flag')}<b>第 ${n} 組・${c.name}</b><span>預算 ${fmt(budget)} 元</span></div>${inner}</div>`;
    }).join('');
    return `<div class="pj cl ${enter} ${sl.ask ? 'has-ask' : ''}"><h1 class="pj-h cl-h">${title}</h1><div class="cl-grid ${list.length <= 4 ? 'two' : ''}">${cards}</div>${askBar(sl.ask)}</div>`;
  }

  /* 上台發表：把某一組的明細表放大 */
  function spotlight(M, n, step, enter) {
    const cc = M.state.assign[n], c = C.countries[cc], g = (M.groups && M.groups[n]) || {};
    const r1 = g.r1 || {};
    const col1 = `<div class="sp-col"><h2>第一回合：用${c.name}的及格線（${fmt(c.daily)} 元）</h2>${r1.checkedOut ? A.receiptTable(cc, r1, c.daily, { noExtras: A.sid(step) === 'round1' && !r1.storeDone }) : '<div class="cl-wait">還沒結帳</div>'}</div>`;
    const col2 = A.atOrAfter(step, 'round2') ? `<div class="sp-col"><h2>第二回合：用每天 3 美元（${C.wbLineTWD} 元）</h2>${(g.r2 || {}).checkedOut ? A.receiptTable(cc, g.r2, C.wbLineTWD) : '<div class="cl-wait">還沒結帳</div>'}</div>` : '';
    return `<div class="pj sp ${enter}" style="--cc:${c.color}"><div class="sp-head">📣 第 ${n} 組上台發表　${A.flag(cc, 'sp-flag')}<b>${c.name}</b></div>
      <div class="sp-cols ${col2 ? 'two' : ''}">${col1}${col2}</div>${col2 ? '<div class="sp-q">比一比：哪一次買得比較多？為什麼？</div>' : ''}</div>`;
  }

  /* 第一回合買完必需品後還剩多少錢（還沒結帳回傳 null） */
  P.leftover = (cc, g) => {
    if (!cc || !g || !g.r1 || !g.r1.checkedOut) return null;
    const r = A.calcRound(cc, g.r1, A.budget(cc, 1));
    return Math.max(0, r.budget - r.needsTotal);
  };
  P.maxSub = M => Array.from({ length: M.state.groupCount }, (_, i) => i + 1).filter(n => M.state.assign && M.state.assign[n]).length + 3;

  /* 數字排排站（這一頁本身已有大字提問，不另加「想一想」提問條） */
  function numberLine(M, gl, grp, asg, prev, enter) {
    const sub = M.state.sub || 0;
    const ps = prev && prev.step === M.state.step ? prev.sub : null;   // 上一次的進度；換步驟或第一次畫時為 null
    const fresh = need => (ps != null && ps < need && sub >= need) ? 'fresh' : '';   // 這次才剛出現的東西才播動畫
    const items = gl.filter(asg).map(n => ({ n, cc: asg(n), v: C.countries[asg(n)].daily })).sort((a, b) => a.v - b.v);
    const k = items.length, MIN = 10, MAX = 2000;
    const pos = v => (Math.log(v) - Math.log(MIN)) / (Math.log(MAX) - Math.log(MIN)) * 100;
    let h = `<div class="pj nl ${enter}"><h1 class="pj-h">數字排排站　<small>各國的「及格線」，一天多少元台幣</small></h1><div class="nl-area"><div class="nl-axis"></div>`;
    [10, 20, 50, 100, 200, 500, 1000, 2000].forEach(t => { h += `<div class="nl-tick" style="left:${pos(t)}%"><i></i><span>${fmt(t)}</span></div>`; });
    items.forEach((it, i) => {
      const lo = P.leftover(it.cc, grp(it.n));
      h += `<div class="nl-item ${i % 2 === 0 ? 'up' : 'down'} ${sub > i ? 'in' : ''} ${fresh(i + 1)}" style="left:${pos(it.v)}%;--cc:${C.countries[it.cc].color}"><div class="nl-card">${A.flag(it.cc, 'nl-flag')}<b>${A.cname(it.cc)}</b><span>一天 ${fmt(it.v)} 元</span>
        ${sub >= k + 3 ? `<em class="left ${fresh(k + 3)}">第一回合買完必需品後<br>還剩 <b>${lo == null ? '—' : fmt(lo)}</b> 元</em>` : ''}</div><div class="nl-stem"></div></div>`;
    });
    h += `<div class="nl-wb ${sub >= k + 1 ? 'in' : ''} ${fresh(k + 1)}" style="left:${pos(C.wbLineTWD)}%"><span>世界銀行：每天 3 美元 ≈ ${C.wbLineTWD} 元</span></div></div>
      <div class="nl-note">數線前段放大（越往右，每一格代表的金額越大），標籤寫的是實際金額</div>
      <div class="nl-q ${sub >= k + 2 ? 'in' : ''} ${fresh(k + 2)}">為什麼日本、美國的貧窮線比肯亞高好幾倍，在當地生活的人依然很辛苦？</div></div>`;
    return h;
  }

  /* 1920×1080 舞台等比縮放到指定區域（w、h 不給就用整個視窗並置中） */
  P.fit = (stage, w, h) => {
    if (!stage) return;
    const W = w || innerWidth, H = h || innerHeight;
    if (!W || !H) return;
    const sc = Math.min(W / 1920, H / 1080);
    stage.style.transform = `scale(${sc})`;
    stage.style.left = (W - 1920 * sc) / 2 + 'px';
    stage.style.top = (H - 1080 * sc) / 2 + 'px';
    return sc;
  };
})();
