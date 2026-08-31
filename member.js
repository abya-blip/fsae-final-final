import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// Utility for safe HTML output
function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

let currentUser = null;
let activeMemberId = null;
let activeMemberData = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  // Re-render if profile already loaded so edit button visibility matches auth state
  if (activeMemberId) {
    loadMemberProfile();
  }
});

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
    let debugHTML = '';
    try {
      const clickDebugRaw = sessionStorage.getItem('lastTeamClickDebug');
      sessionStorage.removeItem('lastTeamClickDebug'); // never shown twice
      const debugInfo = {
        currentURL: window.location.href,
        referrer: document.referrer || '(none)',
        lastRosterClick: clickDebugRaw ? JSON.parse(clickDebugRaw) : '(no click recorded this session)',
      };
      debugHTML = `<pre style="text-align:left; max-width:600px; margin:24px auto 0; padding:16px; background:#111; border:1px solid #333; border-radius:8px; font-size:12px; color:#8f8; overflow:auto;">${escapeHtml(JSON.stringify(debugInfo, null, 2))}</pre>`;
    } catch (e) {}
    contentDiv.innerHTML = `
      <div class="empty-state" style="text-align:center;">
        <i data-lucide="alert-circle" size="48" style="color:var(--accent); margin-bottom:16px;"></i>
        <h2>Profile Not Found</h2>
        <p style="margin-bottom: 24px;">No valid engineer ID detected in the URL. Please return to the Roster and click a profile card.</p>
        <a href="index.html#team" class="btn-primary">Return to Roster</a>
        ${debugHTML}
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

      function getRoleBadgeClass(role) {
        if (!role) return 'ig-badge-member';
        const r = role.toLowerCase();
        if (r === 'founder') return 'ig-badge-founder';
        if (r.includes('lead')) return 'ig-badge-lead';
        if (r.includes('driver')) return 'ig-badge-driver';
        return 'ig-badge-member';
      }

      const roleClass = getRoleBadgeClass(m.role);
      
      // Convert "Saumang Swarup Sharma" -> "saumang_swarup_sharma"
      const handle = m.name ? m.name.replace(/\s+/g, '_').toLowerCase() : 'engineer';

      const editBtnHtml = currentUser 
        ? `<button id="profileEditBtn" class="profile-edit-btn"><i data-lucide="edit-3" size="14"></i> Edit Profile & Tags</button>` 
        : '';

      contentDiv.innerHTML = `
        <div class="ig-profile-header">
          <div class="ig-story-ring">
            <div class="ig-avatar">${avatarHTML}</div>
          </div>
          <div class="ig-info">
            <div class="ig-top-row">
              <h1 class="ig-username">${escapeHtml(handle)}</h1>
              <span class="${roleClass}">${escapeHtml(m.role || 'Member')}</span>
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

        <div class="ig-divider"><div class="ig-tab"><i data-lucide="grid" size="14"></i> ENGINEER LOGS</div></div>
        
        <div class="empty-state" style="padding-top: 40px;">
          <i data-lucide="lock" size="32" style="margin-bottom: 16px; opacity: 0.5;"></i>
          <p>No technical logs published by this engineer yet.</p>
        </div>
      `;
      lucide.createIcons();

      document.getElementById('profileEditBtn')?.addEventListener('click', openEditProfileModal);
    } else {
      contentDiv.innerHTML = `
        <div class="empty-state" style="text-align:center;">
          <h2>Engineer Not Found</h2>
          <p style="margin-bottom: 24px;">This engineer is not registered in the current roster database.</p>
          <a href="index.html#team" class="btn-primary">Return to Roster</a>
        </div>`;
    }
  } catch (error) {
    console.error("Error loading profile:", error);
    contentDiv.innerHTML = '<div class="empty-state">Secure connection failed. Unable to fetch telemetry data.</div>';
  }
}

const editProfileBackdrop = document.getElementById('editProfileBackdrop');

function openEditProfileModal() {
  if (!activeMemberData || !editProfileBackdrop) return;
  document.getElementById('profName').value = activeMemberData.name || '';
  document.getElementById('profRoll').value = activeMemberData.rollNo || '';
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

document.getElementById('saveProfEdit')?.addEventListener('click', async () => {
  if (!activeMemberId) return;
  const name = document.getElementById('profName').value.trim();
  const rollNo = document.getElementById('profRoll').value.trim();
  const role = document.getElementById('profRole').value;
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

// Same reasoning as script.js: if the DOM is already parsed by the time this
// module runs, listening for DOMContentLoaded would wait forever for an event
// that already happened, leaving the page stuck on "Loading clearance data".
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadMemberProfile);
} else {
  loadMemberProfile();
}