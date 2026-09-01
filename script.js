import { auth, db } from "./firebase-init.js";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { collection, addDoc, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const postsRef = collection(db, "posts");
const applicationsRef = collection(db, "applications");
const teamRef = collection(db, "team");
const announcementsRef = collection(db, "announcements");
const galleryRef = collection(db, "gallery");
const notificationsRef = collection(db, "notifications");
const roadmapDocRef = doc(db, "roadmap", "progress");

// Guarded: these come from third-party CDNs. If one fails to load, an
// uncaught error here would abort this whole module — taking the team-card
// click handling and every Firestore listener down with it over nothing more
// than a missing icon set. Cosmetic libraries must never be load-bearing.
function safe(label, fn) {
  try { fn(); } catch (err) { console.warn(`[init] skipped ${label}:`, err); }
}

safe('lucide icons', () => lucide.createIcons());

// --- GLOBAL UI & UX LISTENERS ---
// Mouse tracking for glowing cards
document.addEventListener('mousemove', (e) => {
  const card = e.target.closest('.glow-card');
  if (card) {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty('--mouse-x', `${x}px`);
    card.style.setProperty('--mouse-y', `${y}px`);
  }
});

// Floating frosted navbar on scroll
const navbar = document.querySelector('.navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });
}

// Run a callback on window 'load' — or immediately, if 'load' has already
// fired by the time this module runs. Listening for an event that is already
// in the past silently never fires, which is exactly how the preloader got
// stuck on screen forever. Everything below is gated on this, so the page can
// never be left in its loading state again regardless of script timing.
function onWindowReady(fn) {
  if (document.readyState === 'complete') fn();
  else window.addEventListener('load', fn);
}

// --- PRELOADER, GSAP & CURSOR PHYSICS ---
onWindowReady(() => {
  setTimeout(() => {
    // Hidden first and unconditionally, before any of the decorative GSAP
    // work below — so even if an animation library misbehaves, the visitor
    // is never left staring at the loading screen.
    const preloader = document.getElementById('preloader');
    if (preloader) preloader.classList.add('hidden');

    safe('gsap scroll animations', () => {
    gsap.registerPlugin(ScrollTrigger);

    gsap.utils.toArray('.gsap-fade-up').forEach(element => {
      gsap.fromTo(element,
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: "power3.out", scrollTrigger: { trigger: element, start: "top 85%" } }
      );
    });

    gsap.to('.glow-1', { backgroundColor: 'rgba(0, 240, 255, 0.15)', scrollTrigger: { trigger: '#about', start: 'top center', end: 'bottom center', scrub: true } });
    gsap.to('.glow-2', { backgroundColor: 'rgba(122, 56, 254, 0.15)', scrollTrigger: { trigger: '#team', start: 'top center', end: 'bottom center', scrub: true } });
    });

    safe('custom cursor', () => {
    if (window.matchMedia("(pointer: fine)").matches) {
      const cursorDot = document.querySelector('.cursor-dot');
      const cursorOutline = document.querySelector('.cursor-outline');
      
      let xTo = gsap.quickTo(cursorOutline, "x", {duration: 0.3, ease: "power3"});
      let yTo = gsap.quickTo(cursorOutline, "y", {duration: 0.3, ease: "power3"});
      
      window.addEventListener('mousemove', e => {
        gsap.set(cursorDot, {x: e.clientX, y: e.clientY});
        xTo(e.clientX); yTo(e.clientY);
      });

      document.querySelectorAll('a, button, .div-card, .bento-card, .team-card, .post, select, input, textarea, .swiper-button-next, .swiper-button-prev, .swiper-pagination-bullet').forEach(el => {
        el.addEventListener('mouseenter', () => cursorOutline.classList.add('hover'));
        el.addEventListener('mouseleave', () => cursorOutline.classList.remove('hover'));
      });
      
      document.querySelectorAll('.magnetic-el').forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
          const rect = btn.getBoundingClientRect();
          const x = (e.clientX - rect.left - rect.width / 2) * 0.3; 
          const y = (e.clientY - rect.top - rect.height / 2) * 0.3;
          gsap.to(btn, { x: x, y: y, duration: 0.4, ease: "power2.out" });
        });
        btn.addEventListener('mouseleave', () => {
          gsap.to(btn, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1, 0.3)" });
        });
      });
    }
    });
  }, 1900);
});

function animateCount(el, from, to, duration = 1.2) {
  if(!el) return;
  const obj = { val: from };
  gsap.to(obj, { val: to, duration, ease: "power2.out", onUpdate: () => { el.textContent = Math.round(obj.val).toLocaleString(); } });
}

(function countdown(){
  const target = new Date('2027-06-01T00:00:00');
  const days = Math.max(0, Math.ceil((target - new Date()) / 86400000));
  const tickDaysEl = document.getElementById('tickDays');
  ScrollTrigger.create({ trigger: '.ticker', start: 'top 80%', onEnter: () => animateCount(tickDaysEl, 0, days) });
})();

// --- MOBILE MENU ---
const menuBtn = document.getElementById('menuBtn');
const navLinks = document.querySelector('.nav-links');
menuBtn?.addEventListener('click', (e) => { e.stopPropagation(); navLinks.classList.toggle('open'); });
document.addEventListener('click', (e) => { if(navLinks?.classList.contains('open') && !navLinks.contains(e.target) && e.target !== menuBtn) { navLinks.classList.remove('open'); } });

function fmtDate(ts){ const d = ts && ts.toDate ? ts.toDate() : new Date(ts || Date.now()); return d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }); }
function escapeHtml(str){ const div = document.createElement('div'); div.textContent = str || ''; return div.innerHTML; }

function resizeAndEncode(file, maxDim, quality){
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      if(width > maxDim || height > maxDim){
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale); height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error());
    img.src = url;
  });
}
async function encodeImageForFirestore(file){
  let dataUrl = await resizeAndEncode(file, 900, 0.72);
  if(dataUrl.length > 900000) dataUrl = await resizeAndEncode(file, 700, 0.5);
  return dataUrl;
}

