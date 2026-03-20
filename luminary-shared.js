/* ═══════════════════════════════════════════════
   LUMINARY ATELIER — SHARED STATE (luminary-shared.js)
   Cross-page localStorage sync system
═══════════════════════════════════════════════ */
const LS_KEY = 'luminary_state_v2';

const LuminaryState = {
  /* ── READ ── */
  get() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; }
    catch { return {}; }
  },
  /* ── WRITE (merges) ── */
  set(patch) {
    const cur = this.get();
    const next = Object.assign({}, cur, patch);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('luminary:state', { detail: next }));
    return next;
  },
  /* ── PROFILE ── */
  getProfile() {
    return this.get().profile || { name:'Artist', bio:'', avatar:'', joined: new Date().toISOString().slice(0,10) };
  },
  setProfile(data) { return this.set({ profile: { ...this.getProfile(), ...data } }); },
  /* ── LIKES ── */
  getLikes()       { return this.get().likes || []; },
  toggleLike(id)   {
    let likes = this.getLikes();
    if (likes.includes(id)) likes = likes.filter(l=>l!==id);
    else likes = [...likes, id];
    this.set({ likes });
    return likes.includes(id);
  },
  isLiked(id)      { return this.getLikes().includes(id); },
  /* ── BOOKMARKS ── */
  getBookmarks()   { return this.get().bookmarks || []; },
  toggleBookmark(item) {
    let bm = this.getBookmarks();
    const exists = bm.find(b=>b.id===item.id);
    if (exists) bm = bm.filter(b=>b.id!==item.id);
    else bm = [item, ...bm].slice(0,40);
    this.set({ bookmarks: bm });
    return !exists;
  },
  isBookmarked(id) { return this.getBookmarks().some(b=>b.id===id); },
  /* ── RECENT COLORS ── */
  getRecentColors()     { return this.get().recentColors || []; },
  pushRecentColor(hex)  {
    let cols = this.getRecentColors().filter(c=>c!==hex);
    cols = [hex, ...cols].slice(0,16);
    this.set({ recentColors: cols });
  },
  /* ── RECENT ARTWORKS ── */
  getRecentArtworks()   { return this.get().recentArtworks || []; },
  pushRecentArtwork(item) {
    let list = this.getRecentArtworks().filter(a=>a.id!==item.id);
    list = [item, ...list].slice(0,12);
    this.set({ recentArtworks: list });
  },
  /* ── CHALLENGES ── */
  getJoinedChallenges() { return this.get().joinedChallenges || []; },
  joinChallenge(id) {
    let jc = this.getJoinedChallenges();
    if (!jc.includes(id)) { jc = [...jc, id]; this.set({ joinedChallenges: jc }); }
    return jc;
  },
  leaveChallenge(id) {
    let jc = this.getJoinedChallenges().filter(c=>c!==id);
    this.set({ joinedChallenges: jc }); return jc;
  },
  /* ── SUBMISSIONS ── */
  getSubmissions()   { return this.get().submissions || []; },
  addSubmission(item){ let s=[item,...this.getSubmissions()].slice(0,20);this.set({submissions:s});return s; },
  /* ── NOTIFICATIONS ── */
  getNotifications() { return this.get().notifications || []; },
  addNotification(msg,type='info'){
    const n={id:Date.now(),msg,type,time:new Date().toISOString(),read:false};
    let ns=[n,...this.getNotifications()].slice(0,30);
    this.set({notifications:ns});
    return n;
  },
  markAllRead(){ let ns=this.getNotifications().map(n=>({...n,read:true}));this.set({notifications:ns}); },
  getUnreadCount(){ return this.getNotifications().filter(n=>!n.read).length; },
  /* ── STATS ── */
  incrementStat(key){ const s=this.get().stats||{};s[key]=(s[key]||0)+1;this.set({stats:s}); },
  getStats(){ return this.get().stats||{saves:0,uploads:0,likes_given:0}; },
};

/* ── AVATAR HELPER ── */
function luminaryAvatar(name, size=40){
  const initials=(name||'A').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  const colors=['#c9a84c','#7b5ea7','#2a9a8a','#c94a6a','#e07830','#3a6fa8'];
  const color=colors[(name||'A').charCodeAt(0)%colors.length];
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="${color}"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" fill="#fff" font-family="Josefin Sans,sans-serif" font-size="${size*0.38}" font-weight="600">${initials}</text></svg>`;
  return 'data:image/svg+xml;base64,'+btoa(svg);
}

/* ── NOTIFICATION BADGE (inject into any nav) ── */
function luminaryInjectNotifBadge(){
  const count=LuminaryState.getUnreadCount();
  document.querySelectorAll('.notif-badge').forEach(b=>{
    b.textContent=count||'';
    b.style.display=count?'inline-flex':'none';
  });
}
window.addEventListener('luminary:state', luminaryInjectNotifBadge);
document.addEventListener('DOMContentLoaded', luminaryInjectNotifBadge);

/* export for inline script use */
window.LuminaryState = LuminaryState;
window.luminaryAvatar = luminaryAvatar;
