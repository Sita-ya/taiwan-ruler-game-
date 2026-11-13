/* 獨立投影視窗：只讀取房間資料並顯示，不寫入、不控制 */
(function () {
  const stage = document.getElementById('pjs'), fsBtn = document.getElementById('fsBtn');
  const code = new URLSearchParams(location.search).get('room');
  let last = null;     // 上一次畫的 {step, sub}：步驟改變時才播動畫，重新整理或資料小更新不重播

  const fit = () => Proj.fit(stage);
  const msg = (t, sub) => { stage.innerHTML = `<div class="pj pj-msg"><div><h1>${App.esc(t)}</h1>${sub ? `<p>${App.esc(sub)}</p>` : ''}</div></div>`; fit(); };

  /* ---- 全螢幕：按鈕、F 鍵、連點兩下 ---- */
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
  function toggleFs() {
    const d = document.documentElement;
    try {
      if (fsEl()) { const p = (document.exitFullscreen || document.webkitExitFullscreen).call(document); if (p && p.catch) p.catch(() => {}); }
      else { const p = d.requestFullscreen ? d.requestFullscreen() : d.webkitRequestFullscreen(); if (p && p.catch) p.catch(() => {}); }
    } catch (e) {}
  }
  const onFs = () => { fsBtn.classList.toggle('hidden', !!fsEl()); fit(); };
  fsBtn.addEventListener('click', e => { e.stopPropagation(); toggleFs(); });
  document.addEventListener('dblclick', toggleFs);
  document.addEventListener('keydown', e => { if (e.key === 'f' || e.key === 'F') toggleFs(); });
  document.addEventListener('fullscreenchange', onFs);
  document.addEventListener('webkitfullscreenchange', onFs);
  window.addEventListener('resize', fit);
  // 視窗在背景、被拖到另一個螢幕或剛切回來時，resize 事件不一定會發生，所以多加這兩個保險
  document.addEventListener('visibilitychange', fit);
  try { new ResizeObserver(fit).observe(document.documentElement); } catch (e) {}
  fit();

  if (!/^\d{4}$/.test(code || '')) { msg('網址缺少房間代碼', '請從教師控制台按「🖥 開啟投影視窗」'); return; }
  DB.ready.then(() => {
    DB.on('rooms/' + code, M => {
      if (!M || !M.state) { last = null; return msg('找不到房間 ' + code, '請確認教師控制台已開啟這個房間'); }
      stage.innerHTML = Proj.render(M, Proj.env(code), last);
      last = { step: M.state.step, sub: M.state.sub || 0 };
      fit();
    });
  }).catch(err => msg('連線失敗', String(err && err.message || err)));
})();