function setupPhotoInput(inputEl, previewWrap, previewImg, removeBtn, onEncoded){
  if(!inputEl) return;
  inputEl.addEventListener('change', async () => {
    const f = inputEl.files[0];
    if(!f) return;
    try{ const dataUrl = await encodeImageForFirestore(f); onEncoded(dataUrl); previewImg.src = dataUrl; previewWrap.style.display = 'flex'; }catch(err){}
  });
  removeBtn.addEventListener('click', () => { inputEl.value = ''; previewWrap.style.display = 'none'; onEncoded(null); });
}

let pendingPostImage = null; let pendingMemberPhoto = null;
setupPhotoInput(document.getElementById('pImage'), document.getElementById('pImagePreview'), document.getElementById('pImagePreviewImg'), document.getElementById('pImageRemove'), (d) => pendingPostImage = d);
setupPhotoInput(document.getElementById('mPhoto'), document.getElementById('mPhotoPreview'), document.getElementById('mPhotoPreviewImg'), document.getElementById('mPhotoRemove'), (d) => pendingMemberPhoto = d);

// --- FIREBASE: BLOG ---
const blogList = document.getElementById('blogList');
onSnapshot(query(postsRef, orderBy('createdAt', 'desc')), (snapshot) => {
  if(!blogList) return;
  const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  if(!posts.length) { blogList.innerHTML = `<div class="empty-state">No posts yet. Be the first to log a build update.</div>`; return; }
  blogList.innerHTML = posts.map(p => `
    <article class="post">
      ${p.image ? `<div class="post-image-wrap"><img src="${p.image}" class="post-image"></div>` : ''}
      <div class="post-head"><div><div class="post-meta"><span>${fmtDate(p.createdAt)}</span><span>·</span><span>${escapeHtml(p.author || 'Team')}</span>${p.tag ? `<span>·</span><span class="post-tag">${escapeHtml(p.tag)}</span>` : ''}</div><div class="post-title">${escapeHtml(p.title)}</div></div><i data-lucide="chevron-down" class="chevron"></i></div>
      <div class="post-body">${escapeHtml(p.body)}</div>
    </article>`).join('');
  lucide.createIcons();
  blogList.querySelectorAll('.post').forEach(el => { el.addEventListener('click', () => el.classList.toggle('open')); });
});

// --- FIREBASE: TEAM (BULLETPROOF SWIPER ROUTING) ---
const teamGrid = document.getElementById('teamGrid');
let teamSwiper;

function initTeamSwiper() {
  if (teamSwiper) teamSwiper.destroy(true, true);
  teamSwiper = new Swiper('.team-swiper', {
    effect: 'coverflow',
    grabCursor: true,
    centeredSlides: true,
    slidesPerView: 'auto',
    loop: false,
    speed: 800,
    autoplay: { delay: 3500, disableOnInteraction: true, pauseOnMouseEnter: true },
    keyboard: { enabled: true },
    navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
    coverflowEffect: { rotate: 20, stretch: 0, depth: 150, modifier: 1, slideShadows: true },
    pagination: { el: '.swiper-pagination', clickable: true },
    // Swiper's stock threshold is 5px, which is less than the drift of an
    // ordinary hand clicking a mouse — so the carousel would slide out from
    // under a click that was only ever meant as a click. Raising it means
    // small movement is ignored entirely and the card you pressed is still
    // the card you release on.
    // Anything under this is discarded by Swiper before its short/long swipe
    // logic ever sees it, so quick flicks stay available for browsing without
    // hand-drift being able to masquerade as one.
    threshold: 18,
    longSwipesRatio: 0.2,
    // No `on: { click }` here on purpose — see the plain click listener on
    // teamGrid below for why.
  });
}

// Navigation lives on a plain, native click listener on document (capture
// phase), NOT Swiper's own `on: { click }` event. Swiper tracks touch/mouse
// movement internally to tell a drag from a tap, and it turned out to
// disqualify a click as a "drag" from even a few pixels of movement between
// mousedown and mouseup — which is normal for a real hand on a mouse or
// trackpad, so real users' clicks were silently swallowed even though the
// browser's own native click event (which we use here instead) fired
// correctly and landed on the right card the whole time.
//
// That means we need our own tap-vs-drag check. Rather than guess at a pixel
// threshold, the primary test asks Swiper the question directly: did this
// gesture actually browse the carousel? If the active slide changed between
// pointerdown and click, it was a swipe — leave them where they navigated to.
// If the carousel didn't move at all, the user was pointing at one card, and
// that's a selection no matter how shaky the hand was holding the mouse. A
// generous distance cap only catches the leftover case of a long drag that
// snapped back to the same slide.
//
// This tracking uses the 'pointerdown' event, NOT 'mousedown'/'touchstart'.
// Swiper calls preventDefault() on the underlying pointer event to stop
// native drag/selection while dragging a slide — and per spec, that
// suppresses the browser's synthesized "compatibility" mouse events
// (mousedown/mouseup) for that whole gesture. 'pointerdown'/'pointerup'
// are the real, un-suppressed events and fire reliably for mouse, touch,
// and pen alike, which is why we use them here instead.
const TEAM_DRAG_SLOP_PX = 40; // deliberately forgiving; see reasoning above
let teamPointerDownPos = null;
document.addEventListener('pointerdown', (e) => {
  if (teamGrid.contains(e.target)) {
    teamPointerDownPos = {
      x: e.clientX,
      y: e.clientY,
      slide: teamSwiper ? teamSwiper.activeIndex : null,
    };
  }
}, true);

