// === js/nav.js === Realtime subscriptions, view routing, sidebar, render helpers, home view

// --- Author badge color (dynamic, no hardcoded names) ---
const _authorColorPalette = [
  {bg:'#dbeafe',color:'#1d4ed8'},{bg:'#f3e8ff',color:'#7e22ce'},{bg:'#dcfce7',color:'#166534'},
  {bg:'#fef9c3',color:'#854d0e'},{bg:'#ffe4e6',color:'#be123c'},{bg:'#e0f2fe',color:'#0369a1'}
];
const _authorColorMap = {};
let _authorColorIdx = 0;
function authorBadgeStyle(author) {
  if (!author) return '';
  if (!_authorColorMap[author]) {
    _authorColorMap[author] = _authorColorPalette[_authorColorIdx % _authorColorPalette.length];
    _authorColorIdx++;
  }
  const c = _authorColorMap[author];
  return `background:${c.bg};color:${c.color};`;
}
function authorBadgeHtml(author) {
  if (!author) return '';
  return `<span style="font-size:0.7rem;font-weight:700;padding:0.1rem 0.45rem;border-radius:10px;${authorBadgeStyle(author)}">${author}</span>`;
}

// --- Realtime ---
function setupRealtimeSubscription() {
let _reloadTimer=null;
function _debouncedReload(){clearTimeout(_reloadTimer);_reloadTimer=setTimeout(()=>loadAllData(),500);}
['providers','practices','practice_locations','provider_location_assignments'].forEach(t =>
db.channel(t+'-ch').on('postgres_changes',{event:'*',schema:'public',table:t},_debouncedReload).subscribe());
db.channel('contact-logs-ch')
.on('postgres_changes',{event:'*',schema:'public',table:'contact_logs'},(payload)=>{
const pid=payload.new?.provider_id||payload.old?.provider_id;
if(currentPhysician&&pid===currentPhysician.id&&currentView==='physicians') loadContactLogs(currentPhysician.id).then(()=>renderProfile());
}).subscribe();
}

