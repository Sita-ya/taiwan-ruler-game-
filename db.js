/* 資料層：有填 Firebase 設定就用 Firebase；沒填就用「本機示範模式」(localStorage) */
(function () {
  const cfg = window.FIREBASE_CONFIG || {};
  const useFirebase = !!(cfg.apiKey && cfg.databaseURL && window.firebase);
  const DB = { demo: !useFirebase, uid: null };

  if (useFirebase) {
    firebase.initializeApp(cfg);
    const db = firebase.database();
    DB.ready = firebase.auth().signInAnonymously().then(c => { DB.uid = c.user.uid; return DB.uid; });
    DB.get = p => db.ref(p).once('value').then(s => s.val());
    DB.set = (p, v) => db.ref(p).set(v === undefined ? null : v);
    DB.update = (p, o) => db.ref(p).update(o);
    DB.remove = p => db.ref(p).remove();
    DB.on = (p, cb) => { const r = db.ref(p); const h = r.on('value', s => cb(s.val())); return () => r.off('value', h); };
    DB.onConnection = cb => { const r = db.ref('.info/connected'); const h = r.on('value', s => cb(!!s.val())); return () => r.off('value', h); };
  } else {
    const KEY = 'sgMockDB';
    let uid = null;
    try { uid = sessionStorage.getItem('sgMockUid'); } catch (e) {}
    if (!uid) { uid = 'u' + Math.random().toString(36).slice(2, 10); try { sessionStorage.setItem('sgMockUid', uid); } catch (e) {} }
    DB.uid = uid;
    DB.ready = Promise.resolve(uid);
    const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
    const save = t => localStorage.setItem(KEY, JSON.stringify(t));
    const parts = p => p.split('/').filter(Boolean);
    const getIn = (t, ps) => { let n = t; for (const k of ps) { if (n == null || typeof n !== 'object') return null; n = n[k]; } return n === undefined ? null : n; };
    const setIn = (t, ps, v) => {
      if (!ps.length) return v == null ? {} : v;
      let n = t;
      for (let i = 0; i < ps.length - 1; i++) { if (n[ps[i]] == null || typeof n[ps[i]] !== 'object') n[ps[i]] = {}; n = n[ps[i]]; }
      if (v == null) delete n[ps[ps.length - 1]]; else n[ps[ps.length - 1]] = v;
      return t;
    };
    const prune = o => { if (o && typeof o === 'object') { for (const k of Object.keys(o)) { prune(o[k]); if (o[k] && typeof o[k] === 'object' && !Object.keys(o[k]).length) delete o[k]; } } return o; };
    const listeners = new Set();
    const notify = () => { const t = load(); listeners.forEach(l => { const v = getIn(t, l.ps); const s = JSON.stringify(v); if (s !== l.last) { l.last = s; l.cb(v == null ? null : JSON.parse(s)); } }); };
    window.addEventListener('storage', e => { if (e.key === KEY) notify(); });
    DB.get = p => Promise.resolve(getIn(load(), parts(p)));
    DB.set = (p, v) => { const t = setIn(load(), parts(p), v === undefined ? null : JSON.parse(JSON.stringify(v))); save(prune(t)); notify(); return Promise.resolve(); };
    DB.update = (p, o) => { let t = load(); for (const k of Object.keys(o)) t = setIn(t, parts(p + '/' + k), o[k] === undefined ? null : o[k]); save(prune(t)); notify(); return Promise.resolve(); };
    DB.remove = p => DB.set(p, null);
    DB.on = (p, cb) => { const l = { ps: parts(p), cb, last: undefined }; listeners.add(l); setTimeout(() => { if (!listeners.has(l)) return; const v = getIn(load(), l.ps); l.last = JSON.stringify(v); cb(v == null ? null : JSON.parse(l.last)); }, 0); return () => listeners.delete(l); };
    DB.onConnection = cb => { setTimeout(() => cb(true), 0); return () => {}; };
  }
  window.DB = DB;
})();