document.addEventListener('click', function(event) {
  if (!teamGrid.contains(event.target)) return;
  const downPos = teamPointerDownPos;
  teamPointerDownPos = null;
  if (downPos) {
    // Did the carousel actually move? That's a browse gesture, not a pick.
    const slideNow = teamSwiper ? teamSwiper.activeIndex : null;
    if (downPos.slide !== null && slideNow !== null && slideNow !== downPos.slide) return;
    // Otherwise only reject an implausibly long drag that happened to land
    // back on the slide it started from.
    const dist = Math.hypot(event.clientX - downPos.x, event.clientY - downPos.y);
    if (dist > TEAM_DRAG_SLOP_PX) return;
  }
  let clickedCard = event.target.closest('.team-card');
  let via = 'direct-hit';
  if (!clickedCard) {
    // The coverflow effect rotates off-center cards in 3D, which can make the
    // browser resolve a click to the (invisible) swiper-wrapper behind the
    // card instead of the card itself. Fallback: manually check every card's
    // on-screen box for the actual click point, regardless of which element
    // the browser thinks is "on top" there.
    const candidates = Array.from(document.querySelectorAll('#teamGrid .team-card'))
      .map(card => {
        const rect = card.getBoundingClientRect();
        const slide = card.closest('.swiper-slide');
        const z = slide ? parseFloat(getComputedStyle(slide).zIndex) || 0 : 0;
        return { card, rect, z };
      })
      .filter(({ rect }) => event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom)
      .sort((a, b) => b.z - a.z);
    if (candidates.length) { clickedCard = candidates[0].card; via = 'rect-fallback'; }
    else { via = 'no-card-under-click'; }
  }
  // If the edit button was clicked, open edit modal instead of navigating to profile
  const editBtn = event.target.closest('.team-card-edit-btn');
  if (editBtn) {
    event.stopPropagation();
    event.preventDefault();
    const memberId = editBtn.getAttribute('data-id');
    openEditMemberModal(memberId);
    return;
  }

  // Diagnostic breadcrumb, timestamped so a stale one from an earlier click
  // can never be mistaken for what just happened. Overwritten (or cleared)
  // by member.js the moment it's read, so it can't linger and mislead.
  try {
    sessionStorage.setItem('lastTeamClickDebug', JSON.stringify({
      at: new Date().toISOString(),
      via,
      target: event.target.className || event.target.tagName,
      clientX: event.clientX, clientY: event.clientY,
      memberId: clickedCard ? clickedCard.getAttribute('data-id') : null,
      cardCount: document.querySelectorAll('#teamGrid .team-card').length,
    }));
  } catch (e) {}
  if (clickedCard) {
    const memberId = clickedCard.getAttribute('data-id');
    if (memberId && memberId !== 'undefined') {
      // Belt-and-suspenders: stash the id in sessionStorage as well as the
      // URL. If anything between here and member.js loading strips or
      // rewrites the query string (a dev-server auto-reload triggering
      // mid-navigation is the prime suspect if this keeps happening),
      // member.js can still recover the id this way instead of showing
      // "Profile Not Found" for a click that actually worked.
      try { sessionStorage.setItem('pendingProfileId', memberId); } catch (e) {}
      window.location.href = `member.html?id=${memberId}`;
    }
  }
}, true); // capture phase — Swiper's own internal click handling can call
          // stopPropagation() on the bubble phase once it decides a gesture
          // involved "too much" movement; running in capture means we see
          // the click before that happens, regardless of what Swiper does
          // with it afterward.

function getMemberPriority(m) {
  if (!m) return 99;
  const isFounder = m.isFounder === true || (m.role && m.role.toLowerCase().includes('founder'));
  if (isFounder) return 1;
  const r = (m.role || '').toLowerCase();
  if (r.includes('lead') || r.includes('captain')) return 2;
  if (r.includes('driver')) return 3;
  return 4;
}

function getRoleBadgeClass(role) {
  if (!role) return '';
  const r = role.toLowerCase();
  if (r.includes('founder')) return 'founder';
  if (r.includes('lead') || r.includes('captain')) return 'lead';
  if (r.includes('driver')) return 'driver';
  return '';
}

function renderMemberBadges(m) {
  const isFounder = m.isFounder === true || (m.role && m.role.toLowerCase() === 'founder');
  const role = m.role || '';
  const rLower = role.toLowerCase();
  const badges = [];

  if (isFounder) {
    badges.push(`<span class="team-badge founder">Founder</span>`);
  }

  if (role && rLower !== 'founder' && rLower !== 'member') {
    const cleanRole = isFounder ? role.replace(/Founder\s*(&|\/|\+)?\s*/i, '').trim() : role;
    if (cleanRole && cleanRole.toLowerCase() !== 'founder' && cleanRole.toLowerCase() !== 'member') {
      badges.push(`<span class="team-badge ${getRoleBadgeClass(cleanRole)}">${escapeHtml(cleanRole)}</span>`);
    }
  } else if (!isFounder && role && rLower !== 'member') {
    badges.push(`<span class="team-badge ${getRoleBadgeClass(role)}">${escapeHtml(role)}</span>`);
  }

  return badges.length ? `<div class="team-badges-wrap">${badges.join('')}</div>` : '';
}

let latestTeamMembers = [];

function renderTeamGrid() {
  if(!teamGrid) return;
  if(!latestTeamMembers.length) { 
    teamGrid.innerHTML = `<div class="empty-state" style="width:100%;text-align:center;">No team members yet.</div>`; 
    return; 
  }
  
  teamGrid.innerHTML = latestTeamMembers.map(m => {
    const verticals = Array.isArray(m.verticals) ? m.verticals : (m.vertical ? [m.vertical] : []);
    const badgesHtml = renderMemberBadges(m);
    const editBtnHtml = currentUser 
      ? `<button class="team-card-edit-btn" data-id="${m.dbKey}" title="Edit tags & details"><i data-lucide="edit-3" style="width:12px;height:12px;"></i> Edit</button>` 
      : '';
    return `
    <div class="swiper-slide">
      <!-- Attached the dbKey safely to data-id -->
      <div class="team-card glow-card magnetic-el" data-id="${m.dbKey}" style="cursor:pointer;">
        ${editBtnHtml}
        <div class="team-avatar">${m.photo ? `<img src="${m.photo}">` : escapeHtml((m.name || '?')[0].toUpperCase())}</div>
        <h3 class="team-name">${escapeHtml(m.name)}</h3>
        ${badgesHtml}
        <div class="team-verticals">${verticals.map(v => `<span class="team-tag">${escapeHtml(v)}</span>`).join('')}</div>
      </div>
    </div>`;
  }).join('');
  
  safe('lucide in team cards', () => lucide.createIcons());
  setTimeout(initTeamSwiper, 100);
}

