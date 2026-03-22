/* ═══════════════════════════════════════════════════════════════
   LUMINARY ATELIER — SHARED STATE  (luminary-shared.js v3)
   Cross-page localStorage sync + global utilities
   BUGS FIXED:
   - toggleLike now returns bool consistently (was void)
   - toggleBookmark now accepts item obj and returns bool
   - notifications had no per-id dismissal
   - no search history, lesson progress, follows, or moodboard
   NEW FEATURES: follows, moodboard, lesson progress, settings,
   search history, global toast, scroll progress, back-to-top,
   tab title badge, dismissible notifications, stats expansion
═══════════════════════════════════════════════════════════════ */
const LS_KEY = 'luminary_state_v2';

const LuminaryState = {
  get()  { try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; } },
  set(patch) {
    const next = Object.assign({}, this.get(), patch);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('luminary:state', { detail: next }));
    return next;
  },

  /* ── PROFILE ── */
  getProfile() {
    return this.get().profile || { name:'Artist', handle:'@luminary_artist', bio:'', avatar:'', joined: new Date().toISOString().slice(0,10) };
  },
  setProfile(data) { return this.set({ profile: { ...this.getProfile(), ...data } }); },

  /* ── LIKES ── */
  getLikes()     { return this.get().likes || []; },
  toggleLike(id) {
    let likes = this.getLikes();
    const had = likes.includes(String(id));
    likes = had ? likes.filter(l => l !== String(id)) : [...likes, String(id)];
    this.set({ likes });
    if (!had) this.incrementStat('likes_given');
    return !had;
  },
  isLiked(id) { return this.getLikes().includes(String(id)); },

  /* ── BOOKMARKS ── */
  getBookmarks() { return this.get().bookmarks || []; },
  toggleBookmark(item) {
    let bm  = this.getBookmarks();
    const had = bm.some(b => b.id === String(item.id));
    bm = had
      ? bm.filter(b => b.id !== String(item.id))
      : [{ id:String(item.id), name:item.name||item.title||'', artist:item.artist||'',
           thumb:item.thumb||item.src||'', movement:item.movement||'' }, ...bm].slice(0, 60);
    this.set({ bookmarks: bm });
    return !had;
  },
  isBookmarked(id) { return this.getBookmarks().some(b => b.id === String(id)); },

  /* ── FOLLOWS (artists) ── */
  getFollows()     { return this.get().follows || []; },
  toggleFollow(id) {
    let f = this.getFollows();
    const had = f.includes(String(id));
    f = had ? f.filter(x => x !== String(id)) : [...f, String(id)];
    this.set({ follows: f });
    return !had;
  },
  isFollowing(id) { return this.getFollows().includes(String(id)); },

  /* ── MOODBOARD ── */
  getMoodboard() { return this.get().moodboard || []; },
  addToMoodboard(item) {
    let mb = this.getMoodboard();
    if (mb.some(x => x.id === String(item.id))) return false;
    mb = [{ id:String(item.id), name:item.name||'', thumb:item.thumb||'', type:item.type||'artwork' }, ...mb].slice(0, 48);
    this.set({ moodboard: mb });
    return true;
  },
  removeFromMoodboard(id) { this.set({ moodboard: this.getMoodboard().filter(x => x.id !== String(id)) }); },

  /* ── RECENT COLORS ── */
  getRecentColors()    { return this.get().recentColors || []; },
  pushRecentColor(hex) {
    let cols = this.getRecentColors().filter(c => c !== hex);
    this.set({ recentColors: [hex, ...cols].slice(0, 16) });
  },

  /* ── RECENT ARTWORKS ── */
  getRecentArtworks()     { return this.get().recentArtworks || []; },
  pushRecentArtwork(item) {
    let list = this.getRecentArtworks().filter(a => a.id !== item.id);
    this.set({ recentArtworks: [item, ...list].slice(0, 12) });
  },

  /* ── LESSON PROGRESS ── */
  getLessonProgress()    { return this.get().lessonProgress || {}; },
  markLessonComplete(id) {
    const lp = this.getLessonProgress();
    lp[String(id)] = { done: true, date: new Date().toISOString() };
    this.set({ lessonProgress: lp });
    this.incrementStat('lessons_completed');
    this.addNotification('Lesson completed! Keep learning 🎨', 'achievement');
  },
  isLessonDone(id)       { return !!(this.getLessonProgress()[String(id)]?.done); },
  getLessonsCompleted()  { return Object.values(this.getLessonProgress()).filter(v => v.done).length; },

  /* ── SEARCH HISTORY ── */
  getSearchHistory()   { return this.get().searchHistory || []; },
  pushSearchHistory(q) {
    if (!q || q.length < 2) return;
    let h = this.getSearchHistory().filter(x => x !== q);
    this.set({ searchHistory: [q, ...h].slice(0, 10) });
  },

  /* ── CHALLENGES ── */
  getJoinedChallenges() { return this.get().joinedChallenges || []; },
  joinChallenge(id) {
    let jc = [...new Set([...this.getJoinedChallenges(), id])];
    this.set({ joinedChallenges: jc });
    this.incrementStat('challenges_joined');
    this.addNotification('Challenge joined! Start creating to enter.', 'challenge');
    return jc;
  },
  leaveChallenge(id) { const jc = this.getJoinedChallenges().filter(c=>c!==id); this.set({joinedChallenges:jc}); return jc; },
  hasJoined(id) { return this.getJoinedChallenges().includes(id); },

  /* ── SUBMISSIONS ── */
  getSubmissions()    { return this.get().submissions || []; },
  addSubmission(item) {
    const s = [item, ...this.getSubmissions()].slice(0, 20);
    this.set({ submissions: s });
    this.incrementStat('uploads');
    this.addNotification(`"${item.title||'Untitled'}" submitted to community!`, 'submit');
    return s;
  },

  /* ── SETTINGS ── */
  getSettings() {
    return Object.assign({ theme:'dark', notifications:true, autoSave:true, gridView:'grid' }, this.get().settings || {});
  },
  updateSettings(patch) { this.set({ settings: { ...this.getSettings(), ...patch } }); },

  /* ── NOTIFICATIONS ── */
  getNotifications() { return this.get().notifications || []; },
  addNotification(msg, type = 'info') {
    if (!this.getSettings().notifications) return null;
    const n = { id: Date.now()+Math.random().toString(36).slice(2), msg, type, time: new Date().toISOString(), read: false };
    this.set({ notifications: [n, ...this.getNotifications()].slice(0, 40) });
    luminaryInjectNotifBadge();
    return n;
  },
  markAllRead()          { this.set({ notifications: this.getNotifications().map(n=>({...n,read:true})) }); luminaryInjectNotifBadge(); },
  dismissNotification(id){ this.set({ notifications: this.getNotifications().filter(n=>n.id!==id) }); luminaryInjectNotifBadge(); },
  getUnreadCount()       { return this.getNotifications().filter(n=>!n.read).length; },

  /* ── STATS ── */
  incrementStat(key) { const s=this.get().stats||{}; s[key]=(s[key]||0)+1; this.set({stats:s}); },
  getStats()         { return this.get().stats||{saves:0,uploads:0,likes_given:0,lessons_completed:0,challenges_joined:0}; },
};

