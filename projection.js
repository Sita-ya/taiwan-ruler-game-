/* 投影畫面（給全班看的內容）——「投影模式」、控制台預覽、獨立投影視窗 共用這一份 */
(function () {
  const C = CONFIG, A = App, fmt = A.fmt, esc = A.esc;
  const P = {};
  window.Proj = P;

  /* 投影需要的環境資料：房間代碼、學生網址、QR code（同一個代碼只算一次） */
  const envCache = {};
  P.env = code => {
    if (envCache[code]) return envCache[code];
    const url = new URL('student.html?room=' + code + (DB.demo ? '&demo=1' : ''), location.href).href;
    let qr = '';
    try { const q = qrcode(0, 'M'); q.addData(url); q.make(); qr = q.createSvgTag({ cellSize: 8, margin: 2, scalable: true }); } catch (e) {}
    return (envCache[code] = { code, url, qr });
  };

  /* M：整個房間資料；env：P.env(code)；prev：上一次畫的 {step, sub}（null 代表第一次畫，不播動畫） */
  P.render = (M, env, prev) => {
    const s = M.state, step = s.step;
    const gl = Array.from({ length: s.groupCount }, (_, i) => i + 1);
    const grp = n => (M.groups && M.groups[n]) || {};
    const asg = n => s.assign && s.assign[n];
    const spot = s.spot && asg(s.spot) && step >= 3 ? +s.spot : 0;
    const enter = prev && (prev.step !== step || (prev.spot || 0) !== spot) ? 'enter' : '';
    // 全班暫停：步驟 0～2 投影幕也蓋上「眼睛看老師」；步驟 3 以後（各組上台分享）投影幕照常顯示，只在角落標示
    if (s.paused && step < C.projPauseFromStep) return '<div class="pj-paused"><div><div class="big-emoji">👀</div><h1>眼睛看老師</h1></div></div>';
    const badge = s.paused ? '<div class="pj-pausebadge">⏸ 學生平板暫停中</div>' : '';
    return body() + badge;

    function body() {
      if (spot) return spotlight(M, spot, step, enter);
      if (step === 0) {
        return `<div class="pj pj-lobby ${enter}"><div class="pj-l"><h1>${esc(C.title)}</h1><img class="lobby-img" src="assets/backpackers.jpg" alt="" onerror="this.remove()">
          <div class="pj-groups">${gl.map(n => `<div class="pj-g ${grp(n).uid ? 'on' : ''}">第 ${n} 組<br><small>${grp(n).uid ? '已加入 ✓' : '等待中'}</small></div>`).join('')}</div></div>
          <div class="pj-r"><div class="pj-codelabel">房間代碼</div><div class="pj-code">${esc(env.code)}</div><div class="pj-qr">${env.qr}</div><div class="pj-url">平板開啟 student.html，輸入代碼<br>或掃描 QR code</div></div></div>`;
      }
      if (step === 1) {
        return `<div class="pj ${enter}"><h1 class="pj-h">各組的國家任務</h1><div class="pj-cards">${gl.map(n => asg(n) ? `<div class="pj-card" style="--cc:${C.countries[asg(n)].color}">${A.postcard(asg(n), 'pj-pc')}<div class="pj-cn">${A.flag(asg(n), 'pj-flag')}<b>${A.cname(asg(n))}</b></div><div class="pj-gn">第 ${n} 組</div></div>` : `<div class="pj-card empty"><div class="big-emoji">❓</div><div class="pj-gn">第 ${n} 組</div></div>`).join('')}</div></div>`;
      }
      if (step === 2) {
        return `<div class="pj ${enter}"><h1 class="pj-h">步驟 2：${esc(C.steps[2].title)}</h1>
          <div class="pj-status">${gl.map(n => { const st = A.status(step, grp(n)), cc = asg(n); return `<div class="pj-s ${st}" ${cc ? `style="--cc:${C.countries[cc].color}"` : ''}>${cc ? A.flag(cc, 'pj-flag') : ''}<b>第 ${n} 組</b><span>${cc ? A.cname(cc) : ''}</span><em>${A.statusLabel[st]}</em></div>`; }).join('')}</div></div>`;
      }
      if (step >= 3 && step <= 5) return collection(gl, grp, asg, step, enter);
      if (step === 6) return numberLine(M, gl, grp, asg, prev, enter);
      return `<div class="pj ${enter}"><h1 class="pj-h">比較海報完成！</h1><div class="pj-status">${gl.map(n => { const cc = asg(n); return `<div class="pj-s done" ${cc ? `style="--cc:${C.countries[cc].color}"` : ''}>${cc ? A.flag(cc, 'pj-flag') : ''}<b>第 ${n} 組</b><span>${cc ? A.cname(cc) : ''}</span><em>📄 海報完成</em></div>`; }).join('')}</div><p class="pj-note">下一節課要正式發表，請貼上手寫的「我的大發現」。</p></div>`;
    }
  };

  /* 各組採買清單大集合：步驟 3、4 顯示第一回合，步驟 5 顯示第二回合 */
  function collection(gl, grp, asg, step, enter) {
    const round = step === 5 ? 2 : 1;
    const title = step === 3 ? '第一回合：各組的採買清單'
      : step === 4 ? '第一回合＋當地商店：各組買到的東西'
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
        if (step >= 4) {
          const ex = r.extras.map(e => `<span class="cl-chip">${e.item.icon}${e.qty > 1 ? '×' + e.qty : ''}</span>`).join('');
          inner += `<div class="cl-extra">＋ ${ex || (rd.storeDone ? '沒有多的錢買其他東西' : '當地商店選購中…')}</div>`;
        }
        inner += `<div class="cl-foot"><span>必需品 ${fmt(r.needsTotal)} 元${r.extrasTotal ? `＋額外 ${fmt(r.extrasTotal)} 元` : ''}</span><span class="cl-left ${r.remaining <= 0 ? 'zero' : ''}">剩 <b>${fmt(r.remaining)}</b> 元</span></div>`;
      }
      return `<div class="cl-card" style="--cc:${c.color}"><div class="cl-head">${A.flag(cc, 'cl-flag')}<b>第 ${n} 組・${c.name}</b><span>預算 ${fmt(budget)} 元</span></div>${inner}</div>`;
    }).join('');
    return `<div class="pj cl ${enter}"><h1 class="pj-h cl-h">${title}</h1><div class="cl-grid ${list.length <= 4 ? 'two' : ''}">${cards}</div></div>`;
  }

  /* 上台發表：把某一組的明細表放大 */
  function spotlight(M, n, step, enter) {
    const cc = M.state.assign[n], c = C.countries[cc], g = (M.groups && M.groups[n]) || {};
    const r1 = g.r1 || {};
    const col1 = `<div class="sp-col"><h2>第一回合：用${c.name}的及格線（${fmt(c.daily)} 元）</h2>${r1.checkedOut ? A.receiptTable(cc, r1, c.daily, { noExtras: step === 3 && !r1.storeDone }) : '<div class="cl-wait">還沒結帳</div>'}</div>`;
    const col2 = step >= 5 ? `<div class="sp-col"><h2>第二回合：用每天 3 美元（${C.wbLineTWD} 元）</h2>${(g.r2 || {}).checkedOut ? A.receiptTable(cc, g.r2, C.wbLineTWD) : '<div class="cl-wait">還沒結帳</div>'}</div>` : '';
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

  function numberLine(M, gl, grp, asg, prev, enter) {
    const sub = M.state.sub || 0;
    const ps = prev && prev.step === 6 ? prev.sub : null;          // 上一次的進度；換步驟或第一次畫時為 null
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