onSnapshot(query(teamRef, orderBy('createdAt', 'asc')), (snapshot) => {
  // Extract doc.id safely as dbKey
  latestTeamMembers = snapshot.docs.map(doc => {
    return { dbKey: doc.id, ...doc.data() }; 
  });
  
  latestTeamMembers.sort((a, b) => {
    const diff = getMemberPriority(a) - getMemberPriority(b);
    if (diff !== 0) return diff;
    return (a.name || '').localeCompare(b.name || '');
  });
  const tickMembers = document.getElementById('tickMembers');
  if(tickMembers) animateCount(tickMembers, parseInt(tickMembers.textContent) || 0, latestTeamMembers.length || 0);

  renderTeamGrid();
});

// --- FIREBASE: ANNOUNCEMENTS ---
const announceList = document.getElementById('announceList');
const navAnnounceAlert = document.getElementById('navAnnounceAlert');
onSnapshot(query(announcementsRef, orderBy('createdAt', 'desc')), (snapshot) => {
  if(!announceList) return;
  const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  if(!items.length) { announceList.innerHTML = `<div class="empty-state">No announcements yet.</div>`; if(navAnnounceAlert) navAnnounceAlert.style.display = 'none'; return; }
  announceList.innerHTML = items.map(a => `
    <div class="announce-card glow-card ${a.priority === 'urgent' ? 'urgent' : ''}">
      <div class="announce-head"><span class="announce-badge ${a.priority === 'urgent' ? 'urgent' : ''}">${a.priority === 'urgent' ? 'Urgent' : 'Notice'}</span><span class="announce-date">${fmtDate(a.createdAt)}</span></div>
      <h3 class="announce-title">${escapeHtml(a.title)}</h3><p class="announce-body">${escapeHtml(a.body)}</p><div class="announce-author">— ${escapeHtml(a.author || 'Team')}</div>
    </div>`).join('');
  if(navAnnounceAlert) navAnnounceAlert.style.display = items.some(a => a.priority === 'urgent') ? 'inline-block' : 'none';
});

// --- FIREBASE: ROADMAP ---
onSnapshot(roadmapDocRef, (docSnap) => {
  const states = docSnap.exists() ? docSnap.data() : {};
  for(let i = 1; i <= 7; i++) {
    const stepEl = document.querySelector(`.rstep[data-n="${i}"]`);
    if(!stepEl) continue;
const state = states[i] !== undefined ? states[i] : 1; 
    stepEl.classList.remove('done', 'in-progress');
    const tag = stepEl.querySelector('.rtag');
    if(state === 2) { stepEl.classList.add('done'); tag.textContent = 'Completed'; } 
    else if(state === 0) { stepEl.classList.add('in-progress'); tag.textContent = 'In Progress'; } 
    else { tag.textContent = 'Upcoming'; }
  }
});

// --- AUTH & MODAL CONTROLS ---
let currentUser = null;
let currentUserTeamProfile = null;
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  renderTeamGrid();
  renderGalleryGrid();
  const openAddMediaBtn = document.getElementById('openAddMediaBtn');
  if (openAddMediaBtn) {
    openAddMediaBtn.style.display = user ? 'inline-flex' : 'none';
  }
  const authStatus = document.getElementById('authStatus');
  const notifBtn = document.getElementById('notifBtn');
  const notifBadge = document.getElementById('notifBadge');
  const notifDropdown = document.getElementById('notifDropdown');
  const notifList = document.getElementById('notifList');

  if(user){
    if(authStatus) {
      authStatus.innerHTML = `<span class="live-dot"></span>Signed in as ${escapeHtml(user.email)} · <a href="admin.html">Applications</a> · <button id="signOutBtn" style="color:var(--accent);">Sign out</button>`;
      document.getElementById('signOutBtn')?.addEventListener('click', () => signOut(auth));
    }
    if(notifBtn) notifBtn.style.display = 'inline-flex';
    const navSignInBtn = document.getElementById('navSignInBtn');
    if(navSignInBtn) navSignInBtn.style.display = 'none';

    // Fetch team profile to get varying permissions
    onSnapshot(query(teamRef, where("authEmail", "==", user.email)), (snap) => {
      if (!snap.empty) {
        currentUserTeamProfile = { id: snap.docs[0].id, ...snap.docs[0].data() };
      }
    });

    // Listen to notifications
    onSnapshot(query(notificationsRef, orderBy('createdAt', 'desc')), (snap) => {
      const notifs = snap.docs.map(d => ({id: d.id, ...d.data()}))
        .filter(n => n.recipient === 'all' || n.recipient === user.email || (currentUserTeamProfile && n.roleGroup === currentUserTeamProfile.role));
      
      const readIds = JSON.parse(localStorage.getItem(`readNotifs_${user.uid}`) || '[]');
      
      if(notifList) {
        if(!notifs.length) {
          notifList.innerHTML = '<div style="text-align:center;padding:20px;">No new notifications</div>';
          if(notifBadge) notifBadge.style.display = 'none';
        } else {
          const unread = notifs.filter(n => !readIds.includes(n.id)).length;
          if(notifBadge) notifBadge.style.display = unread > 0 ? 'inline-block' : 'none';
          
          notifList.innerHTML = notifs.map(n => `
            <div style="padding:10px; border-radius:6px; background:${readIds.includes(n.id) ? 'transparent' : 'rgba(230,57,70,0.1)'}; border:1px solid ${readIds.includes(n.id) ? 'var(--border-subtle)' : 'var(--accent)'}; transition: all 0.2s;">
              <strong style="display:block; margin-bottom:4px; color:${readIds.includes(n.id) ? 'var(--text-secondary)' : 'var(--text-primary)'};">${escapeHtml(n.title)}</strong>
              <span style="font-size:12px;">${escapeHtml(n.body)}</span>
              ${n.type ? `<div style="margin-top:6px;"><span class="announce-badge">${escapeHtml(n.type)}</span></div>` : ''}
            </div>
          `).join('');
        }
      }
      
      document.getElementById('markAllReadBtn')?.addEventListener('click', () => {
        const allIds = notifs.map(n => n.id);
        localStorage.setItem(`readNotifs_${user.uid}`, JSON.stringify(allIds));
        if(notifBadge) notifBadge.style.display = 'none';
        notifList?.querySelectorAll('div').forEach(d => {
          d.style.background = 'transparent';
          d.style.borderColor = 'var(--border-subtle)';
          const strong = d.querySelector('strong');
          if(strong) strong.style.color = 'var(--text-secondary)';
        });
      });
    });

  }else{ 
    if(authStatus) authStatus.innerHTML = ''; 
    if(notifBtn) notifBtn.style.display = 'none';
    const navSignInBtn = document.getElementById('navSignInBtn');
    if(navSignInBtn) navSignInBtn.style.display = 'inline-flex';
    currentUserTeamProfile = null;
  }
});