/* ═══════════════════════════
   AVATAR GENERATOR
═══════════════════════════ */
function luminaryAvatar(name, size=40) {
  const init  = (name||'A').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  const colors= ['#c9a84c','#7b5ea7','#2a9a8a','#c94a6a','#e07830','#3a6fa8'];
  const color = colors[(name||'A').charCodeAt(0)%colors.length];
  const svg   = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="${color}"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" fill="#fff" font-family="Josefin Sans,sans-serif" font-size="${size*.38}" font-weight="600">${init}</text></svg>`;
  return 'data:image/svg+xml;base64,'+btoa(svg);
}

/* ═══════════════════════════
   GLOBAL TOAST
═══════════════════════════ */
function luminaryToast(msg, type='info') {
  const borderMap = { info:'rgba(201,168,76,.35)', success:'rgba(42,154,138,.45)', error:'rgba(201,74,106,.45)', achievement:'rgba(123,94,167,.45)', challenge:'rgba(77,201,180,.4)', submit:'rgba(201,168,76,.35)' };
  let t = document.getElementById('lum-global-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'lum-global-toast';
    t.style.cssText = 'position:fixed;bottom:2.5rem;left:50%;transform:translateX(-50%);background:rgba(10,9,14,.97);color:#f0ead6;font-family:"Josefin Sans",sans-serif;font-size:.58rem;letter-spacing:.18em;text-transform:uppercase;padding:.55rem 1.5rem;z-index:99999;opacity:0;transition:opacity .3s;pointer-events:none;white-space:nowrap;backdrop-filter:blur(10px);border-radius:2px;';
    document.body.appendChild(t);
  }
  t.style.border = `1px solid ${borderMap[type]||borderMap.info}`;
  t.textContent  = msg;
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.style.opacity='0', 2400);
}

