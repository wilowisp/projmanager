import{g as b}from"./uuid-Bs_n_vTv.js";function g(){const t=localStorage.getItem("pm_launcher_projects");if(!t)return[];try{return JSON.parse(t)}catch{return[]}}function u(t){localStorage.setItem("pm_launcher_projects",JSON.stringify(t))}function f(t){const n=new Set(t.map(r=>r.id));for(let r=0;r<localStorage.length;r++){const e=localStorage.key(r);if(!e.startsWith("pm_project_"))continue;const o=e.replace("pm_project_","");if(!n.has(o))try{const a=JSON.parse(localStorage.getItem(e));t.push({id:o,name:a.name??o,description:a.description??"",updatedAt:a.updatedAt??new Date().toISOString(),path:d(o)}),n.add(o)}catch{}}return t}function d(t){return`/projmanager/projects/demo/?p=${t}`}function j(){const n=f(g()).map(e=>{const o=localStorage.getItem(`pm_project_${e.id}`);if(!o)return null;try{return JSON.parse(o)}catch{return null}}).filter(Boolean);if(n.length===0){alert("내보낼 프로젝트가 없습니다.");return}const r={_type:"pm-all-projects",version:1,exportedAt:new Date().toISOString(),projects:n};h(r,`all-projects-${S()}.json`)}function y(t){const n=JSON.parse(t);let r=0;return n._type==="pm-all-projects"&&Array.isArray(n.projects)?n.projects.forEach(e=>{e!=null&&e.id&&(localStorage.setItem(`pm_project_${e.id}`,JSON.stringify(e)),r++)}):n.id&&(localStorage.setItem(`pm_project_${n.id}`,JSON.stringify(n)),r=1),r>0&&localStorage.removeItem("pm_launcher_projects"),r}function h(t,n){const r=new Blob([JSON.stringify(t,null,2)],{type:"application/json"}),e=document.createElement("a");e.href=URL.createObjectURL(r),e.download=n,e.click(),URL.revokeObjectURL(e.href)}function S(){return new Date().toISOString().split("T")[0]}function m(){var r,e,o;let t=f(g());u(t);const n=document.getElementById("root");n.innerHTML=`
    <div class="launcher">
      <header class="launcher-header">
        <div class="launcher-logo">[PM]</div>
        <h1>Project Manager</h1>
        <p class="launcher-sub">간트 차트 · 업무 의존관계 · 크리티컬 패스 · 서버 불필요</p>
        <p class="launcher-hint">
          데이터는 <strong>이 브라우저에만</strong> 저장됩니다.<br>
          다른 기기로 옮기려면 <strong>내보내기(JSON)</strong>를 사용하세요.
        </p>
      </header>

      <div class="launcher-toolbar">
        <button class="btn btn-primary" id="btn-new">+ 새 프로젝트</button>
        <div class="launcher-toolbar-gap"></div>
        <button class="btn btn-ghost" id="btn-import-all" title="JSON 파일에서 프로젝트 가져오기">Import</button>
        <button class="btn btn-ghost" id="btn-export-all" title="모든 프로젝트를 JSON 파일로 내보내기">Export All</button>
      </div>

      <div class="project-grid" id="project-grid">
        ${t.length===0?'<p class="empty-msg">프로젝트가 없습니다. <strong>새 프로젝트</strong>를 만들어보세요!</p>':t.map(a=>w(a)).join("")}
      </div>
    </div>
  `,(r=document.getElementById("btn-new"))==null||r.addEventListener("click",()=>E()),(e=document.getElementById("btn-export-all"))==null||e.addEventListener("click",j),(o=document.getElementById("btn-import-all"))==null||o.addEventListener("click",()=>{const a=document.createElement("input");a.type="file",a.accept=".json",a.addEventListener("change",()=>{var l;const c=(l=a.files)==null?void 0:l[0];if(!c)return;const s=new FileReader;s.onload=()=>{try{const i=y(s.result);i>0?(m(),alert(`${i}개 프로젝트를 가져왔습니다.`)):alert("가져올 수 있는 프로젝트 데이터가 없습니다.")}catch{alert("올바른 JSON 파일이 아닙니다.")}},s.readAsText(c)}),a.click()}),document.querySelectorAll(".project-card").forEach(a=>{a.addEventListener("click",c=>{c.target.closest(".card-delete")||(window.location.href=a.dataset.path)})}),document.querySelectorAll(".card-delete").forEach(a=>{a.addEventListener("click",c=>{c.stopPropagation();const s=a.dataset.id;confirm("이 프로젝트를 브라우저에서 삭제할까요?")&&(localStorage.removeItem(`pm_project_${s}`),t=t.filter(l=>l.id!==s),u(t),m())})})}function w(t){const n=new Date(t.updatedAt).toLocaleDateString("ko-KR");return`
    <div class="project-card" data-path="${p(d(t.id))}" data-id="${t.id}">
      <div class="card-icon">[P]</div>
      <div class="card-info">
        <h2 class="card-name">${p(t.name)}</h2>
        <p class="card-desc">${p(t.description||"설명 없음")}</p>
        <span class="card-meta">수정: ${n}</span>
      </div>
      <div class="card-actions">
        <button class="card-export btn btn-ghost" data-id="${t.id}" title="이 프로젝트 내보내기">Share</button>
        <button class="card-delete btn btn-ghost" data-id="${t.id}" title="삭제">Del</button>
      </div>
    </div>
  `}function E(){const t=document.createElement("div");t.className="new-project-overlay",t.innerHTML=`
    <div class="new-project-dialog">
      <h2>새 프로젝트</h2>
      <div class="form-group">
        <label>프로젝트 이름</label>
        <input id="np-name" class="form-input" type="text" placeholder="예: 2026 연간 계획" autofocus />
      </div>
      <div class="form-group">
        <label>설명 (선택)</label>
        <input id="np-desc" class="form-input" type="text" placeholder="간단한 설명" />
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" id="np-ok">만들기</button>
        <button class="btn btn-ghost" id="np-cancel">취소</button>
      </div>
    </div>
  `,document.body.append(t);const n=t.querySelector("#np-name");n.focus();const r=()=>{const e=n.value.trim();if(!e){n.focus();return}const o=e.toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9가-힣-]/g,"")||b(),a=t.querySelector("#np-desc").value.trim(),c=new Date().toISOString().split("T")[0],s=new Date(Date.now()+365*864e5).toISOString().split("T")[0],l={id:o,name:e,description:a,startDate:c,endDate:s,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),tasks:[],milestones:[],settings:{workingDays:[!1,!0,!0,!0,!0,!0,!1],holidays:[],defaultZoom:"month"}};localStorage.setItem(`pm_project_${o}`,JSON.stringify(l));const i=f(g());i.some(v=>v.id===o)||i.push({id:o,name:e,description:a,updatedAt:l.updatedAt,path:d(o)}),u(i),t.remove(),window.location.href=d(o)};t.querySelector("#np-ok").addEventListener("click",r),t.querySelector("#np-cancel").addEventListener("click",()=>t.remove()),n.addEventListener("keydown",e=>{e.key==="Enter"&&r(),e.key==="Escape"&&t.remove()}),t.addEventListener("click",e=>{e.target===t&&t.remove()})}function p(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}m();document.addEventListener("click",t=>{const n=t.target.closest(".card-export");if(!n)return;t.stopPropagation();const r=n.dataset.id,e=localStorage.getItem(`pm_project_${r}`);if(e)try{const o=JSON.parse(e);h(o,`${r}-${S()}.json`)}catch{alert("내보내기 실패")}});