// Dropdown toggle
document.getElementById('notifBtn')?.addEventListener('click', (e) => {
  const dd = document.getElementById('notifDropdown');
  if(dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
});

// Close dropdown on outside click
document.addEventListener('click', (e) => {
  const btn = document.getElementById('notifBtn');
  const dd = document.getElementById('notifDropdown');
  if (btn && dd && !btn.contains(e.target) && !dd.contains(e.target)) {
    dd.style.display = 'none';
  }
});

const modalBackdrop = document.getElementById('modalBackdrop');
const applyModalBackdrop = document.getElementById('applyModalBackdrop');
let targetAction = 'post';

function showAuthedStep(){
  ['signInStep', 'postStep', 'teamStep', 'editTeamStep', 'announceStep', 'roadmapStep'].forEach(id => { const el = document.getElementById(id); if(el) el.style.display = 'none'; });
  if(targetAction === 'post') { document.getElementById('modalTitle').textContent = 'New Build Log Post'; document.getElementById('postStep').style.display = 'block'; }
  else if(targetAction === 'team') { document.getElementById('modalTitle').textContent = 'Add Team Member'; document.getElementById('teamStep').style.display = 'block'; }
  else if(targetAction === 'announcement') { document.getElementById('modalTitle').textContent = 'Post Announcement'; document.getElementById('announceStep').style.display = 'block'; }
  else if(targetAction === 'roadmap') { document.getElementById('modalTitle').textContent = 'Update Roadmap Progress'; document.getElementById('roadmapStep').style.display = 'block'; }
}

function openTeamOrPostModal(action){
  targetAction = action;
  if(currentUser){ showAuthedStep(); }
  else{
    document.getElementById('modalTitle').textContent = 'Team Sign In';
    ['signInStep', 'postStep', 'teamStep', 'editTeamStep', 'announceStep', 'roadmapStep'].forEach(id => { const el = document.getElementById(id); if(el) el.style.display = 'none'; });
    document.getElementById('signInStep').style.display = 'block';
  }
  modalBackdrop.classList.add('show');
}

function openEditMemberModal(memberId) {
  const member = latestTeamMembers.find(m => m.dbKey === memberId);
  if (!member) return;
  document.getElementById('editMId').value = memberId;
  document.getElementById('editMName').value = member.name || '';
  document.getElementById('editMRoll').value = member.rollNo || '';
  
  const isFounder = member.isFounder === true || (member.role && member.role.toLowerCase().includes('founder'));
  const founderCb = document.getElementById('editMIsFounder');
  if (founderCb) founderCb.checked = isFounder;
  
  let roleVal = member.role || 'Member';
  document.getElementById('editMRole').value = roleVal;
  document.getElementById('editMBio').value = member.bio || '';
  const editMsg = document.getElementById('editTeamMsg');
  if (editMsg) { editMsg.textContent = ''; editMsg.className = 'form-msg'; }

  const currentVerticals = Array.isArray(member.verticals) ? member.verticals : (member.vertical ? [member.vertical] : []);
  const editBoxes = document.querySelectorAll('#editMVerticalMulti input[type="checkbox"]');
  editBoxes.forEach(cb => {
    cb.checked = currentVerticals.includes(cb.value);
  });

  ['signInStep', 'postStep', 'teamStep', 'editTeamStep', 'announceStep', 'roadmapStep'].forEach(id => { 
    const el = document.getElementById(id); 
    if(el) el.style.display = 'none'; 
  });
  document.getElementById('editTeamStep').style.display = 'block';
  document.getElementById('modalTitle').textContent = 'Edit Team Member';
  modalBackdrop.classList.add('show');
}

document.getElementById('newPostBtn')?.addEventListener('click', () => openTeamOrPostModal('post'));
document.getElementById('addTeamBtn')?.addEventListener('click', () => openTeamOrPostModal('team'));
document.getElementById('newAnnouncementBtn')?.addEventListener('click', () => openTeamOrPostModal('announcement'));
document.getElementById('updateRoadmapBtn')?.addEventListener('click', () => openTeamOrPostModal('roadmap'));
document.getElementById('navSignInBtn')?.addEventListener('click', () => openTeamOrPostModal('signin'));

document.querySelectorAll('.close-modal-btn, .btn-cancel, #cancelSignIn, #cancelEditTeam').forEach(btn => {
  btn.addEventListener('click', () => { modalBackdrop.classList.remove('show'); applyModalBackdrop.classList.remove('show'); });
});

document.getElementById('doSignIn').addEventListener('click', async () => {
  const msg = document.getElementById('signInMsg');
  try { 
    await signInWithEmailAndPassword(auth, document.getElementById('emailInput').value, document.getElementById('passInput').value); 
    if (targetAction === 'signin') {
      modalBackdrop.classList.remove('show');
    } else {
      showAuthedStep(); 
    }
  } 
  catch (err) { msg.textContent = "Sign-in failed — check credentials."; }
});

document.getElementById('publishPost').addEventListener('click', async () => {
  const title = document.getElementById('pTitle').value.trim(); const author = document.getElementById('pAuthor').value.trim(); const tag = document.getElementById('pTag').value.trim(); const body = document.getElementById('pBody').value.trim();
  if(!title || !body) return;
  try{ await addDoc(postsRef, { title, author, tag, body, image: pendingPostImage || null, createdAt: serverTimestamp(), authorUid: currentUser.uid }); modalBackdrop.classList.remove('show'); document.getElementById('pTitle').value = ''; document.getElementById('pBody').value = ''; }catch(err){}
});

const mRole = document.getElementById('mRole');
const mIsFounder = document.getElementById('mIsFounder');
const mVerticalSingleWrap = document.getElementById('mVerticalSingleWrap');
const mVerticalMultiWrap = document.getElementById('mVerticalMultiWrap');
const mVerticalMultiBoxes = document.querySelectorAll('#mVerticalMulti input[type="checkbox"]');

function checkAddMemberVerticalMode() {
  const isFounderChecked = mIsFounder ? mIsFounder.checked : false;
  const roleVal = mRole ? mRole.value.toLowerCase() : '';
  const isMulti = isFounderChecked || roleVal.includes('founder') || roleVal.includes('lead') || roleVal.includes('captain');
  if(isMulti){ 
    mVerticalSingleWrap.style.display = 'none'; 
    mVerticalMultiWrap.style.display = 'block'; 
  } else { 
    mVerticalMultiWrap.style.display = 'none'; 
    mVerticalSingleWrap.style.display = 'block'; 
  }
}

if(mRole) mRole.addEventListener('change', checkAddMemberVerticalMode);
if(mIsFounder) mIsFounder.addEventListener('change', checkAddMemberVerticalMode);

document.getElementById('submitTeam').addEventListener('click', async () => {
  const name = document.getElementById('mName').value.trim(); 
  const authEmail = document.getElementById('mAuthEmail')?.value.trim() || null;
  const rollNo = document.getElementById('mRoll').value.trim(); 
  const isFounder = mIsFounder ? mIsFounder.checked : false;
  let role = mRole.value; 
  if (isFounder && role === 'Member') { role = 'Founder'; }
  const bio = document.getElementById('mBio').value.trim();
  const isMulti = isFounder || role.toLowerCase().includes('founder') || role.toLowerCase().includes('lead') || (mVerticalMultiWrap && mVerticalMultiWrap.style.display === 'block');
  const verticals = isMulti 
    ? Array.from(mVerticalMultiBoxes).filter(cb => cb.checked).map(cb => cb.value) 
    : (document.getElementById('mVertical').value ? [document.getElementById('mVertical').value] : []);
  const msg = document.getElementById('teamMsg');
  const submitBtn = document.getElementById('submitTeam');

  if(!name || !rollNo || verticals.length === 0) {
    if (msg) {
      msg.textContent = 'Please provide name, roll number, and at least one vertical.';
      msg.className = 'form-msg err';
    }
    return;
  }
  
  if (submitBtn) submitBtn.disabled = true;
  if (msg) { msg.textContent = 'Adding to roster...'; msg.className = 'form-msg'; }

  try{ 
    await addDoc(teamRef, { 
      name, 
      authEmail,
      rollNo, 
      isFounder,
      verticals, 
      role, 
      bio, 
      photo: pendingMemberPhoto || null, 
      createdAt: serverTimestamp(), 
      addedByUid: currentUser?.uid || null 
    }); 
    modalBackdrop.classList.remove('show'); 
  } catch(err){
    console.error("Add team error:", err);
    if (msg) {
      msg.textContent = 'Failed to add member: ' + (err.message || err.code);
      msg.className = 'form-msg err';
    }
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
});

document.getElementById('saveEditTeam')?.addEventListener('click', async () => {
  const id = document.getElementById('editMId').value;
  const name = document.getElementById('editMName').value.trim();
  const authEmail = document.getElementById('editMAuthEmail')?.value.trim() || null;
  const rollNo = document.getElementById('editMRoll').value.trim();
  const isFounder = document.getElementById('editMIsFounder')?.checked || false;
  let role = document.getElementById('editMRole').value;
  if (isFounder && role === 'Member') { role = 'Founder'; }
  const bio = document.getElementById('editMBio').value.trim();
  const editBoxes = document.querySelectorAll('#editMVerticalMulti input[type="checkbox"]');
  const verticals = Array.from(editBoxes).filter(cb => cb.checked).map(cb => cb.value);
  const msg = document.getElementById('editTeamMsg');
  const saveBtn = document.getElementById('saveEditTeam');

  if (!name || !rollNo || verticals.length === 0) {
    if (msg) {
      msg.textContent = 'Please provide name, roll number, and at least one vertical tag.';
      msg.className = 'form-msg err';
    }
    return;
  }

  if (saveBtn) saveBtn.disabled = true;
  if (msg) {
    msg.textContent = 'Saving changes...';
    msg.className = 'form-msg';
  }

  try {
    await updateDoc(doc(db, "team", id), {
      name,
      authEmail,
      rollNo,
      isFounder,
      role,
      verticals,
      bio,
      updatedAt: serverTimestamp(),
      lastUpdatedByUid: currentUser?.uid || null
    });
    modalBackdrop.classList.remove('show');
  } catch (err) {
    console.error('Error updating member:', err);
    if (msg) {
      msg.textContent = 'Failed to save changes: ' + (err.message || err.code);
      msg.className = 'form-msg err';
    }
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
});

document.getElementById('publishAnnounce').addEventListener('click', async () => {
  const title = document.getElementById('anTitle').value.trim(); const priority = document.getElementById('anPriority').value; const body = document.getElementById('anBody').value.trim();
  if(!title || !body) return;
  try{ await addDoc(announcementsRef, { title, priority, body, author: currentUser.email, authorUid: currentUser.uid, createdAt: serverTimestamp() }); modalBackdrop.classList.remove('show'); }catch(err){}
});

document.getElementById('publishRoadmap')?.addEventListener('click', async () => {
  const stepNum = document.getElementById('rStepNum').value; const statusVal = parseInt(document.getElementById('rStatus').value, 10);
  try{ await setDoc(roadmapDocRef, { [stepNum]: statusVal }, { merge: true }); modalBackdrop.classList.remove('show'); }catch(err){}
});

const aName = document.getElementById('aName'); const aEmail = document.getElementById('aEmail'); const aBranch = document.getElementById('aBranch'); const aRoll = document.getElementById('aRoll'); const aVertical = document.getElementById('aVertical'); const aWhy = document.getElementById('aWhy'); const applyMsg = document.getElementById('applyMsg'); const submitApplyBtn = document.getElementById('submitApply');
function openApplyModal(prefillVertical){ if(aName) aName.value = ''; if(aEmail) aEmail.value = ''; if(aBranch) aBranch.value = ''; if(aRoll) aRoll.value = ''; if(aWhy) aWhy.value = ''; if(aVertical) aVertical.value = prefillVertical || ''; if(applyMsg) applyMsg.textContent = ''; applyModalBackdrop.classList.add('show'); }

[document.getElementById('navJoinBtn'), document.getElementById('heroJoinBtn'), document.getElementById('applyNowBtn')].forEach(btn => { if(btn) btn.addEventListener('click', (e) => { e.preventDefault(); openApplyModal(); }); });
document.querySelectorAll('.join-apply').forEach(btn => { btn.addEventListener('click', () => openApplyModal(btn.dataset.vertical)); });

submitApplyBtn?.addEventListener('click', async () => {
  const name = aName.value.trim(); const email = aEmail.value.trim(); const branch = aBranch.value.trim(); const roll = aRoll.value.trim(); const vertical = aVertical.value; const why = aWhy.value.trim();
  if(!name || !email || !branch || !roll || !vertical){ applyMsg.textContent = 'Please fill in all fields.'; applyMsg.className = 'form-msg err'; return; }
  submitApplyBtn.disabled = true; applyMsg.textContent = 'Submitting…'; applyMsg.className = 'form-msg';
  try{ await addDoc(applicationsRef, { name, email, branch, roll, vertical, why, createdAt: serverTimestamp() }); applyMsg.textContent = 'Application received!'; applyMsg.className = 'form-msg ok'; setTimeout(() => { applyModalBackdrop.classList.remove('show'); submitApplyBtn.disabled = false; }, 1100); }
  catch(err){ applyMsg.textContent = 'Submission error.'; applyMsg.className = 'form-msg err'; submitApplyBtn.disabled = false; }
});

/* --- WORKSHOP BUILD GALLERY & LIGHTBOX --- */
const DEFAULT_GALLERY_ITEMS = [];

let firestoreGalleryItems = [];
let deletedDefaultIds = new Set();
let activeGalleryFilter = 'all';
let currentFilteredGallery = [];
let currentLightboxIndex = 0;
let pendingMediaPhoto = null;

const galleryGrid = document.getElementById('galleryGrid');
const galleryLightbox = document.getElementById('galleryLightbox');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxTag = document.getElementById('lightboxTag');
const lightboxTitle = document.getElementById('lightboxTitle');

// Real-time Firestore sync for gallery media
onSnapshot(query(galleryRef, orderBy('createdAt', 'desc')), (snapshot) => {
  firestoreGalleryItems = snapshot.docs.map(d => ({
    id: d.id,
    isFirestore: true,
    ...d.data()
  }));
  renderGalleryGrid();
});

function renderGalleryGrid() {
  if (!galleryGrid) return;
  
  const allItems = [
    ...firestoreGalleryItems,
    ...DEFAULT_GALLERY_ITEMS.filter(i => !deletedDefaultIds.has(i.id))
  ];

  currentFilteredGallery = activeGalleryFilter === 'all' 
    ? allItems 
    : allItems.filter(item => item.category === activeGalleryFilter);

  if (currentFilteredGallery.length === 0) {
    galleryGrid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1; text-align:center;">No media in this category yet.</div>`;
    return;
  }

  galleryGrid.innerHTML = currentFilteredGallery.map((item, idx) => {
    const delBtnHtml = currentUser 
      ? `<button class="gallery-card-del-btn" data-id="${item.id}" data-is-fs="${item.isFirestore ? '1' : '0'}" title="Remove image"><i data-lucide="trash-2" size="14"></i></button>`
      : '';
    return `
      <div class="gallery-card magnetic-el" data-idx="${idx}">
        ${delBtnHtml}
        <img src="${item.src}" alt="${escapeHtml(item.title)}" loading="lazy">
        <div class="gallery-card-overlay">
          <span class="gallery-tag">${escapeHtml(item.tag)}</span>
          <div class="gallery-title">${escapeHtml(item.title)}</div>
        </div>
      </div>
    `;
  }).join('');

  safe('lucide in gallery', () => lucide.createIcons());

  document.querySelectorAll('.gallery-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Don't open lightbox if clicking the delete button
      if (e.target.closest('.gallery-card-del-btn')) return;
      const idx = parseInt(card.dataset.idx, 10);
      openLightbox(idx);
    });
  });

  document.querySelectorAll('.gallery-card-del-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      const id = btn.dataset.id;
      const isFs = btn.dataset.isFs === '1';
      if (!confirm("Are you sure you want to remove this image from the gallery?")) return;
      
      if (isFs) {
        try {
          await deleteDoc(doc(db, "gallery", id));
        } catch (err) {
          console.error("Error deleting gallery item:", err);
          alert("Failed to delete image: " + (err.message || err.code));
        }
      } else {
        deletedDefaultIds.add(id);
        renderGalleryGrid();
      }
    });
  });
}