// --- Date / reminder helpers ---
function calcCalendarDate(days) {
const d = new Date();
d.setDate(d.getDate() + days);
return localDate(d);
}
// prefix defaults to 'reminder'; task modal uses 'task' — IDs: {prefix}DateButtons, {prefix}SelectedDate, {prefix}DatePreview
function populateReminderDateButtons(prefix) {
prefix = prefix || 'reminder';
const container = $(prefix + 'DateButtons');
if (!container) return;
const addDays = (base, n) => { const d = new Date(base + 'T12:00:00'); d.setDate(d.getDate() + n); return localDate(d); };
const today = localDate();
const dow = new Date(today + 'T12:00:00').getDay(); // 0=Sun,6=Sat
const buttons = [];
buttons.push({ label: 'Today', date: today });
buttons.push({ label: 'Tomw', date: addDays(today, 1) });
// Remaining business days this week (after tomorrow, up to Friday)
for (let i = 2; i <= 6; i++) {
  const d = addDays(today, i);
  const dn = new Date(d + 'T12:00:00');
  if (dn.getDay() === 0 || dn.getDay() === 6) continue; // skip weekends
  if (dn.getDay() < (dow === 0 ? 1 : dow)) continue; // already past
  buttons.push({ label: dn.toLocaleDateString('en-US',{weekday:'short'}), date: d });
}
// Next week Mon–Fri
const daysToNextMon = ((8 - dow) % 7) || 7;
for (let i = 0; i < 5; i++) {
  const d = addDays(today, daysToNextMon + i);
  const dn = new Date(d + 'T12:00:00');
  buttons.push({ label: 'Nxt ' + dn.toLocaleDateString('en-US',{weekday:'short'}), date: d });
}
buttons.push({ label: '2 weeks', date: addDays(today, 14) });
buttons.push({ label: 'Open', date: '2099-12-31' });
container.innerHTML = buttons.map(b =>
  `<button type="button" class="reminder-date-btn" data-prefix="${prefix}" onclick="selectReminderDate('${b.date}','${b.label}','${prefix}')" data-date="${b.date}" style="padding:0.3rem 0.55rem;font-size:0.78rem;border:1px solid #fcd34d;border-radius:6px;background:#fffbeb;color:#92400e;cursor:pointer;white-space:nowrap;transition:background 0.1s;touch-action:manipulation;-webkit-tap-highlight-color:transparent;">${b.label}</button>`
).join('');
const customInp = $(prefix + 'CustomDate');
if (customInp) customInp.min = today;
// Default: tomorrow
selectReminderDate(buttons[1].date, buttons[1].label, prefix);
}
function selectReminderDate(dateStr, label, prefix) {
prefix = prefix || 'reminder';
const inp = $(prefix + 'SelectedDate');
if (inp) inp.value = dateStr;
const prev = $(prefix + 'DatePreview');
if (prev) {
  if (dateStr === '2099-12-31') { prev.textContent = 'Open — no due date, will appear in Open Tasks'; }
  else { const d = new Date(dateStr + 'T12:00:00'); prev.textContent = d.toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'}); }
}
const customInp = $(prefix + 'CustomDate');
if (customInp) customInp.value = (dateStr && dateStr !== '2099-12-31') ? dateStr : '';
document.querySelectorAll(`.reminder-date-btn[data-prefix="${prefix}"]`).forEach(btn => {
  const sel = btn.dataset.date === dateStr;
  btn.style.background = sel ? '#f59e0b' : '#fffbeb';
  btn.style.color = sel ? '#fff' : '#92400e';
  btn.style.fontWeight = sel ? '700' : '400';
  btn.style.borderColor = sel ? '#d97706' : '#fcd34d';
});
}
// --- View routing ---
function setView(view) {
// 'tasks' is now a sub-tab of 'activity'; route it there
if(view==='tasks'){activitySubTab='tasks';view='activity';}
_prevView = currentView;
currentView = view;
$('tabPhysicians').classList.toggle('active', view === 'physicians');
$('tabPractices').classList.toggle('active', view === 'practices');
$('tabActivity').classList.toggle('active', view === 'activity');
$('tabMap').classList.toggle('active', view === 'map');
if(view==='activity'){
$('searchInput').placeholder='Search...';
$('addBtn').style.display='none';
$('sortControls').style.display='none';
$('tierFilterControls').style.display='none';
$('searchInput').parentElement.parentElement.style.display='';
$('physicianList').innerHTML='<li class="loading">Loading...</li>';
$('mainContent').innerHTML='<div class="empty-state"><p>Loading…</p></div>';
currentPhysician=null;currentPractice=null;
renderActivityTabView();
return;
}
_activitySearchTerm = '';
if(view==='map'){
$('searchInput').parentElement.parentElement.style.display='';
$('searchInput').placeholder='Filter map…';
$('addBtn').style.display='none';
$('sortControls').style.display='none';
$('tierFilterControls').style.display='none';
$('physicianList').innerHTML='';
currentPhysician=null;currentPractice=null;
renderMapView();
return;
}
$('tabDashboard').classList.toggle('active', view === 'dashboard');
if(view==='dashboard'){
$('searchInput').parentElement.parentElement.style.display='none';
$('addBtn').style.display='none';
$('sortControls').style.display='none';
$('tierFilterControls').style.display='none';
$('physicianList').innerHTML='';
currentPhysician=null;currentPractice=null;
renderDashboard();
return;
}
if(view==='home'){
currentView='physicians';
$('tabPhysicians').classList.add('active');
}
$('searchInput').parentElement.parentElement.style.display='';
$('addBtn').style.display='';
$('searchInput').placeholder = currentView === 'physicians' ? 'Search HCPs...' : 'Search practices...';
$('addBtn').textContent = currentView === 'physicians' ? '+ New Provider' : '+ New Practice';
$('addBtn').onclick = currentView === 'physicians' ? openPhysicianModal : openPracticeModal;
$('sortControls').style.display = currentView === 'physicians' ? 'flex' : 'none';
$('tierFilterControls').style.display = currentView === 'physicians' ? 'flex' : 'none';
currentPhysician = null;
currentPractice = null;
renderList();
renderEmptyState();
}

function setSortBy(sort) {
sortBy = sort;
['Name','City','Zip'].forEach(s => $('sort'+s).classList.remove('active'));
$('sort' + sort.charAt(0).toUpperCase() + sort.slice(1)).classList.add('active');
renderList();
}
function setFilterTier(tier) {
  // Tap the active tier again to deselect it
  filterTier = (filterTier === tier) ? null : tier;
  document.querySelectorAll('#tierFilterControls .sort-btn').forEach(btn => btn.classList.remove('active'));
  if (filterTier) $('filterT' + filterTier).classList.add('active');
  renderList();
}
function toggleFilterTarget() {
  filterTarget = !filterTarget;
  $('filterTarget').classList.toggle('active', filterTarget);
  renderList();
}

// --- Sidebar ---
function goHome() {
currentPhysician = null; currentPractice = null;
setView('physicians');
closeSidebar();
}
function toggleSidebar() {
const isOpen = $('sidebar').classList.toggle('open');
$('sidebarOverlay').style.display = isOpen ? 'block' : 'none';
}
function closeSidebar() {
$('sidebar').classList.remove('open');
$('sidebarOverlay').style.display = 'none';
}
function updateCount() {
const search = $('searchInput').value.trim().toLowerCase();
if (currentView === 'physicians') {
const filtered = getFilteredPhysicians(search);
$('physicianCount').textContent =
`${filtered.length} of ${physicians.length} provider${physicians.length !== 1 ? 's' : ''}`;
} else {
const filtered = getFilteredPractices(search);
$('physicianCount').textContent =
`${filtered.length} of ${practices.length} practice${practices.length !== 1 ? 's' : ''}`;
}
}

// --- Render helpers ---
function fmtName(p) {
const deg = p.degree || '';
const tl = p.title || '';
if (deg) return `${p.first_name} ${p.last_name}, ${deg}`;
if (tl) return `${p.first_name} ${p.last_name} (${tl})`;
return `${p.first_name} ${p.last_name}`;
}
function getSortedPhysicians(filtered) {
return [...filtered].sort((a, b) => {
if (sortBy === 'name') {
return a.last_name.localeCompare(b.last_name);
} else if (sortBy === 'city') {
const cityA = getPrimaryLoc(a.id).city || 'zzz';
const cityB = getPrimaryLoc(b.id).city || 'zzz';
return cityA.localeCompare(cityB);
} else if (sortBy === 'zip') {
const zipA = getPrimaryLoc(a.id).zip || 'zzz';
const zipB = getPrimaryLoc(b.id).zip || 'zzz';
return zipA.localeCompare(zipB);
} else if (sortBy === 'tier') {
const tierA = normPriority(a.priority) || 'zzz';
const tierB = normPriority(b.priority) || 'zzz';
return tierA.localeCompare(tierB);
}
return 0;
});
}
function ld(val,icon,content){return val?`<div class="location-detail"><span class="location-detail-icon">${icon}</span><span class="location-detail-value">${content||val}</span></div>`:''}
// Display-only: normalise Suite/Ste/STE variants to #NNN format
function fmtSuiteAddr(addr){if(!addr)return addr;return addr.replace(/\bSte\.?\s*#?(\d+)/gi,'#$1').replace(/\bSuite\s*#?(\d+)/gi,'#$1').replace(/\bUnit\s*#?(\d+)/gi,'#$1');}
function locAddr(loc){const rawAddr=fmtSuiteAddr(loc.address)||'';const a=rawAddr+', '+(loc.city||'')+' '+(loc.zip||'');return`<a href="https://maps.apple.com/?q=${encodeURIComponent(a)}" target="_blank" style="color:#1e3a8a;text-decoration:underline;">${rawAddr}${loc.city?', '+loc.city:''}${loc.zip?' '+loc.zip:''}</a>`}
function normDegree(d){if(!d)return d;return d.replace(/\./g,'').trim();}
function fmtPhone(p){if(!p)return'';var d=(p+'').replace(/\D/g,'');if(d.length===11&&d[0]==='1')d=d.substring(1);if(d.length===10)return d.substring(0,3)+'-'+d.substring(3,6)+'-'+d.substring(6);return p;}
function locPhone(p,locId){var f=fmtPhone(p);return`<a href="tel:${(p||'').replace(/\D/g,'')}"${locId?` data-loc-id="${locId}"`:''}>${f||p}</a>`}
function locPhones(raw,icon,locId){if(!raw)return'';return raw.split(/[\/,]/).map(s=>s.trim()).filter(Boolean).map(p=>ld(p,icon,locPhone(p,locId))).join('');}
function locDetails(loc){return ld(loc.address,'📍',locAddr(loc))+locPhones(loc.phone,'📞',loc.id)+locPhones(loc.fax,'📠')+ld(loc.practice_email,'✉️',loc.practice_email?`<a href="mailto:${loc.practice_email}">${loc.practice_email}</a>`:'')+ld(loc.office_hours,'🕐')+ld(loc.office_staff,'👥')+ld(loc.receptionist_name,'👤')+ld(loc.best_days,'📅')+ld(loc.notes,'📝')}
function mi(label,val){return `<div class="meta-item"><div class="meta-label">${label}</div><div class="meta-value">${val}</div></div>`}
function parseNoteTime(notes){const tm=(notes||'').match(/^\[(\d{1,2}:\d{2}(?:\s*[APap][Mm])?)\]\s*/);return tm?{time:' '+tm[1],text:notes.replace(tm[0],'')}:{time:'',text:notes||''};}
function parseTaskRecord(notes){const tm=(notes||'').match(/^\[(\d{1,2}:\d{2}(?:\s*[APap][Mm])?)\]\s*/);let dn=tm?notes.replace(tm[0],''):(notes||'');const txm=dn.match(/\s*\|\s*\[Task:\s*(.*?)\]$/);const taskNote=txm?txm[1].trim():'';if(txm)dn=dn.slice(0,txm.index).trim();return{noteTime:tm?tm[1]:'',displayNotes:dn,taskNote};}
function renderLogEntry(e,opts={}){const{time,text}=parseNoteTime(e.notes);const preview=opts.full?text:(text.length>120?text.substring(0,120)+'...':text);
const fmtCD=(ds)=>{if(!ds)return'';const d=new Date(ds+'T12:00:00');return d.toLocaleDateString('en-US',{month:'short',day:'numeric'});};
const headerLine1=`${fmtCD(e.contact_date)}${time?' · '+time.trim():''}${e.author?' — '+e.author:''}`;
const locCtx=e.practice_location_id?getLocationContext(e.practice_location_id):'';
const physPart=opts.physName?` | ${opts.physName}`:'';
const headerLine2=(locCtx||physPart)?`<div style="font-size:0.78rem;color:#555;margin-top:0.1rem;">${locCtx}${physPart}</div>`:'';
const reminderLine=e.reminder_date?(e.reminder_date==='2000-01-01'?`<span style="font-size:0.7rem;padding:0.15rem 0.5rem;background:#d1fae5;color:#065f46;border-radius:4px;margin-left:0.4rem;">✓ Done</span>`:e.reminder_date==='2099-12-31'?`<span style="font-size:0.7rem;padding:0.15rem 0.5rem;background:#e5e7eb;color:#6b7280;border-radius:4px;margin-left:0.4rem;">📌 Open</span>`:`<span style="font-size:0.7rem;padding:0.15rem 0.5rem;background:#fef3c7;color:#92400e;border-radius:4px;margin-left:0.4rem;">🔔 ${new Date(e.reminder_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>`):'';
const editFn=opts.editFn||`editNote('${e.id}')`;
const delFn=opts.deleteFn||`deleteNote('${e.id}')`;
const actions=opts.editable?`<div class="contact-entry-actions"><button class="icon-btn" onclick="event.stopPropagation();${editFn}" title="Edit">✏️</button><button class="icon-btn" onclick="event.stopPropagation();${delFn}" title="Delete">🗑️</button></div>`:'';
const today=localDate();const _isDone=e.reminder_date==='2000-01-01';const _isOD=e.reminder_date&&!_isDone&&e.reminder_date!=='2099-12-31'&&e.reminder_date<today;const _isPending=e.reminder_date&&!_isDone&&!_isOD;const barColor=e.reminder_date?(_isDone?'#10b981':_isOD?'#dc2626':'#f59e0b'):null;if(barColor){if(!window._taskDetailLogs)window._taskDetailLogs={};window._taskDetailLogs[e.id]=e;}const bgColor=_isDone?'background:#f0fdf4;':_isOD?'background:#fff5f5;':_isPending?'background:#fffbeb;':'';const divStyle=(barColor?`border-left:4px solid ${barColor};${bgColor}`:'')+(opts.onClick?'cursor:pointer;':'');const clickAttr=opts.onClick?` onclick="${opts.onClick}"`:'';
return `<div class="contact-entry"${divStyle?` style="${divStyle}"`:''}${clickAttr}><div class="contact-entry-header"><div><span class="contact-entry-date">${headerLine1}</span>${reminderLine}${headerLine2}</div>${actions}</div><div class="contact-entry-notes">${preview}</div></div>`;}
// Renders a single entry in the provider profile log — handles both tasks (colored bars) and plain notes
function renderProfileEntry(e) {
if (!e.reminder_date) {
// Plain activity note — use standard renderer
return renderLogEntry(e,{editable:true,showTimestamp:true,full:true});
}
// Task entry — show with status-colored bar and complete button
const today = localDate();
const isDone = e.reminder_date === '2000-01-01';
const isOpen = e.reminder_date === '2099-12-31';
const isOverdue = !isDone && !isOpen && e.reminder_date < today;
let barColor = '#f59e0b'; // pending = amber
if (isDone) barColor = '#10b981'; // completed = bright green
else if (isOverdue) barColor = '#dc2626'; // overdue = red
// populate _taskDetailLogs so task detail modal can open this record
if (!window._taskDetailLogs) window._taskDetailLogs = {};
window._taskDetailLogs[e.id] = e;
const {displayNotes,taskNote} = parseTaskRecord(e.notes);
const preview = displayNotes.length > 120 ? displayNotes.slice(0,120)+'...' : displayNotes;
const editFn = `editTaskFromList('${e.id}')`;
const delFn = `deleteNote('${e.id}')`;
const cardId = `plog-${e.id}`;
const statusText = isDone ? '✓ Completed' : isOpen ? '📌 Open — no due date' : isOverdue ? `⚠️ OVERDUE — Due ${new Date(e.reminder_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}` : `🔔 Due ${new Date(e.reminder_date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}`;
// Background tints: amber for pending/open, pink for overdue, green for completed
const bgColor = isDone ? 'background:#f0fdf4;opacity:0.9;' : isOverdue ? 'background:#fff5f5;' : 'background:#fffbeb;';
const completeBtn = isDone ? `<div style="width:22px;height:22px;min-width:22px;border-radius:50%;background:#10b981;color:white;display:flex;align-items:center;justify-content:center;font-size:0.75rem;flex-shrink:0;margin-top:0.1rem;">✓</div>` : `<button onclick="event.stopPropagation();completeReminderInPlace('${e.id}','${cardId}',()=>{})" title="Mark complete" style="background:none;border:2px solid ${barColor};color:${barColor};border-radius:50%;width:22px;height:22px;min-width:22px;cursor:pointer;font-size:0.75rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:0.1rem;">✓</button>`;
return `<div class="contact-entry" id="${cardId}" style="border-left-color:${barColor};${bgColor}display:flex;gap:0.5rem;align-items:flex-start;cursor:pointer;" onclick="openTaskDetailModal('${e.id}')">${completeBtn}<div style="flex:1;"><div style="font-size:0.7rem;color:#999;margin-bottom:0.2rem;">${new Date(e.contact_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}${e.author?' — '+e.author:''}</div><div style="font-size:0.75rem;font-weight:600;color:${isOverdue?'#dc2626':isDone?'#065f46':'#92400e'};margin-bottom:0.2rem;">${statusText}</div>${taskNote?`<div style="font-size:0.85rem;font-weight:600;color:#92400e;background:#fef3c7;padding:0.15rem 0.4rem;border-radius:4px;margin-bottom:0.2rem;">📋 ${taskNote}</div>`:''}<div style="font-size:0.85rem;color:#333;">${preview}</div><div style="display:flex;gap:0.5rem;margin-top:0.4rem;"><button class="icon-btn" onclick="event.stopPropagation();${editFn}" title="Edit task" style="font-size:0.8rem;">✏️ Edit</button><button class="icon-btn" onclick="event.stopPropagation();${delFn}" title="Delete" style="font-size:0.8rem;color:#dc2626;">🗑️</button></div></div></div>`;
}
function ci(icon,label,val){return val?`<div class="contact-item"><div class="contact-icon">${icon}</div><div class="contact-item-content"><div class="contact-item-label">${label}</div><div class="contact-item-value">${val}</div></div></div>`:''}
function getPracticeName(practiceId){const p=practices.find(pr=>pr.id===practiceId);return p?p.name:'';}
function getPrimaryLoc(physicianId) {
const a = physicianAssignments[physicianId] || [];
const assign = a.find(x => x.is_primary) || a[0];
if (!assign) return {};
return assign.practice_locations || practiceLocations.find(l => l.id === assign.practice_location_id) || {};
}
function getLocationLabel(locationId) {
const loc = practiceLocations.find(l => l.id === locationId);
if (!loc) return '';
const practice = practices.find(p => p.id === loc.practice_id);
const practiceName = practice?.name || '';
const locLabel = loc.label || '';
if (practiceName && locLabel) return `${practiceName} — ${locLabel}`;
if (practiceName) return practiceName;
if (locLabel) return locLabel;
return `${loc.address}, ${loc.city}`;
}
function getLocationContext(locationId) {
const loc = practiceLocations.find(l => l.id === locationId);
if (!loc) return '';
const pname = getPracticeName(loc.practice_id);
const city = loc.city || loc.label || '';
const addr = loc.address || '';
return pname ? `${pname}${city ? ' · ' + city : ''}` : `${addr}${city ? ', ' + city : ''}`;
}

// --- Shared helpers for location option labels and task card links ---
// Formats a location for a <select> option label: "Practice Name — Label (address)"
function fmtLocOption(loc, prac) {
const label = loc.label && loc.label !== loc.city ? loc.label : loc.city || 'Office';
return `${prac ? prac.name + ' — ' : ''}${label}${loc.address ? ' (' + loc.address + ')' : ''}`;
}
// Returns a clickable email link for a provider (empty string if no email)
function getPhysEmailLink(phys) {
return phys?.email ? ` <a href="mailto:${phys.email}" onclick="event.stopPropagation()" style="color:#1e3a8a;font-size:0.75rem;">✉️ Email</a>` : '';
}
// Returns a clickable phone link derived from a task/log record's location (empty string if none)
function getTaskPhoneLink(r) {
const locId = r.practice_location_id || (physicianAssignments[r.provider_id]?.find(a=>a.is_primary)||physicianAssignments[r.provider_id]?.[0])?.practice_location_id;
const loc = locId ? practiceLocations.find(l=>l.id===locId) : null;
return loc?.phone ? ` <a href="tel:${loc.phone.replace(/\D/g,'')}" data-provider-id="${r.provider_id||''}" data-loc-id="${locId||''}" onclick="event.stopPropagation()" style="color:#1e3a8a;font-size:0.75rem;">📞 ${fmtPhone(loc.phone)}</a>` : '';
}

// --- Normalize priority (handles legacy "TIER 3 - MODERATE" and "3" and "P3") ---
function normPriority(val) {
  if (!val && val !== 0) return null;
  const m = String(val).match(/(\d)/);
  return m ? m[1] : null;
}

// --- Filter / list rendering ---
function getFilteredPhysicians(search) {
let base = filterTier ? physicians.filter(p => normPriority(p.priority) === filterTier) : physicians;
if (filterTarget) base = base.filter(p => !!p.is_target);
if (!search) return base;
return base.filter(p => {
const np = normPriority(p.priority);
if ([((p.first_name||'')+' '+(p.last_name||'')).trim(),fmtName(p),p.first_name,p.last_name,p.specialty,p.email,p.general_notes,np?'P'+np:null,p.academic_connection||p.um_connection,p.proj_vol,p.mohs_volume,p.practice_name].some(v=>String(v??'').toLowerCase().includes(search))) return true;
const logs=contactLogs[p.id]||[];
if(logs.some(l=>(l.notes||'').toLowerCase().includes(search)||(l.author||'').toLowerCase().includes(search))) return true;
const assigns=physicianAssignments[p.id]||[];
return assigns.some(a=>{const loc=a.practice_locations||{};const pName=loc.practices?.name||'';
return[pName,loc.city,loc.zip,loc.address,loc.phone,loc.fax,loc.practice_email,loc.office_hours,loc.office_staff,loc.receptionist_name,loc.best_days,loc.label].some(v=>(v||'').toLowerCase().includes(search));});
});
}
function getFilteredPractices(search) {
if (!search) return practices;
return practices.filter(p => {
if([p.name,p.website,p.general_notes].some(v=>(v||'').toLowerCase().includes(search))) return true;
const phys=physicians.filter(ph=>(physicianAssignments[ph.id]||[]).some(a=>a.practice_locations?.practice_id===p.id));
if(phys.some(ph=>(ph.first_name+' '+ph.last_name).toLowerCase().includes(search))) return true;
const locs=practiceLocations.filter(l=>l.practice_id===p.id);
return locs.some(l=>[l.address,l.city,l.zip,l.phone,l.fax,l.practice_email,l.office_hours,l.office_staff,l.receptionist_name,l.best_days,l.label].some(v=>(v||'').toLowerCase().includes(search)));
});
}
let _mapFilterTimer=null;
function filterList() {
const val = $('searchInput').value;
$('searchClear').style.display = val ? 'flex' : 'none';
if(currentView==='activity'){_activitySearchTerm=val.trim().toLowerCase();renderActivityTabView();}
else if(currentView==='map'){clearTimeout(_mapFilterTimer);_mapFilterTimer=setTimeout(renderMapView,500);}
else renderList();
}
function clearSearch() {
$('searchInput').value = '';
$('searchClear').style.display = 'none';
if(currentView==='activity'){_activitySearchTerm='';renderActivityTabView();}
else if(currentView==='map'){renderMapView();}
else renderList();
$('searchInput').focus();
}
function renderList() {
const list = $('physicianList');
const search = $('searchInput').value.trim().toLowerCase();
if (currentView === 'physicians') {
renderPhysicianList(list, search);
} else {
renderPracticeList(list, search);
}
updateCount();
}
function renderPhysicianList(list, search) {
const filtered = getFilteredPhysicians(search);
const sorted = getSortedPhysicians(filtered);
if (sorted.length === 0) {
list.innerHTML = '<li class="loading">No providers found</li>';
return;
}
list.innerHTML = sorted.map(p => {
const assignments = physicianAssignments[p.id] || [];
const primaryAssign = assignments.find(a => a.is_primary) || assignments[0];
const pLoc = primaryAssign?.practice_locations || (primaryAssign ? practiceLocations.find(l => l.id === primaryAssign.practice_location_id) : null) || {};
const cityDisplay = pLoc.city || '';
const zipDisplay = pLoc.zip || '';
const locBadgeText = sortBy === 'zip'
  ? (zipDisplay && cityDisplay ? `${cityDisplay} ${zipDisplay}` : zipDisplay || cityDisplay)
  : cityDisplay;
const practiceName = pLoc.practices?.name || getPracticeName(pLoc.practice_id) || p.practice_name || '';
const locationCount = assignments.length;
const tierStyles={'1':'background:#ef4444;color:white','2':'background:#f97316;color:white','3':'background:#3b82f6;color:white','4':'background:#8b5cf6;color:white','5':'background:#64748b;color:white'};
const isStaff=isStaffSpecialty(p.specialty);
const np=normPriority(p.priority);
const tierBadge=isStaff?`<div class="tier" style="background:#0891b2;color:white;">Staff</div>`:np?`<div class="tier" style="${tierStyles[np]||''}">P${np}</div>`:'';
const mobileBadge=p.is_mobile?`<span class="city-badge" style="background:#ede9fe;color:#6d28d9;">🏠 Mobile</span>`:'';
return `
<li class="physician-item ${currentPhysician?.id === p.id ? 'active' : ''}"
onclick="viewPhysician('${p.id}')">
<div class="name">${fmtName(p)}</div>
<div class="practice">${practiceName}</div>
${tierBadge}
${mobileBadge}
${!p.is_mobile && locBadgeText ? `<span class="city-badge">${locBadgeText}</span>` : ''}
${locationCount > 1 ? `<span class="city-badge">+${locationCount - 1} more</span>` : ''}
</li>
`}).join('');
}
function renderPracticeList(list, search) {
const filtered = getFilteredPractices(search);
if (filtered.length === 0) {
list.innerHTML = '<li class="loading">No practices found</li>';
return;
}
list.innerHTML = filtered.map(p => {
const locations = practiceLocations.filter(l => l.practice_id === p.id);
const cities = [...new Set(locations.map(l => l.city).filter(Boolean))];
return `
<li class="physician-item ${currentPractice?.id === p.id ? 'active' : ''}"
onclick="viewPractice('${p.id}')">
<div class="name">${p.name}</div>
<div class="practice">${locations.length} location${locations.length !== 1 ? 's' : ''}</div>
${cities.slice(0, 2).map(c => `<span class="city-badge">${c}</span>`).join('')}
${cities.length > 2 ? `<span class="city-badge">+${cities.length - 2} more</span>` : ''}
</li>
`}).join('');
}

// --- Home view ---
async function renderEmptyState() {
$('mainContent').innerHTML = `
<div class="empty-state">
<h2>Welcome to CRM Demo</h2>
<p>Select a ${currentView === 'physicians' ? 'provider' : 'practice'} from the list to view details</p>
</div>
<div class="section" style="margin-top:1rem;">
<div class="section-header"><h3 style="color:#92400e;">Follow-Up Reminders</h3><button onclick="openAddTaskModal(null,null)" style="padding:0.4rem 0.9rem;background:#1e3a8a;color:white;border:none;border-radius:6px;font-size:0.85rem;font-weight:600;cursor:pointer;">+ New Task</button></div>
<div id="remindersContent"><div class="loading">Loading reminders...</div></div>
</div>
<div class="section">
<div class="section-header"><h3>Recent Activity</h3></div>
<div id="recentActivityContent"><div class="loading">Loading recent activity...</div></div>
</div>
<div class="section">
<div class="section-header"><h3>Quick Stats</h3></div>
<div class="profile-meta">
${mi('Providers',physicians.length)}${mi('Practices',practices.length)}${mi('Locations',practiceLocations.length)}${mi('Cities',[...new Set(practiceLocations.map(l=>l.city).filter(Boolean))].length)}
</div>
</div>
`;
try {
const today = localDate();
const [{data:reminders,error:remErr},{data:recentLogs,error:actErr}] = await Promise.all([
  db.from('contact_logs').select('*').not('reminder_date','is',null).neq('reminder_date','2000-01-01').order('reminder_date',{ascending:true}),
  db.from('contact_logs').select('*').order('created_at',{ascending:false}).limit(15),
]);
if (reminders) { if (!window._taskDetailLogs) window._taskDetailLogs = {}; reminders.forEach(r => window._taskDetailLogs[r.id] = r); }
const rc = $('remindersContent');
if (remErr) { rc.innerHTML = '<div class="empty-notice">Could not load reminders</div>'; }
else if (!reminders || reminders.length === 0) {
rc.innerHTML = '<div class="empty-notice" style="color:#92400e;">No follow-up reminders set.</div>';
} else {
const OPEN_DATE = '2099-12-31';
const openReminders = reminders.filter(r => r.reminder_date === OPEN_DATE);
const datedR2 = reminders.filter(r => r.reminder_date !== OPEN_DATE);
const overdue = datedR2.filter(r => r.reminder_date < today);
const upcoming = datedR2.filter(r => r.reminder_date >= today);
let html = '';
if (overdue.length > 0) {
html += `<div style="margin-bottom:1rem;"><div style="font-size:0.75rem;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.5rem;padding-bottom:0.25rem;border-bottom:2px solid #fca5a5;">⚠️ Overdue (${overdue.length})</div>`;
overdue.forEach(r => {
const phys = r.provider_id ? physicians.find(p => p.id === r.provider_id) : null;
const physName = phys ? fmtName(phys) : (r.practice_location_id ? getLocationLabel(r.practice_location_id) : 'General Reminder');
const emailLink = phys?.email ? ` — ${getPhysEmailLink(phys).trimStart()}` : '';
const phoneLink = getTaskPhoneLink(r);
const {displayNotes,taskNote}=parseTaskRecord(r.notes);
const preview = displayNotes.length > 100 ? displayNotes.substring(0,100) + '...' : displayNotes;
html += `<div class="contact-entry" style="cursor:pointer;border-left-color:#dc2626;background:#fff5f5;margin-bottom:0.5rem;display:flex;gap:0.5rem;align-items:flex-start;" onclick="openTaskDetailModal('${r.id}')">
<button onclick="event.stopPropagation();completeReminder('${r.id}')" title="Mark complete" style="background:none;border:2px solid #dc2626;color:#dc2626;border-radius:50%;width:22px;height:22px;min-width:22px;cursor:pointer;font-size:0.75rem;display:flex;align-items:center;justify-content:center;margin-top:0.15rem;flex-shrink:0;">✓</button>
<div style="flex:1;">
<div style="font-weight:600;color:#dc2626;font-size:0.9rem;">${physName}${phoneLink}${emailLink}</div>
<div style="font-size:0.75rem;color:#dc2626;font-weight:600;">Due: ${r.reminder_date} (OVERDUE) ${authorBadgeHtml(r.author)}</div>
${taskNote?`<div style="font-size:0.8rem;font-weight:600;color:#92400e;background:#fef3c7;padding:0.15rem 0.4rem;border-radius:4px;margin-top:0.2rem;">📋 ${taskNote}</div>`:''}
<div style="font-size:0.8rem;color:#666;margin-top:0.2rem;">${preview}</div>
</div>
</div>`;
});
html += '</div>';
}
if (upcoming.length > 0) {
const byDate = {};
upcoming.forEach(r => { if (!byDate[r.reminder_date]) byDate[r.reminder_date] = []; byDate[r.reminder_date].push(r); });
Object.entries(byDate).forEach(([date, dayReminders]) => {
const d = new Date(date + 'T12:00:00');
const label = d.toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'});
const isToday = date === today;
html += `<div style="margin-bottom:0.75rem;"><div style="font-size:0.75rem;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.5rem;padding-bottom:0.25rem;border-bottom:2px solid #fcd34d;">${isToday ? '📅 TODAY — ' : ''}${label}</div>`;
dayReminders.forEach(r => {
const phys = r.provider_id ? physicians.find(p => p.id === r.provider_id) : null;
const physName = phys ? fmtName(phys) : (r.practice_location_id ? getLocationLabel(r.practice_location_id) : 'General Reminder');
const emailLink = phys?.email ? ` — ${getPhysEmailLink(phys).trimStart()}` : '';
const phoneLink = getTaskPhoneLink(r);
const {displayNotes,taskNote}=parseTaskRecord(r.notes);
const preview = displayNotes.length > 100 ? displayNotes.substring(0,100) + '...' : displayNotes;
html += `<div class="contact-entry" style="cursor:pointer;border-left-color:#f59e0b;background:#fffbeb;margin-bottom:0.5rem;display:flex;gap:0.5rem;align-items:flex-start;" onclick="openTaskDetailModal('${r.id}')">
<button onclick="event.stopPropagation();completeReminder('${r.id}')" title="Mark complete" style="background:none;border:2px solid #f59e0b;color:#92400e;border-radius:50%;width:22px;height:22px;min-width:22px;cursor:pointer;font-size:0.75rem;display:flex;align-items:center;justify-content:center;margin-top:0.15rem;flex-shrink:0;">✓</button>
<div style="flex:1;">
<div style="font-weight:600;color:#1e3a8a;font-size:0.9rem;">${physName}${phoneLink}${emailLink}</div>
${taskNote?`<div style="font-size:0.8rem;font-weight:600;color:#92400e;background:#fef3c7;padding:0.15rem 0.4rem;border-radius:4px;margin-top:0.2rem;">📋 ${taskNote}</div>`:''}
<div style="font-size:0.8rem;color:#666;margin-top:0.2rem;">${preview}</div>
${r.author ? '<div style="margin-top:0.2rem;">'+authorBadgeHtml(r.author)+'</div>' : ''}
</div>
</div>`;
});
html += '</div>';
});
}
if (openReminders.length > 0) {
html += `<div style="margin-bottom:0.5rem;"><div style="font-size:0.75rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.5rem;padding-bottom:0.25rem;border-bottom:2px solid #d1d5db;">📌 Open (${openReminders.length})</div>`;
openReminders.forEach(r => {
const phys = r.provider_id ? physicians.find(p => p.id === r.provider_id) : null;
const physName = phys ? fmtName(phys) : (r.practice_location_id ? getLocationLabel(r.practice_location_id) : 'General Reminder');
const emailLink = phys?.email ? ` — ${getPhysEmailLink(phys).trimStart()}` : '';
const phoneLink = getTaskPhoneLink(r);
const {displayNotes,taskNote}=parseTaskRecord(r.notes);
const preview = displayNotes.length > 80 ? displayNotes.substring(0,80) + '...' : displayNotes;
html += `<div class="contact-entry" style="cursor:pointer;border-left-color:#f59e0b;background:#fffbeb;margin-bottom:0.5rem;display:flex;gap:0.5rem;align-items:flex-start;" onclick="openTaskDetailModal('${r.id}')">
<button onclick="event.stopPropagation();completeReminder('${r.id}')" title="Mark complete" style="background:none;border:2px solid #f59e0b;color:#92400e;border-radius:50%;width:22px;height:22px;min-width:22px;cursor:pointer;font-size:0.75rem;display:flex;align-items:center;justify-content:center;margin-top:0.15rem;flex-shrink:0;">✓</button>
<div style="flex:1;">
<div style="font-weight:600;color:#1e3a8a;font-size:0.9rem;">${physName}${phoneLink}${emailLink}</div>
${taskNote?`<div style="font-size:0.8rem;font-weight:600;color:#92400e;background:#fef3c7;padding:0.15rem 0.4rem;border-radius:4px;margin-top:0.2rem;">📋 ${taskNote}</div>`:''}
<div style="font-size:0.8rem;color:#666;margin-top:0.2rem;">${preview}</div>
${r.author ? '<div style="margin-top:0.2rem;">'+authorBadgeHtml(r.author)+'</div>' : ''}
</div></div>`;
});
html += '</div>';
}
rc.innerHTML = html || '<div class="empty-notice" style="color:#92400e;">No reminders found.</div>';
}
} catch(e) {
const rc = $('remindersContent');
if (rc) rc.innerHTML = '<div class="empty-notice">Could not load reminders</div>';
}
try {
if (actErr) throw actErr;
const container = $('recentActivityContent');
if (!recentLogs || recentLogs.length === 0) {
container.innerHTML = '<div class="empty-notice">No contact notes yet. Start logging your visits and calls!</div>';
return;
}
container.innerHTML = '<div class="contact-entries">' + recentLogs.map(e => {
const phys = e.provider_id ? physicians.find(p => p.id === e.provider_id) : null;
const clickFn = e.provider_id ? `viewPhysician('${e.provider_id}')` : e.practice_location_id ? `viewLocation('${e.practice_location_id}')` : '';
return renderLogEntry(e,{physName:phys?fmtName(phys):null,onClick:clickFn||undefined});
}).join('') + '</div>';
} catch(e) {
const container = $('recentActivityContent');
if (container) container.innerHTML = '<div class="empty-notice">Could not load recent activity</div>';
}
}

async function viewPhysician(id) {
currentPhysician = physicians.find(p => p.id === id);
currentPractice = null;
currentLocationId = null;
if (!currentPhysician) return;
await loadContactLogs(id);
renderList();
renderProfile();
if (window.innerWidth <= 768) {
closeSidebar();
}
}

function viewLocation(locId) {
const loc = practiceLocations.find(l => l.id === locId);
if (!loc) return;
currentPractice = practices.find(p => p.id === loc.practice_id);
currentPhysician = null;
currentLocationId = locId;
renderList();
renderLocationProfile(loc);
if (window.innerWidth <= 768) closeSidebar();
}

async function viewPractice(id) {
currentPractice = practices.find(p => p.id === id);
currentPhysician = null;
currentLocationId = null;
if (!currentPractice) return;
renderList();
renderPracticeProfile();
if (window.innerWidth <= 768) {
closeSidebar();
}
}

