import{o as Y,a as Z,d as W,e as A,l as ee,c as T,q as N,w as S,h as te,m as F,u as oe,j as G,i as ne}from"./firebase-init-C_Qte9MD.js";/* empty css              */function d(e){const t=document.createElement("div");return t.textContent=e||"",t.innerHTML}function M(e,t){e&&(t?(e.dataset.originalHtml=e.innerHTML,e.dataset.originalWidth=e.style.width||"",e.style.width=e.offsetWidth+"px",e.innerHTML='<i data-lucide="loader-2" class="spin"></i>',window.lucide&&window.lucide.createIcons({root:e}),e.disabled=!0,e.style.opacity="0.7"):(e.innerHTML=e.dataset.originalHtml||e.innerHTML,e.style.width=e.dataset.originalWidth,e.disabled=!1,e.style.opacity="1"))}let p=null,I=null,l=null,P=null;Y(Z,e=>{p=e,I&&C()});async function ie(e){try{const t=T(A,"engineer_logs"),i=N(t,S("memberId","==",e),te("createdAt","desc"));return(await F(i)).docs.map(c=>({id:c.id,...c.data()}))}catch(t){console.warn("Could not fetch engineer logs with compound query, falling back to simple query:",t);try{const i=T(A,"engineer_logs"),n=N(i,S("memberId","==",e)),g=(await F(n)).docs.map(s=>({id:s.id,...s.data()}));return g.sort((s,a)=>{var m,x;const o=(m=s.createdAt)!=null&&m.toMillis?s.createdAt.toMillis():s.createdAt?new Date(s.createdAt).getTime():0;return((x=a.createdAt)!=null&&x.toMillis?a.createdAt.toMillis():a.createdAt?new Date(a.createdAt).getTime():0)-o}),g}catch(i){return console.error("Error fetching logs:",i),[]}}}async function C(){var c,g;let t=new URLSearchParams(window.location.search).get("id"),i=!1;if(!t||t==="undefined"||t==="null")try{const s=sessionStorage.getItem("pendingProfileId");s&&(t=s,i=!0)}catch{}try{sessionStorage.removeItem("pendingProfileId")}catch{}i&&console.info("[member] id recovered from sessionStorage fallback, not the URL:",t);const n=document.getElementById("profileContent");if(!t||t==="undefined"||t==="null"){n.innerHTML=`
      <div class="empty-state" style="text-align:center;">
        <i data-lucide="alert-circle" size="48" style="color:var(--accent); margin-bottom:16px;"></i>
        <h2>Profile Not Found</h2>
        <p style="margin-bottom: 24px;">No valid engineer ID detected in the URL. Please return to the Roster and click a profile card.</p>
        <a href="index.html#team" class="btn-primary">Return to Roster</a>
      </div>`,lucide.createIcons();return}I=t;try{const s=W(A,"team",t),a=await ee(s);if(a.exists()){let x=function(u){if(!u)return"ig-badge-member";const f=u.toLowerCase();return f.includes("founder")?"ig-badge-founder":f.includes("lead")||f.includes("captain")?"ig-badge-lead":f.includes("driver")?"ig-badge-driver":"ig-badge-member"},J=function(u){const f=u.isFounder===!0||u.role&&u.role.toLowerCase()==="founder",r=u.role||"",L=r.toLowerCase(),B=[];if(f&&B.push('<span class="ig-badge-founder">Founder</span>'),r&&L!=="founder"&&L!=="member"){const v=f?r.replace(/Founder\s*(&|\/|\+)?\s*/i,"").trim():r;v&&v.toLowerCase()!=="founder"&&v.toLowerCase()!=="member"&&B.push(`<span class="${x(v)}">${d(v)}</span>`)}else f||B.push(`<span class="${x(r)}">${d(r||"Member")}</span>`);return B.join(" ")};const o=a.data();l=o;const E=Array.isArray(o.verticals)?o.verticals:o.vertical?[o.vertical]:[],m=o.photo?`<img src="${o.photo}" alt="${d(o.name)}">`:d((o.name||"?")[0].toUpperCase()),K=J(o),Q=o.name?o.name.replace(/\s+/g,"_").toLowerCase():"engineer",X=p?'<button id="profileEditBtn" class="profile-edit-btn"><i data-lucide="edit-3" size="14"></i> Edit Profile & Tags</button>':"",R=o.isFounder===!0||o.role&&(o.role.toLowerCase().includes("founder")||o.role.toLowerCase().includes("lead")||o.role.toLowerCase().includes("captain"));let H="";if(R){const u=p?'<button id="openAddLogBtn" class="btn-secondary btn-small magnetic-el"><i data-lucide="plus" size="14"></i> Add Technical Log</button>':"";H=`
          <div class="ig-divider"><div class="ig-tab"><i data-lucide="cpu" size="14"></i> TECHNICAL BUILD LOGS</div></div>
          
          <div class="logs-section-header">
            <div>
              <h3 style="font-size:18px; margin:0 0 4px;">Engineer Portfolio Logs</h3>
              <p style="color:var(--text-secondary); font-size:13px; margin:0;">Subsystem architecture, CAD simulations, and fabrication milestones by ${d(o.name)}.</p>
            </div>
            ${u}
          </div>

          <div class="logs-list" id="engineerLogsList">
            <div class="empty-state" style="padding: 30px;"><i data-lucide="loader-2" class="spin"></i> Loading engineer logs...</div>
          </div>
        `}if(n.innerHTML=`
        <div class="ig-profile-header">
          <div class="ig-story-ring">
            <div class="ig-avatar">${m}</div>
          </div>
          <div class="ig-info">
            <div class="ig-top-row">
              <h1 class="ig-username">${d(Q)}</h1>
              <div style="display:inline-flex; gap:8px; align-items:center; flex-wrap:wrap;">${K}</div>
              ${X}
            </div>
            <div class="ig-stats-row">
              <div class="stat"><span>Roll No</span> <strong>${d(o.rollNo||"N/A")}</strong></div>
              <div class="stat"><span>Divisions</span> <strong>${E.length>0?d(E.join(", ")):"Engineering"}</strong></div>
            </div>
            <div class="ig-bio-section">
              <div class="ig-real-name">${d(o.name)}</div>
              <div class="ig-bio-text">${d(o.bio||"Currently focused on the build. Biography data pending.")}</div>
            </div>
          </div>
        </div>

        ${H}
      `,lucide.createIcons(),(c=document.getElementById("profileEditBtn"))==null||c.addEventListener("click",se),(g=document.getElementById("openAddLogBtn"))==null||g.addEventListener("click",ae),R){const u=await ie(t),f=document.getElementById("engineerLogsList");f&&(u.length===0?f.innerHTML=`
              <div class="empty-state" style="padding: 40px 20px;">
                <i data-lucide="file-text" size="32" style="margin-bottom: 12px; opacity: 0.5;"></i>
                <p style="margin-bottom: 8px;">No technical logs published by this lead yet.</p>
                ${p?'<p style="font-size:13px; color:var(--text-secondary);">Click "Add Technical Log" above to record your first milestone.</p>':""}
              </div>
            `:f.innerHTML=u.map(r=>{var v;let L="Recent Milestone";(v=r.createdAt)!=null&&v.toDate?L=r.createdAt.toDate().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):r.createdAt&&(L=new Date(r.createdAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}));const B=r.photo?`<div class="log-img-wrap"><img src="${r.photo}" alt="${d(r.title)}" loading="lazy"></div>`:"";return`
                <div class="engineer-log-card">
                  <div class="log-top">
                    <div class="log-title">${d(r.title)}</div>
                    <span class="log-badge">${d(r.tag||"Engineering")}</span>
                  </div>
                  <div class="log-date"><i data-lucide="calendar" size="12" style="display:inline-block; vertical-align:-1px; margin-right:4px;"></i> ${d(L)}</div>
                  <div class="log-body">${d(r.body)}</div>
                  ${B}
                </div>
              `}).join(""),lucide.createIcons())}}else n.innerHTML=`
        <div class="empty-state" style="text-align:center;">
          <h2>Engineer Not Found</h2>
          <p style="margin-bottom: 24px;">This engineer is not registered in the current roster database.</p>
          <a href="index.html#team" class="btn-primary">Return to Roster</a>
        </div>`,lucide.createIcons()}catch(s){console.error("Error loading profile:",s),n.innerHTML='<div class="empty-state">Secure connection failed. Unable to fetch telemetry data.</div>'}}const y=document.getElementById("editProfileBackdrop");function se(){if(!l||!y)return;document.getElementById("profName").value=l.name||"",document.getElementById("profRoll").value=l.rollNo||"";const e=l.isFounder===!0||l.role&&l.role.toLowerCase().includes("founder"),t=document.getElementById("profIsFounder");t&&(t.checked=e),document.getElementById("profRole").value=l.role||"Member",document.getElementById("profBio").value=l.bio||"";const i=document.getElementById("profMsg");i&&(i.textContent="",i.className="form-msg");const n=Array.isArray(l.verticals)?l.verticals:l.vertical?[l.vertical]:[];document.querySelectorAll('#profVerticals input[type="checkbox"]').forEach(g=>{g.checked=n.includes(g.value)}),y.classList.add("show")}function k(){y&&y.classList.remove("show")}var U;(U=document.getElementById("closeEditProfileBtn"))==null||U.addEventListener("click",k);var q;(q=document.getElementById("cancelProfEdit"))==null||q.addEventListener("click",k);y==null||y.addEventListener("click",e=>{e.target===y&&k()});var j;(j=document.getElementById("saveProfEdit"))==null||j.addEventListener("click",async()=>{var E;if(!I)return;const e=document.getElementById("profName").value.trim(),t=document.getElementById("profRoll").value.trim(),i=((E=document.getElementById("profIsFounder"))==null?void 0:E.checked)||!1;let n=document.getElementById("profRole").value;i&&n==="Member"&&(n="Founder");const c=document.getElementById("profBio").value.trim(),g=document.querySelectorAll('#profVerticals input[type="checkbox"]'),s=Array.from(g).filter(m=>m.checked).map(m=>m.value),a=document.getElementById("profMsg"),o=document.getElementById("saveProfEdit");if(!e||!t||s.length===0){a&&(a.textContent="Please fill out name, roll number, and select at least one vertical tag.",a.className="form-msg err");return}o&&M(o,!0),a&&(a.textContent="Saving changes...",a.className="form-msg");try{await oe(W(A,"team",I),{name:e,rollNo:t,isFounder:i,role:n,verticals:s,bio:c,updatedAt:G(),lastUpdatedByUid:(p==null?void 0:p.uid)||null}),k(),await C()}catch(m){console.error("Error saving profile changes:",m),a&&(a.textContent="Failed to save changes: "+(m.message||m.code),a.className="form-msg err")}finally{o&&M(o,!1)}});const h=document.getElementById("addLogBackdrop"),w=document.getElementById("logPhoto"),b=document.getElementById("logPhotoPreview"),D=document.getElementById("logPhotoPreviewImg"),z=document.getElementById("logPhotoRemove");w&&w.addEventListener("change",e=>{const t=e.target.files[0];if(!t)return;const i=new FileReader;i.onload=n=>{P=n.target.result,D&&(D.src=P),b&&(b.style.display="flex")},i.readAsDataURL(t)});z&&z.addEventListener("click",()=>{P=null,w&&(w.value=""),b&&(b.style.display="none")});function ae(){if(!h)return;document.getElementById("logTitle").value="",document.getElementById("logBody").value="",P=null,w&&(w.value=""),b&&(b.style.display="none");const e=document.getElementById("logMsg");e&&(e.textContent="",e.className="form-msg"),h.classList.add("show")}function $(){h&&h.classList.remove("show")}var _;(_=document.getElementById("closeAddLogBtn"))==null||_.addEventListener("click",$);var O;(O=document.getElementById("cancelAddLog"))==null||O.addEventListener("click",$);h==null||h.addEventListener("click",e=>{e.target===h&&$()});var V;(V=document.getElementById("saveAddLog"))==null||V.addEventListener("click",async()=>{if(!I)return;const e=document.getElementById("logTitle").value.trim(),t=document.getElementById("logTag").value,i=document.getElementById("logBody").value.trim(),n=document.getElementById("logMsg"),c=document.getElementById("saveAddLog");if(!e||!i){n&&(n.textContent="Please provide both a log title and engineering notes.",n.className="form-msg err");return}c&&M(c,!0),n&&(n.textContent="Publishing technical log...",n.className="form-msg");try{await ne(T(A,"engineer_logs"),{memberId:I,authorName:(l==null?void 0:l.name)||"Engineer",title:e,tag:t,body:i,photo:P||null,createdAt:G(),authorUid:(p==null?void 0:p.uid)||null}),$(),await C()}catch(g){console.error("Error publishing technical log:",g),n&&(n.textContent="Failed to publish log: "+(g.message||g.code),n.className="form-msg err")}finally{c&&M(c,!1)}});document.readyState==="loading"?document.addEventListener("DOMContentLoaded",C):C();