function openLightbox(index) {
  if (!galleryLightbox || index < 0 || index >= currentFilteredGallery.length) return;
  currentLightboxIndex = index;
  const item = currentFilteredGallery[index];
  if (lightboxImg) lightboxImg.src = item.src;
  if (lightboxTag) lightboxTag.textContent = item.tag;
  if (lightboxTitle) lightboxTitle.textContent = item.title;
  galleryLightbox.classList.add('show');
}

function closeLightbox() {
  if (galleryLightbox) galleryLightbox.classList.remove('show');
}

function showNextLightboxImg() {
  if (currentFilteredGallery.length === 0) return;
  currentLightboxIndex = (currentLightboxIndex + 1) % currentFilteredGallery.length;
  openLightbox(currentLightboxIndex);
}

function showPrevLightboxImg() {
  if (currentFilteredGallery.length === 0) return;
  currentLightboxIndex = (currentLightboxIndex - 1 + currentFilteredGallery.length) % currentFilteredGallery.length;
  openLightbox(currentLightboxIndex);
}

document.getElementById('lightboxCloseBtn')?.addEventListener('click', closeLightbox);
document.getElementById('lightboxNextBtn')?.addEventListener('click', showNextLightboxImg);
document.getElementById('lightboxPrevBtn')?.addEventListener('click', showPrevLightboxImg);