/* ═══════════════════════════
   NOTIFICATION BADGE
═══════════════════════════ */
function luminaryInjectNotifBadge() {
  const count = LuminaryState.getUnreadCount();
  document.querySelectorAll('.notif-badge').forEach(b => { b.textContent=count||''; b.style.display=count?'inline-flex':'none'; });
  document.querySelectorAll('.notif-badge-dot').forEach(d => { d.style.display=count?'inline-block':'none'; });
  const base = document.title.replace(/^\(\d+\)\s*/,'');
  document.title = count ? `(${count}) ${base}` : base;
}
window.addEventListener('luminary:state', luminaryInjectNotifBadge);
document.addEventListener('DOMContentLoaded', luminaryInjectNotifBadge);

/* ═══════════════════════════
   SCROLL PROGRESS BAR
═══════════════════════════ */
function luminaryScrollProgress() {
  let bar = document.getElementById('lum-scroll-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'lum-scroll-bar';
    bar.style.cssText = 'position:fixed;top:0;left:0;height:2px;background:linear-gradient(to right,#c9a84c,#4dc9b4);z-index:9998;width:0;transition:width .08s;pointer-events:none;';
    document.body.prepend(bar);
  }
  window.addEventListener('scroll', () => {
    const pct = (window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight)) * 100;
    bar.style.width = Math.min(100, pct) + '%';
  }, { passive:true });
}

/* ═══════════════════════════
   BACK-TO-TOP
═══════════════════════════ */
function luminaryBackToTop() {
  let btn = document.getElementById('lum-back-top');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'lum-back-top';
    btn.innerHTML = '↑';
    btn.setAttribute('aria-label','Back to top');
    btn.style.cssText = 'position:fixed;bottom:2rem;right:1.8rem;width:40px;height:40px;background:rgba(10,9,14,.92);border:1px solid rgba(201,168,76,.3);color:#c9a84c;font-family:Josefin Sans,sans-serif;font-size:1rem;display:flex;align-items:center;justify-content:center;z-index:800;opacity:0;transition:opacity .3s,transform .3s;transform:translateY(12px);cursor:pointer;backdrop-filter:blur(6px);border-radius:2px;';
    btn.onclick = () => window.scrollTo({ top:0, behavior:'smooth' });
    document.body.appendChild(btn);
    window.addEventListener('scroll', () => {
      const show = window.scrollY > 400;
      btn.style.opacity = show ? '1' : '0';
      btn.style.transform = show ? 'translateY(0)' : 'translateY(12px)';
    }, { passive:true });
  }
}

/* ═══════════════════════════
   LIGHT MODE THEME
═══════════════════════════ */
function luminaryApplyTheme() {
  const t = LuminaryState.getSettings().theme;
  if (t === 'light') document.documentElement.classList.add('lum-light');
  else document.documentElement.classList.remove('lum-light');
}
function luminaryToggleTheme() {
  const current = LuminaryState.getSettings().theme;
  const next = current === 'light' ? 'dark' : 'light';
  LuminaryState.updateSettings({ theme: next });
  luminaryApplyTheme();
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = next === 'light' ? '☀' : '☽';
  luminaryToast(next === 'light' ? 'Light mode on' : 'Dark mode on');
}

/* ═══════════════════════════
   INIT
═══════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  luminaryScrollProgress();
  luminaryBackToTop();
  luminaryApplyTheme();
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = LuminaryState.getSettings().theme==='light' ? '☀' : '☽';
});

/* Export */
window.LuminaryState     = LuminaryState;
window.luminaryAvatar    = luminaryAvatar;
window.luminaryToast     = luminaryToast;
window.luminaryToggleTheme = luminaryToggleTheme;
