import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, getDoc, updateDoc, collection, query, where, orderBy, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// Utility for safe HTML output
function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

let currentUser = null;
let activeMemberId = null;
let activeMemberData = null;
let pendingLogPhoto = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  // Re-render if profile already loaded so edit button and add-log button visibility matches auth state
  if (activeMemberId) {
    loadMemberProfile();
  }
});

async function fetchEngineerLogs(memberId) {
  try {
    const logsRef = collection(db, "engineer_logs");
    const q = query(logsRef, where("memberId", "==", memberId), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn("Could not fetch engineer logs with compound query, falling back to simple query:", e);
    try {
      const logsRef = collection(db, "engineer_logs");
      const q = query(logsRef, where("memberId", "==", memberId));
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA;
      });
      return docs;
    } catch (err) {
      console.error("Error fetching logs:", err);
      return [];
    }
  }
}

async function loadMemberProfile() {
  const urlParams = new URLSearchParams(window.location.search);
  let memberId = urlParams.get('id');
  let recoveredFromSession = false;

  if (!memberId || memberId === 'undefined' || memberId === 'null') {
    try {
      const pending = sessionStorage.getItem('pendingProfileId');
      if (pending) { memberId = pending; recoveredFromSession = true; }
    } catch (e) {}
  }
  try { sessionStorage.removeItem('pendingProfileId'); } catch (e) {}
  if (recoveredFromSession) console.info('[member] id recovered from sessionStorage fallback, not the URL:', memberId);

  const contentDiv = document.getElementById('profileContent');

  if (!memberId || memberId === 'undefined' || memberId === 'null') {
    contentDiv.innerHTML = `
      <div class="empty-state" style="text-align:center;">
        <i data-lucide="alert-circle" size="48" style="color:var(--accent); margin-bottom:16px;"></i>
        <h2>Profile Not Found</h2>
        <p style="margin-bottom: 24px;">No valid engineer ID detected in the URL. Please return to the Roster and click a profile card.</p>
        <a href="index.html#team" class="btn-primary">Return to Roster</a>
      </div>`;
    lucide.createIcons();
    return;
  }

  activeMemberId = memberId;

  try {
    const docRef = doc(db, "team", memberId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const m = docSnap.data();
      activeMemberData = m;
      const verticals = Array.isArray(m.verticals) ? m.verticals : (m.vertical ? [m.vertical] : []);
      
      const avatarHTML = m.photo 
        ? `<img src="${m.photo}" alt="${escapeHtml(m.name)}">` 
        : escapeHtml((m.name || '?')[0].toUpperCase());

      function getMemberBadgeClass(role) {
        if (!role) return 'ig-badge-member';
        const r = role.toLowerCase();
        if (r.includes('founder')) return 'ig-badge-founder';
        if (r.includes('lead') || r.includes('captain')) return 'ig-badge-lead';
        if (r.includes('driver')) return 'ig-badge-driver';
        return 'ig-badge-member';
      }

      function renderProfileBadges(m) {
        const isFounder = m.isFounder === true || (m.role && m.role.toLowerCase() === 'founder');
        const role = m.role || '';
        const rLower = role.toLowerCase();
        const badges = [];

        if (isFounder) {
          badges.push(`<span class="ig-badge-founder">Founder</span>`);
        }

        if (role && rLower !== 'founder' && rLower !== 'member') {
          const cleanRole = isFounder ? role.replace(/Founder\s*(&|\/|\+)?\s*/i, '').trim() : role;
          if (cleanRole && cleanRole.toLowerCase() !== 'founder' && cleanRole.toLowerCase() !== 'member') {
            badges.push(`<span class="${getMemberBadgeClass(cleanRole)}">${escapeHtml(cleanRole)}</span>`);
          }
        } else if (!isFounder) {
          badges.push(`<span class="${getMemberBadgeClass(role)}">${escapeHtml(role || 'Member')}</span>`);
        }

        return badges.join(' ');
      }

      const badgesHtml = renderProfileBadges(m);
      
      // Convert "Saumang Swarup Sharma" -> "saumang_swarup_sharma"
      const handle = m.name ? m.name.replace(/\s+/g, '_').toLowerCase() : 'engineer';

      const editBtnHtml = currentUser 
        ? `<button id="profileEditBtn" class="profile-edit-btn"><i data-lucide="edit-3" size="14"></i> Edit Profile & Tags</button>` 
        : '';

      // Check if engineer is a Founder or holds a Lead/Captain title
      const isFounderOrLead = (m.isFounder === true) || 
        (m.role && (
          m.role.toLowerCase().includes('founder') || 
          m.role.toLowerCase().includes('lead') || 
          m.role.toLowerCase().includes('captain')
        ));

      let logsSectionHtml = '';
      if (isFounderOrLead) {
        const addLogBtnHtml = currentUser 
          ? `<button id="openAddLogBtn" class="btn-secondary btn-small magnetic-el"><i data-lucide="plus" size="14"></i> Add Technical Log</button>` 
          : '';

        logsSectionHtml = `
          <div class="ig-divider"><div class="ig-tab"><i data-lucide="cpu" size="14"></i> TECHNICAL BUILD LOGS</div></div>
          
          <div class="logs-section-header">
            <div>
              <h3 style="font-size:18px; margin:0 0 4px;">Engineer Portfolio Logs</h3>
              <p style="color:var(--text-secondary); font-size:13px; margin:0;">Subsystem architecture, CAD simulations, and fabrication milestones by ${escapeHtml(m.name)}.</p>
            </div>
            ${addLogBtnHtml}
          </div>

          <div class="logs-list" id="engineerLogsList">
            <div class="empty-state" style="padding: 30px;"><i data-lucide="loader-2" class="spin"></i> Loading engineer logs...</div>
          </div>
        `;
      }

      contentDiv.innerHTML = `
        <div class="ig-profile-header">
          <div class="ig-story-ring">
            <div class="ig-avatar">${avatarHTML}</div>
          </div>
          <div class="ig-info">
            <div class="ig-top-row">
              <h1 class="ig-username">${escapeHtml(handle)}</h1>
              <div style="display:inline-flex; gap:8px; align-items:center; flex-wrap:wrap;">${badgesHtml}</div>
              ${editBtnHtml}
            </div>
            <div class="ig-stats-row">
              <div class="stat"><span>Roll No</span> <strong>${escapeHtml(m.rollNo || 'N/A')}</strong></div>
              <div class="stat"><span>Divisions</span> <strong>${verticals.length > 0 ? escapeHtml(verticals.join(', ')) : 'Engineering'}</strong></div>
            </div>
            <div class="ig-bio-section">
              <div class="ig-real-name">${escapeHtml(m.name)}</div>
              <div class="ig-bio-text">${escapeHtml(m.bio || 'Currently focused on the build. Biography data pending.')}</div>
            </div>
          </div>
        </div>

        ${logsSectionHtml}
      `;
      lucide.createIcons();

      document.getElementById('profileEditBtn')?.addEventListener('click', openEditProfileModal);
      document.getElementById('openAddLogBtn')?.addEventListener('click', openAddLogModal);

      // If Founder or Lead, populate real logs from Firestore
      if (isFounderOrLead) {
        const logs = await fetchEngineerLogs(memberId);
        const logsContainer = document.getElementById('engineerLogsList');
        if (logsContainer) {
          if (logs.length === 0) {
            logsContainer.innerHTML = `
              <div class="empty-state" style="padding: 40px 20px;">
                <i data-lucide="file-text" size="32" style="margin-bottom: 12px; opacity: 0.5;"></i>
                <p style="margin-bottom: 8px;">No technical logs published by this lead yet.</p>
                ${currentUser ? '<p style="font-size:13px; color:var(--text-secondary);">Click "Add Technical Log" above to record your first milestone.</p>' : ''}
              </div>
            `;
          } else {
            logsContainer.innerHTML = logs.map(l => {
              let dateStr = 'Recent Milestone';
              if (l.createdAt?.toDate) {
                dateStr = l.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              } else if (l.createdAt) {
                dateStr = new Date(l.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              }
              const photoHtml = l.photo 
                ? `<div class="log-img-wrap"><img src="${l.photo}" alt="${escapeHtml(l.title)}" loading="lazy"></div>` 
                : '';
              return `
                <div class="engineer-log-card">
                  <div class="log-top">
                    <div class="log-title">${escapeHtml(l.title)}</div>
                    <span class="log-badge">${escapeHtml(l.tag || 'Engineering')}</span>
                  </div>
                  <div class="log-date"><i data-lucide="calendar" size="12" style="display:inline-block; vertical-align:-1px; margin-right:4px;"></i> ${escapeHtml(dateStr)}</div>
                  <div class="log-body">${escapeHtml(l.body)}</div>
                  ${photoHtml}
                </div>
              `;
            }).join('');
          }
          lucide.createIcons();
        }
      }

    } else {
      contentDiv.innerHTML = `
        <div class="empty-state" style="text-align:center;">
          <h2>Engineer Not Found</h2>
          <p style="margin-bottom: 24px;">This engineer is not registered in the current roster database.</p>
          <a href="index.html#team" class="btn-primary">Return to Roster</a>
        </div>`;
      lucide.createIcons();
    }
  } catch (error) {
    console.error("Error loading profile:", error);
    contentDiv.innerHTML = '<div class="empty-state">Secure connection failed. Unable to fetch telemetry data.</div>';
  }
}

/* --- EDIT PROFILE MODAL --- */
const editProfileBackdrop = document.getElementById('editProfileBackdrop');

function openEditProfileModal() {
  if (!activeMemberData || !editProfileBackdrop) return;
  document.getElementById('profName').value = activeMemberData.name || '';
  document.getElementById('profRoll').value = activeMemberData.rollNo || '';
  
  const isFounder = activeMemberData.isFounder === true || (activeMemberData.role && activeMemberData.role.toLowerCase().includes('founder'));
  const profFounderCb = document.getElementById('profIsFounder');
  if (profFounderCb) profFounderCb.checked = isFounder;

  document.getElementById('profRole').value = activeMemberData.role || 'Member';
  document.getElementById('profBio').value = activeMemberData.bio || '';
  const msg = document.getElementById('profMsg');
  if (msg) { msg.textContent = ''; msg.className = 'form-msg'; }

  const currentVerticals = Array.isArray(activeMemberData.verticals) ? activeMemberData.verticals : (activeMemberData.vertical ? [activeMemberData.vertical] : []);
  const checkBoxes = document.querySelectorAll('#profVerticals input[type="checkbox"]');
  checkBoxes.forEach(cb => {
    cb.checked = currentVerticals.includes(cb.value);
  });

  editProfileBackdrop.classList.add('show');
}

function closeEditProfileModal() {
  if (editProfileBackdrop) editProfileBackdrop.classList.remove('show');
}

document.getElementById('closeEditProfileBtn')?.addEventListener('click', closeEditProfileModal);
document.getElementById('cancelProfEdit')?.addEventListener('click', closeEditProfileModal);
editProfileBackdrop?.addEventListener('click', (e) => {
  if (e.target === editProfileBackdrop) closeEditProfileModal();
});

document.getElementById('saveProfEdit')?.addEventListener('click', async () => {
  if (!activeMemberId) return;
  const name = document.getElementById('profName').value.trim();
  const rollNo = document.getElementById('profRoll').value.trim();
  const isFounder = document.getElementById('profIsFounder')?.checked || false;
  let role = document.getElementById('profRole').value;
  if (isFounder && role === 'Member') { role = 'Founder'; }
  const bio = document.getElementById('profBio').value.trim();
  const checkBoxes = document.querySelectorAll('#profVerticals input[type="checkbox"]');
  const verticals = Array.from(checkBoxes).filter(cb => cb.checked).map(cb => cb.value);
  const msg = document.getElementById('profMsg');
  const saveBtn = document.getElementById('saveProfEdit');

  if (!name || !rollNo || verticals.length === 0) {
    if (msg) {
      msg.textContent = 'Please fill out name, roll number, and select at least one vertical tag.';
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
    await updateDoc(doc(db, "team", activeMemberId), {
      name,
      rollNo,
      isFounder,
      role,
      verticals,
      bio,
      updatedAt: serverTimestamp(),
      lastUpdatedByUid: currentUser?.uid || null
    });
    closeEditProfileModal();
    await loadMemberProfile();
  } catch (err) {
    console.error('Error saving profile changes:', err);
    if (msg) {
      msg.textContent = 'Failed to save changes: ' + (err.message || err.code);
      msg.className = 'form-msg err';
    }
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
});

/* --- ADD TECHNICAL LOG MODAL --- */
const addLogBackdrop = document.getElementById('addLogBackdrop');
const logPhotoInput = document.getElementById('logPhoto');
const logPhotoPreview = document.getElementById('logPhotoPreview');
const logPhotoPreviewImg = document.getElementById('logPhotoPreviewImg');
const logPhotoRemove = document.getElementById('logPhotoRemove');

if (logPhotoInput) {
  logPhotoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      pendingLogPhoto = ev.target.result;
      if (logPhotoPreviewImg) logPhotoPreviewImg.src = pendingLogPhoto;
      if (logPhotoPreview) logPhotoPreview.style.display = 'flex';
    };
    reader.readAsDataURL(file);
  });
}