galleryLightbox?.addEventListener('click', (e) => {
  if (e.target === galleryLightbox) closeLightbox();
});

window.addEventListener('keydown', (e) => {
  if (!galleryLightbox || !galleryLightbox.classList.contains('show')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowRight') showNextLightboxImg();
  if (e.key === 'ArrowLeft') showPrevLightboxImg();
});

document.querySelectorAll('.gallery-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.gallery-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeGalleryFilter = btn.dataset.filter || 'all';
    renderGalleryGrid();
  });
});

/* --- GALLERY MODAL & ADD MEDIA CONTROLLER --- */
const galleryModalBackdrop = document.getElementById('galleryModalBackdrop');
const addMediaModalBackdrop = document.getElementById('addMediaModalBackdrop');
const navGalleryBtn = document.getElementById('navGalleryBtn');
const footerGalleryBtn = document.getElementById('footerGalleryBtn');
const closeGalleryModalBtn = document.getElementById('closeGalleryModalBtn');
const openAddMediaBtn = document.getElementById('openAddMediaBtn');
const closeAddMediaModalBtn = document.getElementById('closeAddMediaModalBtn');
const cancelAddMediaBtn = document.getElementById('cancelAddMedia');
const saveAddMediaBtn = document.getElementById('saveAddMedia');
const mediaFileInput = document.getElementById('mediaFileInput');
const mediaPhotoPreview = document.getElementById('mediaPhotoPreview');
const mediaPhotoPreviewImg = document.getElementById('mediaPhotoPreviewImg');
const mediaPhotoRemove = document.getElementById('mediaPhotoRemove');