if (logPhotoRemove) {
  logPhotoRemove.addEventListener('click', () => {
    pendingLogPhoto = null;
    if (logPhotoInput) logPhotoInput.value = '';
    if (logPhotoPreview) logPhotoPreview.style.display = 'none';
  });
}

function openAddLogModal() {
  if (!addLogBackdrop) return;
  document.getElementById('logTitle').value = '';
  document.getElementById('logBody').value = '';
  pendingLogPhoto = null;
  if (logPhotoInput) logPhotoInput.value = '';
  if (logPhotoPreview) logPhotoPreview.style.display = 'none';
  const msg = document.getElementById('logMsg');
  if (msg) { msg.textContent = ''; msg.className = 'form-msg'; }
  addLogBackdrop.classList.add('show');
}

function closeAddLogModal() {
  if (addLogBackdrop) addLogBackdrop.classList.remove('show');
}

document.getElementById('closeAddLogBtn')?.addEventListener('click', closeAddLogModal);
document.getElementById('cancelAddLog')?.addEventListener('click', closeAddLogModal);
addLogBackdrop?.addEventListener('click', (e) => {
  if (e.target === addLogBackdrop) closeAddLogModal();
});

document.getElementById('saveAddLog')?.addEventListener('click', async () => {
  if (!activeMemberId) return;
  const title = document.getElementById('logTitle').value.trim();
  const tag = document.getElementById('logTag').value;
  const body = document.getElementById('logBody').value.trim();
  const msg = document.getElementById('logMsg');
  const saveBtn = document.getElementById('saveAddLog');

  if (!title || !body) {
    if (msg) {
      msg.textContent = 'Please provide both a log title and engineering notes.';
      msg.className = 'form-msg err';
    }
    return;
  }

  if (saveBtn) saveBtn.disabled = true;
  if (msg) {
    msg.textContent = 'Publishing technical log...';
    msg.className = 'form-msg';
  }

  try {
    await addDoc(collection(db, "engineer_logs"), {
      memberId: activeMemberId,
      authorName: activeMemberData?.name || 'Engineer',
      title,
      tag,
      body,
      photo: pendingLogPhoto || null,
      createdAt: serverTimestamp(),
      authorUid: currentUser?.uid || null
    });
    closeAddLogModal();
    await loadMemberProfile();
  } catch (err) {
    console.error('Error publishing technical log:', err);
    if (msg) {
      msg.textContent = 'Failed to publish log: ' + (err.message || err.code);
      msg.className = 'form-msg err';
    }
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
});

// Same reasoning as script.js: if the DOM is already parsed by the time this
// module runs, listening for DOMContentLoaded would wait forever for an event
// that already happened, leaving the page stuck on "Loading clearance data".
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadMemberProfile);
} else {
  loadMemberProfile();
}