if (mediaFileInput) {
  mediaFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      pendingMediaPhoto = ev.target.result;
      if (mediaPhotoPreviewImg) mediaPhotoPreviewImg.src = pendingMediaPhoto;
      if (mediaPhotoPreview) mediaPhotoPreview.style.display = 'flex';
    };
    reader.readAsDataURL(file);
  });
}

if (mediaPhotoRemove) {
  mediaPhotoRemove.addEventListener('click', () => {
    pendingMediaPhoto = null;
    if (mediaFileInput) mediaFileInput.value = '';
    if (mediaPhotoPreview) mediaPhotoPreview.style.display = 'none';
  });
}

function openGalleryModal() {
  if (galleryModalBackdrop) {
    galleryModalBackdrop.classList.add('show');
    renderGalleryGrid();
    safe('lucide in gallery', () => lucide.createIcons());
  }
}

function closeGalleryModal() {
  if (galleryModalBackdrop) {
    galleryModalBackdrop.classList.remove('show');
  }
}

function openAddMediaModal() {
  if (!addMediaModalBackdrop) return;
  document.getElementById('mediaTitle').value = '';
  document.getElementById('mediaTag').value = '';
  pendingMediaPhoto = null;
  if (mediaFileInput) mediaFileInput.value = '';
  if (mediaPhotoPreview) mediaPhotoPreview.style.display = 'none';
  const msg = document.getElementById('mediaMsg');
  if (msg) { msg.textContent = ''; msg.className = 'form-msg'; }
  addMediaModalBackdrop.classList.add('show');
}

function closeAddMediaModal() {
  if (addMediaModalBackdrop) {
    addMediaModalBackdrop.classList.remove('show');
  }
}

navGalleryBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('navLinksList')?.classList.remove('open');
  openGalleryModal();
});

footerGalleryBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  openGalleryModal();
});

closeGalleryModalBtn?.addEventListener('click', closeGalleryModal);

galleryModalBackdrop?.addEventListener('click', (e) => {
  if (e.target === galleryModalBackdrop) closeGalleryModal();
});

openAddMediaBtn?.addEventListener('click', openAddMediaModal);
closeAddMediaModalBtn?.addEventListener('click', closeAddMediaModal);
cancelAddMediaBtn?.addEventListener('click', closeAddMediaModal);

addMediaModalBackdrop?.addEventListener('click', (e) => {
  if (e.target === addMediaModalBackdrop) closeAddMediaModal();
});

saveAddMediaBtn?.addEventListener('click', async () => {
  const title = document.getElementById('mediaTitle').value.trim();
  const category = document.getElementById('mediaCategory').value;
  const tag = document.getElementById('mediaTag').value.trim() || 'Workshop';
  const msg = document.getElementById('mediaMsg');

  if (!title || !pendingMediaPhoto) {
    if (msg) {
      msg.textContent = 'Please provide a title and select an image file.';
      msg.className = 'form-msg err';
    }
    return;
  }

  if (saveAddMediaBtn) saveAddMediaBtn.disabled = true;
  if (msg) { msg.textContent = 'Uploading media...'; msg.className = 'form-msg'; }

  try {
    await addDoc(galleryRef, {
      title,
      category,
      tag,
      src: pendingMediaPhoto,
      createdAt: serverTimestamp(),
      authorUid: currentUser?.uid || null
    });
    closeAddMediaModal();
  } catch (err) {
    console.error("Error adding gallery media:", err);
    if (msg) {
      msg.textContent = 'Failed to upload media: ' + (err.message || err.code);
      msg.className = 'form-msg err';
    }
  } finally {
    if (saveAddMediaBtn) saveAddMediaBtn.disabled = false;
  }
});

if (window.location.hash === '#gallery') {
  openGalleryModal();
}

renderGalleryGrid();

// ============================================================
// CONTACT MODAL
// ============================================================
const contactModalBackdrop = document.getElementById('contactModalBackdrop');
const navContactBtn = document.getElementById('navContactBtn');
const footerContactBtn = document.getElementById('footerContactBtn');
const closeContactModalBtn = document.getElementById('closeContactModalBtn');

function openContactModal() {
  if (contactModalBackdrop) contactModalBackdrop.classList.add('show');
}
function closeContactModal() {
  if (contactModalBackdrop) contactModalBackdrop.classList.remove('show');
}

navContactBtn?.addEventListener('click', openContactModal);
footerContactBtn?.addEventListener('click', openContactModal);
closeContactModalBtn?.addEventListener('click', closeContactModal);

contactModalBackdrop?.addEventListener('click', (e) => {
  if (e.target === contactModalBackdrop) closeContactModal();
});