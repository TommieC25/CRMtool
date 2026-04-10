// === js/views.js === Activity view, Tasks view, Dashboard view, Map view
let _taskDetailLogs = {};
let activitySubTab = 'history'; // 'history' | 'activity' | 'tasks'
let _activitySearchTerm = '';
let _activityAuthorFilter = '';
let _knownAuthors = [];
let _taskSectionsState = {}; // tracks which sections are collapsed by id
function toggleTaskSection(id){
  _taskSectionsState[id]=!_taskSectionsState[id];
  const content=document.getElementById('tsc-'+id);
  const caret=document.getElementById('tsc-caret-'+id);
  if(content){content.style.display=_taskSectionsState[id]?'none':'block';}
  if(caret){caret.textContent=_taskSectionsState[id]?'▶':'▼';}
}
const fmtD = ds => { if(!ds)return''; const d=new Date(ds+'T12:00:00'); return d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}); };

// --- Activity sub-tab navigation HTML helper ---
function _activityTabsHtml() {
const tabs = [{id:'history',label:'HISTORY'},{id:'activity',label:'ACTIVITY'},{id:'tasks',label:'TASKS'}];
const esc = _activitySearchTerm.replace(/"/g,'&quot;');
return `<div style="display:flex;gap:0.5rem;margin-bottom:0.75rem;padding-bottom:0.75rem;border-bottom:2px solid #f0f0f0;">`+tabs.map(t=>`<button onclick="switchActivityTab('${t.id}')" style="padding:0.45rem 0.9rem;border:none;border-radius:6px;font-size:0.78rem;font-weight:700;cursor:pointer;letter-spacing:0.5px;transition:all 0.15s;-webkit-tap-highlight-color:transparent;${activitySubTab===t.id?'background:#1e3a8a;color:white;':'background:#e5e7eb;color:#374151;'}">${t.label}</button>`).join('')+`</div><div style="margin-bottom:1rem;position:relative;display:flex;align-items:center;"><span style="position:absolute;left:0.65rem;font-size:0.95rem;pointer-events:none;">🔍</span><input type="search" id="activitySearchInput" value="${esc}" oninput="activitySearch(this.value)" onchange="activitySearch(this.value)" onsearch="activitySearch(this.value)" placeholder="Search by name, practice, city, notes…" style="width:100%;padding:0.5rem 2rem 0.5rem 2.1rem;border:1px solid #d1d5db;border-radius:8px;font-size:0.9rem;font-family:inherit;background:#fff;" autocapitalize="none" autocorrect="off" spellcheck="false">${_activitySearchTerm?`<button onclick="activitySearch('')" style="position:absolute;right:0.6rem;background:none;border:none;font-size:1.2rem;cursor:pointer;color:#999;line-height:1;padding:0;">×</button>`:''}</div><div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;"><span style="font-size:0.8rem;color:#666;font-weight:600;white-space:nowrap;">By:</span><select onchange="setActivityAuthorFilter(this.value)" style="padding:0.35rem 0.6rem;border:1px solid #d1d5db;border-radius:7px;font-size:0.85rem;font-family:inherit;background:#fff;cursor:pointer;"><option value=""${!_activityAuthorFilter?' selected':''}>All</option>${_knownAuthors.map(a=>`<option value="${a}"${_activityAuthorFilter===a?' selected':''}>${a}</option>`).join('')}</select></div>`;
}

// --- Activity tab switcher (called from sub-tab buttons) ---
window.switchActivityTab = async function(tab) {
activitySubTab = tab;
await renderActivityTabView();
};
window.activitySearch = function(val) {
_activitySearchTerm = (val||'').trim().toLowerCase();
let p;
if(activitySubTab==='history') p=renderHistoryView();
else if(activitySubTab==='activity') p=renderActivityView();
else p=renderTasksView();
Promise.resolve(p).then(()=>{const inp=document.getElementById('activitySearchInput');if(inp){inp.focus();inp.setSelectionRange(inp.value.length,inp.value.length);}});
};
window.setActivityAuthorFilter = function(val) {
_activityAuthorFilter = (val||'').trim();
renderActivityTabView();
};
function closeTaskDetailModal() { closeModal('taskDetailModal'); }

// Opens the task edit modal directly from a task card (bypasses activity editor)
function editTaskFromList(logId) {
const r = _taskDetailLogs[logId] || (window._taskDetailLogs||{})[logId];
if (!r) return;
window._openedTaskRec = r;
openEditTaskModal();
}

// === CALENDAR EXPORT (.ics) ===
function downloadTaskICS(r, phys, loc, practice, timeVal) {
  if (!r.reminder_date || r.reminder_date === '2099-12-31') { return; }
  const name = phys ? fmtName(phys) : (practice ? practice.name : (loc ? (loc.label || 'Office') : 'Task'));
  const ds = r.reminder_date.replace(/-/g, '');
  let location = '';
  if (loc) { const parts = [loc.address, loc.city, loc.zip ? loc.zip : loc.city || ''].filter(Boolean); location = parts.join(', '); }
  const uid = 'woundcare-' + (r.id || Date.now()) + '@woundcarecrm';
  const stamp = new Date().toISOString().replace(/[-:.]/g,'').slice(0,15) + 'Z';
  let dtStart,dtEnd;if(timeVal){const[hh,mm]=timeVal.split(':');const dEnd=new Date(r.reminder_date+'T'+timeVal+':00');dEnd.setHours(dEnd.getHours()+1);const endStr=r.reminder_date.replace(/-/g,'')+`T${String(dEnd.getHours()).padStart(2,'0')}${String(dEnd.getMinutes()).padStart(2,'0')}00`;dtStart='DTSTART;TZID=America/New_York:'+ds+'T'+hh+mm+'00';dtEnd='DTEND;TZID=America/New_York:'+endStr;}else{const dsNext=(()=>{const d=new Date(r.reminder_date+'T12:00:00');d.setDate(d.getDate()+1);return d.toISOString().slice(0,10).replace(/-/g,'');})();dtStart='DTSTART;VALUE=DATE:'+ds;dtEnd='DTEND;VALUE=DATE:'+dsNext;}
  const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//WoundCareCRM//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT','UID:'+uid,'DTSTAMP:'+stamp,dtStart,dtEnd,'SUMMARY:'+name,location?'LOCATION:'+location:null,'BEGIN:VALARM','TRIGGER:-PT30M','ACTION:DISPLAY','DESCRIPTION:'+name,'END:VALARM','END:VEVENT','END:VCALENDAR'].filter(l=>l!==null).join('\r\n');
  const blob = new Blob([ics], {type:'text/calendar;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'visit-' + name.replace(/\s+/g,'-').replace(/[^a-z0-9-]/gi,'').toLowerCase() + '.ics';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function buildGoogleCalendarUrl(r, phys, loc, practice, timeVal) {
  const name = phys ? fmtName(phys) : (practice ? practice.name : (loc ? (loc.label || 'Office') : 'Task'));
  const ds = r.reminder_date.replace(/-/g, '');
  let location = '';
  if (loc) { const cityState = [loc.city, loc.zip ? loc.zip : loc.city || ''].filter(Boolean).join(', '); const lp = [loc.address, cityState].filter(Boolean); location = lp.join(', '); }
  let calDates;if(timeVal){const[hh,mm]=timeVal.split(':');const dEnd=new Date(r.reminder_date+'T'+timeVal+':00');dEnd.setHours(dEnd.getHours()+1);const endStr=r.reminder_date.replace(/-/g,'')+`T${String(dEnd.getHours()).padStart(2,'0')}${String(dEnd.getMinutes()).padStart(2,'0')}00`;calDates=ds+'T'+hh+mm+'00/'+endStr;}else{const dsNext=(()=>{const d=new Date(r.reminder_date+'T12:00:00');d.setDate(d.getDate()+1);return d.toISOString().slice(0,10).replace(/-/g,'');})();calDates=ds+'/'+dsNext;}
  const params = new URLSearchParams({ action:'TEMPLATE', text: name, dates:calDates, location, ctz:'America/New_York' });
  return 'https://calendar.google.com/calendar/render?' + params.toString();
}
function exportTaskToCalendar(logId) {
  const r = (_taskDetailLogs||{})[logId] || (window._taskDetailLogs||{})[logId];
  if (!r) return;
  const phys = r.provider_id ? physicians.find(p=>p.id===r.provider_id) : null;
  const loc = r.practice_location_id ? practiceLocations.find(l=>l.id===r.practice_location_id) : null;
  const practice = loc ? practices.find(p=>p.id===loc.practice_id) : null;
  const timeVal = ($('taskCalTime')||{}).value || '';
  downloadTaskICS(r, phys, loc, practice, timeVal);
}
function openGoogleCalendar(logId) {
  const r = (_taskDetailLogs||{})[logId] || (window._taskDetailLogs||{})[logId];
  if (!r) return;
  if (!r.reminder_date || r.reminder_date === '2099-12-31') { return; }
  const phys = r.provider_id ? physicians.find(p=>p.id===r.provider_id) : null;
  const loc = r.practice_location_id ? practiceLocations.find(l=>l.id===r.practice_location_id) : null;
  const practice = loc ? practices.find(p=>p.id===loc.practice_id) : null;
  const timeVal = ($('taskCalTime')||{}).value || '';
  window.open(buildGoogleCalendarUrl(r, phys, loc, practice, timeVal), '_blank');
}
function openTaskDetailModal(logId) {
const r = _taskDetailLogs[logId] || (window._taskDetailLogs||{})[logId];
if (!r) { db.from('contact_logs').select('*').eq('id',logId).single().then(({data})=>{if(data){_taskDetailLogs[logId]=data;if(!window._taskDetailLogs)window._taskDetailLogs={};window._taskDetailLogs[logId]=data;openTaskDetailModal(logId);}});return; }
const phys = r.provider_id ? physicians.find(p => p.id === r.provider_id) : null;
const loc = r.practice_location_id ? practiceLocations.find(l => l.id === r.practice_location_id) : null;
const practice = loc ? practices.find(p => p.id === loc.practice_id) : null;
const {noteTime,displayNotes,taskNote}=parseTaskRecord(r.notes);
const today = localDate();
const isOverdue = r.reminder_date && r.reminder_date !== '2099-12-31' && r.reminder_date < today;
const isOpen = r.reminder_date === '2099-12-31';
const isStaff = isStaffSpecialty(phys?.specialty);
const np = phys ? normPriority(phys.priority) : null;
const tierColors = {'1':'#ef4444','2':'#f97316','3':'#3b82f6','4':'#8b5cf6','5':'#64748b'};
let html = '';
if (phys) {
html += `<div style="padding:1rem;background:#eff6ff;border-radius:10px;margin-bottom:0.75rem;border:1px solid #dbeafe;">
<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;">
<div style="flex:1;">
<div style="font-size:1.15rem;font-weight:700;color:#1e3a8a;">${fmtName(phys)}</div>
${phys.specialty?`<div style="font-size:0.85rem;color:#555;margin-top:0.15rem;">${phys.specialty}${phys.academic_connection||phys.um_connection?' · '+(phys.academic_connection||phys.um_connection):''}</div>`:''}
${phys.email?`<div style="margin-top:0.3rem;"><a href="mailto:${phys.email}" onclick="event.stopPropagation()" style="color:#1e3a8a;font-size:0.875rem;">✉️ ${phys.email}</a></div>`:''}
</div>
<div style="flex-shrink:0;margin-top:0.15rem;">
${isStaff?'<span style="background:#0891b2;color:white;padding:0.2rem 0.55rem;border-radius:5px;font-size:0.78rem;font-weight:700;">Staff</span>':(np?`<span style="background:${tierColors[np]||'#64748b'};color:white;padding:0.2rem 0.55rem;border-radius:5px;font-size:0.82rem;font-weight:700;">P${np}</span>`:'')}
</div>
</div>
</div>`;
}
if (loc) {
html += `<div style="padding:1rem;background:#f9f9f9;border-radius:10px;margin-bottom:0.75rem;border:1px solid #e5e5e5;">
<div style="font-weight:600;color:#1e3a8a;font-size:0.95rem;margin-bottom:0.5rem;">${practice?.name || loc.label || 'Office'}</div>
<div class="location-details">${locDetails(loc)}</div>
</div>`;
}
html += `<div style="padding:1rem;background:#fff;border:1px solid #e5e5e5;border-radius:10px;margin-bottom:0.75rem;">
<div style="font-size:0.72rem;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.5rem;">${fmtD(r.contact_date)}${noteTime?' · '+noteTime:''}${r.author?' — '+r.author:''}</div>
${taskNote?`<div style="font-weight:700;color:#92400e;background:#fef3c7;padding:0.3rem 0.6rem;border-radius:6px;margin-bottom:0.5rem;font-size:0.9rem;">📋 ${taskNote}</div>`:''}
<div style="font-size:0.9rem;color:#333;line-height:1.5;white-space:pre-wrap;">${displayNotes}</div>
${r.reminder_date?`<div style="margin-top:0.6rem;padding:0.3rem 0.6rem;border-radius:6px;font-size:0.82rem;font-weight:600;${isOpen?'background:#e5e7eb;color:#6b7280;':isOverdue?'background:#fef2f2;color:#dc2626;':'background:#fef3c7;color:#92400e;'}">${isOpen?'📌 Open task — no due date':isOverdue?`⚠️ OVERDUE — Due ${fmtD(r.reminder_date)}`:`🔔 Due ${fmtD(r.reminder_date)}`}</div>`:''}
</div>`;
// Reschedule buttons — quick date change without opening the edit modal
const rAdd = (n) => { const d = new Date(today+'T12:00:00'); d.setDate(d.getDate()+n); return localDate(d); };
const dow = new Date(today+'T12:00:00').getDay();
const daysToNextMon = ((8-dow)%7)||7;
const rBtns = [{label:'Today',date:today},{label:'Tomw',date:rAdd(1)}];
for(let i=0;i<5;i++){const d=rAdd(daysToNextMon+i);const dn=new Date(d+'T12:00:00');rBtns.push({label:'Nxt '+dn.toLocaleDateString('en-US',{weekday:'short'}),date:d});}
rBtns.push({label:'2 wks',date:rAdd(14)},{label:'Open',date:'2099-12-31'});
html += `<div id="taskReschedulePanel" style="padding:0.75rem 1rem;background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;margin-bottom:0.75rem;">
<div style="font-size:0.72rem;color:#92400e;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.4rem;">📅 Reschedule</div>
<div style="display:flex;flex-wrap:wrap;gap:0.3rem;">${rBtns.map(b=>`<button type="button" onclick="rescheduleTask('${r.id}','${b.date}')" style="padding:0.4rem 0.65rem;font-size:0.8rem;border:1px solid ${r.reminder_date===b.date?'#d97706':'#fcd34d'};border-radius:6px;background:${r.reminder_date===b.date?'#f59e0b':'#fff'};color:${r.reminder_date===b.date?'#fff':'#92400e'};font-weight:${r.reminder_date===b.date?'700':'400'};cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation;">${b.label}</button>`).join('')}</div>
<div style="display:flex;align-items:center;gap:0.4rem;margin-top:0.4rem;"><span style="font-size:0.75rem;color:#92400e;white-space:nowrap;">Specific date:</span><input type="date" value="${r.reminder_date&&r.reminder_date!=='2099-12-31'?r.reminder_date:''}" onchange="if(this.value)rescheduleTask('${r.id}',this.value)" style="flex:1;padding:0.3rem 0.5rem;border:1px solid #fcd34d;border-radius:6px;font-size:0.85rem;font-family:inherit;background:#fff;color:#92400e;-webkit-appearance:none;"></div>
</div>`;
// Link-to section — only shown for General Reminders (no provider and no location)
if (!phys && !loc) {
html += `<div style="padding:0.75rem 1rem;background:#f0f9ff;border:1.5px dashed #93c5fd;border-radius:10px;margin-bottom:0.75rem;">
<div style="font-size:0.75rem;color:#1d4ed8;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.6rem;">🔗 Link to Provider or Practice</div>
<div style="position:relative;margin-bottom:0.35rem;">
<input type="text" id="tdLinkProviderSearch" placeholder="Search providers…" autocomplete="off" oninput="_tdFilterProviders('${r.id}')" style="width:100%;padding:0.6rem 0.75rem;font-size:0.875rem;border:1.5px solid #bfdbfe;border-radius:8px;box-sizing:border-box;font-family:inherit;background:white;">
<div id="tdLinkProviderResults" style="display:none;position:absolute;top:100%;left:0;right:0;background:white;border:1px solid #d1d5db;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.12);z-index:200;max-height:180px;overflow-y:auto;margin-top:2px;"></div>
</div>
<div style="text-align:center;font-size:0.75rem;color:#aaa;margin:0.25rem 0 0.35rem;">— or search by practice —</div>
<div style="position:relative;">
<input type="text" id="tdLinkPracticeSearch" placeholder="Search practices…" autocomplete="off" oninput="_tdFilterPractices('${r.id}')" style="width:100%;padding:0.6rem 0.75rem;font-size:0.875rem;border:1.5px solid #bfdbfe;border-radius:8px;box-sizing:border-box;font-family:inherit;background:white;">
<div id="tdLinkPracticeResults" style="display:none;position:absolute;top:100%;left:0;right:0;background:white;border:1px solid #d1d5db;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.12);z-index:200;max-height:180px;overflow-y:auto;margin-top:2px;"></div>
</div>
</div>`;
}
const completeFn = `event.stopPropagation();completeReminder('${r.id}').then(()=>{closeTaskDetailModal();renderTasksView();});`;
window._openedTaskRec = r;
const editFn = `closeTaskDetailModal();openEditTaskModal()`;
const delFn = r.provider_id ? `closeTaskDetailModal();deleteNoteFromActivity('${r.id}','${r.provider_id}').then(()=>{if(currentPhysician){loadContactLogs(currentPhysician.id).then(()=>renderProfile());}else if(currentPractice){renderPracticeProfile();}else{renderTasksView();}})` : r.practice_location_id ? `closeTaskDetailModal();deletePracticeNote('${r.id}').then(()=>{if(currentPractice){renderPracticeProfile();}else{renderTasksView();}})` : '';
const profileFn = phys ? `closeTaskDetailModal();setView('physicians');viewPhysician('${phys.id}')` : practice ? `closeTaskDetailModal();setView('practices');viewPractice('${practice.id}')` : '';
const profileLabel = phys ? '👤 View Full Profile' : '🏢 View Practice Profile';
html += `<div style="display:flex;flex-direction:column;gap:0.5rem;">
<button id="taskMarkCompleteBtn" onclick="${completeFn}" style="padding:0.75rem;background:#10b981;color:white;border:none;border-radius:8px;font-weight:700;font-size:0.95rem;cursor:pointer;-webkit-tap-highlight-color:transparent;">✓ Mark Complete</button>
<div style="display:flex;gap:0.5rem;">
<button onclick="${editFn}" style="flex:1;padding:0.7rem;background:#1e3a8a;color:white;border:none;border-radius:8px;font-weight:600;font-size:0.875rem;cursor:pointer;">✏️ Edit Note/Task</button>
${delFn?`<button onclick="${delFn}" style="flex:1;padding:0.7rem;background:#dc2626;color:white;border:none;border-radius:8px;font-weight:600;font-size:0.875rem;cursor:pointer;">🗑️ Delete</button>`:''}
</div>
${profileFn?`<button onclick="${profileFn}" style="padding:0.7rem;background:rgba(10,77,60,0.08);color:#1e3a8a;border:2px solid #1e3a8a;border-radius:8px;font-weight:600;font-size:0.875rem;cursor:pointer;">${profileLabel}</button>`:''}
${(!isOpen && r.reminder_date)?`<div><div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.4rem;"><span style="font-size:0.82rem;color:#555;min-width:5.5rem;font-weight:500;">Visit time</span><input type="time" id="taskCalTime" value="${noteTime||''}" style="flex:1;padding:0.4rem 0.6rem;border:1px solid #d1d5db;border-radius:6px;font-size:0.9rem;font-family:inherit;" aria-label="Calendar event time"><span style="font-size:0.72rem;color:#aaa;white-space:nowrap;">${noteTime?'':'optional'}</span></div><div style="display:flex;gap:0.5rem;"><button onclick="openGoogleCalendar('${r.id}')" style="flex:1;padding:0.7rem;background:rgba(59,130,246,0.08);color:#1d4ed8;border:2px solid #3b82f6;border-radius:8px;font-weight:600;font-size:0.875rem;cursor:pointer;-webkit-tap-highlight-color:transparent;">📅 Google Calendar</button><button onclick="exportTaskToCalendar('${r.id}')" style="padding:0.7rem 0.85rem;background:rgba(59,130,246,0.08);color:#1d4ed8;border:2px solid #3b82f6;border-radius:8px;font-weight:600;font-size:0.875rem;cursor:pointer;-webkit-tap-highlight-color:transparent;" title="Add to Apple Calendar / Outlook">🍎 Apple Cal</button></div></div>`:''}
</div>`;
$('taskDetailTitle').textContent = phys ? fmtName(phys) : (practice?.name || loc?.label || 'Task');
$('taskDetailBody').innerHTML = html;
$('taskDetailModal').classList.add('active');
// Tap outside modal to close (safety escape hatch)
$('taskDetailModal').onclick = function(e){ if(e.target===this) closeTaskDetailModal(); };
}
async function rescheduleTask(logId, newDate) {
const r = _taskDetailLogs[logId] || (window._taskDetailLogs||{})[logId];
if (!r) return;
try {
const {error} = await db.from('contact_logs').update({reminder_date: newDate}).eq('id', logId);
if (error) throw error;
const label = newDate==='2099-12-31'?'Open':new Date(newDate+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
showToast('Rescheduled to '+label,'success');
closeTaskDetailModal();
if(currentView==='activity') renderActivityTabView(); else renderTasksView();
} catch(e){ showToast('Error: '+e.message,'error'); }
}

// --- Link-task helpers (used by 🔗 section in task detail modal) ---
function _tdFilterProviders(logId) {
const q=($('tdLinkProviderSearch').value||'').toLowerCase().trim();
const res=$('tdLinkProviderResults');
if(!q){res.style.display='none';return;}
const matches=physicians.filter(p=>fmtName(p).toLowerCase().includes(q)||(p.specialty||'').toLowerCase().includes(q)).slice(0,8);
if(!matches.length){res.innerHTML='<div style="padding:0.5rem 0.75rem;font-size:0.85rem;color:#999;">No providers found</div>';res.style.display='block';return;}
res.innerHTML=matches.map(p=>`<div onclick="_linkTaskToProvider('${logId}','${p.id}')" style="padding:0.5rem 0.75rem;cursor:pointer;border-bottom:1px solid #f0f0f0;font-size:0.875rem;" onmouseover="this.style.background='#f0f9f4'" onmouseout="this.style.background=''"><span style="font-weight:600;">${fmtName(p)}</span>${p.specialty?`<span style="color:#888;font-size:0.8rem;"> · ${p.specialty}</span>`:''}</div>`).join('');
res.style.display='block';
}
function _tdFilterPractices(logId) {
const q=($('tdLinkPracticeSearch').value||'').toLowerCase().trim();
const res=$('tdLinkPracticeResults');
if(!q){res.style.display='none';return;}
const matches=practices.filter(p=>(p.name||'').toLowerCase().includes(q)).slice(0,8);
if(!matches.length){res.innerHTML='<div style="padding:0.5rem 0.75rem;font-size:0.85rem;color:#999;">No practices found</div>';res.style.display='block';return;}
res.innerHTML=matches.map(p=>{
const locs=practiceLocations.filter(l=>l.practice_id===p.id);
// Build a readable label for each location showing address so user can distinguish them
const locLabel=(l)=>{const parts=[];if(l.label&&l.label!==l.city)parts.push(l.label);if(l.address)parts.push(l.address);if(l.city)parts.push(l.city);return parts.join(' · ')||'Office';};
if(locs.length===1){const ll=locLabel(locs[0]);return `<div onclick="_linkTaskToLocation('${logId}','${locs[0].id}')" style="padding:0.5rem 0.75rem;cursor:pointer;border-bottom:1px solid #f0f0f0;font-size:0.875rem;" onmouseover="this.style.background='#f0f9f4'" onmouseout="this.style.background=''"><span style="font-weight:600;">${p.name}</span><span style="color:#888;font-size:0.8rem;"> · ${ll}</span></div>`;}
return `<div style="padding:0.5rem 0.75rem;border-bottom:1px solid #f0f0f0;font-size:0.875rem;"><div style="font-weight:600;margin-bottom:0.3rem;">${p.name}</div><div style="display:flex;flex-direction:column;gap:0.25rem;">${locs.map(l=>`<button onclick="_linkTaskToLocation('${logId}','${l.id}')" style="text-align:left;padding:0.3rem 0.6rem;font-size:0.78rem;border:1px solid #bfdbfe;border-radius:5px;background:#eff6ff;color:#1d4ed8;cursor:pointer;">${locLabel(l)}</button>`).join('')}</div></div>`;
}).join('');
res.style.display='block';
}
async function _linkTaskToProvider(logId, providerId) {
const {error}=await db.from('contact_logs').update({provider_id:providerId}).eq('id',logId);
if(error){showToast('Error: '+error.message,'error');return;}
const r=_taskDetailLogs[logId]||(window._taskDetailLogs||{})[logId];
if(r){r.provider_id=providerId;}
showToast('Task linked to provider','success');
closeTaskDetailModal();
openTaskDetailModal(logId);
if(currentView==='activity') renderActivityTabView(); else renderTasksView();
}
async function _linkTaskToLocation(logId, locationId) {
const {error}=await db.from('contact_logs').update({practice_location_id:locationId}).eq('id',logId);
if(error){showToast('Error: '+error.message,'error');return;}
const r=_taskDetailLogs[logId]||(window._taskDetailLogs||{})[logId];
if(r){r.practice_location_id=locationId;}
showToast('Task linked to practice location','success');
closeTaskDetailModal();
openTaskDetailModal(logId);
if(currentView==='activity') renderActivityTabView(); else renderTasksView();
}

// --- Shared task card renderer for Tasks view (overdue / upcoming / open sections) ---
function _renderTaskCard(r, barColor, bgColor, nameColor, statusLine, physMap) {
const phys = r.provider_id ? physMap[r.provider_id] : null;
const physName = phys ? fmtName(phys) : (r.practice_location_id ? getLocationLabel(r.practice_location_id) : 'General Reminder');
const emailLink = getPhysEmailLink(phys);
const phoneLink = getTaskPhoneLink(r);
const {displayNotes,taskNote} = parseTaskRecord(r.notes);
const preview = displayNotes.length > 120 ? displayNotes.substring(0,120)+'...' : displayNotes;
const editFn = `editTaskFromList('${r.id}')`;
const delFn = r.provider_id ? `deleteNoteFromActivity('${r.id}','${r.provider_id}').then(()=>renderTasksView())` : r.practice_location_id ? `deletePracticeNote('${r.id}').then(()=>renderTasksView())` : '';
const btnColor = barColor === '#dc2626' ? '#dc2626' : '#92400e';
return `<div class="contact-entry" id="tlog-${r.id}" style="border-left:4px solid ${barColor};background:${bgColor};display:flex;gap:0.5rem;align-items:flex-start;cursor:pointer;" onclick="openTaskDetailModal('${r.id}')"><button onclick="event.stopPropagation();completeReminderInPlace('${r.id}','tlog-${r.id}',()=>{})" title="Mark complete" style="background:none;border:2px solid ${barColor};color:${btnColor};border-radius:50%;width:24px;height:24px;min-width:24px;cursor:pointer;font-size:0.8rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:0.15rem;">✓</button><div style="flex:1;"><div style="font-weight:600;color:${nameColor};">${physName}${phoneLink}${emailLink}</div>${statusLine}${taskNote?`<div style="font-size:0.85rem;font-weight:600;color:#92400e;background:#fef3c7;padding:0.2rem 0.5rem;border-radius:4px;margin-top:0.25rem;">📋 ${taskNote}</div>`:''}<div style="font-size:0.85rem;color:#333;margin-top:0.2rem;">${preview}</div><div style="font-size:0.7rem;color:#999;margin-top:0.2rem;">Note from ${r.contact_date}${r.author?' by '+r.author:''}</div>${editFn||delFn?`<div style="display:flex;gap:0.5rem;margin-top:0.4rem;">${editFn?`<button class="icon-btn" onclick="event.stopPropagation();${editFn}" title="Edit note & reminder date" style="font-size:0.85rem;">✏️ Edit</button>`:''}${delFn?`<button class="icon-btn" onclick="event.stopPropagation();${delFn}" title="Delete" style="font-size:0.85rem;color:#dc2626;">🗑️ Delete</button>`:''}</div>`:''}</div></div>`;
}

// --- Activity tab view dispatcher (called by setView('activity') and switchActivityTab) ---
async function renderActivityTabView(){
if(activitySubTab==='tasks') await renderTasksView();
else if(activitySubTab==='activity') await renderActivityView();
else await renderHistoryView();
}

// --- History view: pure activity notes only (tasks have their own Tasks tab) ---
async function renderHistoryView(){
try{
const{data:allLogs,error}=await db.from('contact_logs').select('*').order('contact_date',{ascending:false}).order('created_at',{ascending:false}).limit(200);
if(error)throw error;
_knownAuthors=[...new Set((allLogs||[]).map(l=>l.author).filter(Boolean))].sort();
const physMap={};physicians.forEach(p=>physMap[p.id]=p);
// HISTORY: pure notes only (no reminder_date = not a task)
const pureNotes=allLogs.filter(l=>!l.reminder_date);
const today=localDate();
const search=_activitySearchTerm||$('searchInput').value.trim().toLowerCase();
const _hLocMap={};practiceLocations.forEach(l=>_hLocMap[l.id]=l);const _hPracMap={};practices.forEach(p=>_hPracMap[p.id]=p);
let filtered=search?pureNotes.filter(l=>{const p=physMap[l.provider_id]||{};const fullName=((p.first_name||'')+' '+(p.last_name||'')).trim();const loc=l.practice_location_id?_hLocMap[l.practice_location_id]:null;const pracName=loc?(_hPracMap[(loc.practice_id||'')]||{}).name||'':'';return(l.notes||'').toLowerCase().includes(search)||(l.author||'').toLowerCase().includes(search)||(l.contact_date||'').includes(search)||fullName.toLowerCase().includes(search)||(loc&&(loc.city||'').toLowerCase().includes(search))||(loc&&(loc.address||'').toLowerCase().includes(search))||(loc&&(loc.label||'').toLowerCase().includes(search))||pracName.toLowerCase().includes(search);}):pureNotes;
if(_activityAuthorFilter)filtered=filtered.filter(l=>(l.author||'').toLowerCase()===_activityAuthorFilter.toLowerCase());
// Update sidebar
$('physicianList').innerHTML=filtered.length===0?'<li class="loading">No notes found</li>':filtered.map(l=>{const p=l.provider_id?physMap[l.provider_id]:null;const nameDisplay=p?`${p.first_name||''} ${p.last_name||''}`.trim():(l.practice_location_id?getLocationLabel(l.practice_location_id):'Note');let notes=l.notes||'';const tm=notes.match(/^\[(\d{1,2}:\d{2})\]\s*/);if(tm)notes=notes.slice(tm[0].length);const preview=notes.length>80?notes.slice(0,80)+'...':notes;const clickFn=l.provider_id?`viewPhysician('${l.provider_id}')`:l.practice_location_id?`viewLocation('${l.practice_location_id}')`:''
return`<li class="physician-item" onclick="${clickFn}"><div class="name">${nameDisplay}</div><div class="practice">${l.contact_date}${l.author?' - '+l.author:''}</div><div style="font-size:0.75rem;color:rgba(255,255,255,0.75);margin-top:0.25rem;">${preview}</div></li>`;}).join('');
$('physicianCount').textContent=filtered.length+' of '+pureNotes.length+' activity note'+(pureNotes.length!==1?'s':'');
// Main content
const addBtn=`<button onclick="openContactModal()" style="padding:0.4rem 0.9rem;background:#1e3a8a;color:white;border:none;border-radius:6px;font-size:0.85rem;font-weight:600;cursor:pointer;">+ Add Activity</button>`;
let html=_activityTabsHtml()+`<div class="section"><div class="section-header"><h3>History</h3><div style="display:flex;align-items:center;gap:0.75rem;"><div style="font-size:0.8rem;color:#666;">${filtered.length} entries${search?' matching "'+search+'"':''}</div>${addBtn}</div></div>`;
if(filtered.length===0){html+='<div class="empty-notice">No entries found.</div>';}else{
html+='<div class="contact-entries">'+filtered.map(e=>{const phys=e.provider_id?physMap[e.provider_id]:null;const editFn=e.provider_id?`editNoteFromActivity('${e.id}','${e.provider_id}')`:e.practice_location_id?`editPracticeNote('${e.id}')`:''
const physName=phys?fmtName(phys):(e.practice_location_id?getLocationLabel(e.practice_location_id):'Note');const locCtx=e.practice_location_id?getLocationContext(e.practice_location_id):'';const{time,text}=parseNoteTime(e.notes);const preview=text.length>120?text.slice(0,120)+'...':text;
const emailLinkH=getPhysEmailLink(phys);const phoneLinkH=getTaskPhoneLink(e);
const delFn=e.provider_id?`deleteNoteFromActivity('${e.id}','${e.provider_id}').then(()=>renderHistoryView())`:e.practice_location_id?`deletePracticeNote('${e.id}').then(()=>renderHistoryView())`:''
const clickFn=e.provider_id?`viewPhysician('${e.provider_id}')`:e.practice_location_id?`viewLocation('${e.practice_location_id}')`:''
return`<div class="contact-entry" id="hlog-${e.id}" style="border-left:4px solid #1e3a8a;cursor:pointer;" onclick="${clickFn}"><div style="flex:1;"><div style="font-weight:600;color:#1e3a8a;">${physName}${phoneLinkH}${emailLinkH}</div>${locCtx?`<div style="font-size:0.75rem;color:#666;margin-top:0.1rem;">${locCtx}</div>`:''}<div style="font-size:0.85rem;color:#333;margin-top:0.2rem;">${preview}</div><div style="font-size:0.7rem;color:#999;margin-top:0.2rem;">${e.contact_date}${time?' · '+time.trim():''}${e.author?' by '+e.author:''}</div>${editFn||delFn?`<div style="display:flex;gap:0.5rem;margin-top:0.4rem;">${editFn?`<button class="icon-btn" onclick="event.stopPropagation();${editFn}" style="font-size:0.85rem;">✏️ Edit</button>`:''}${delFn?`<button class="icon-btn" onclick="event.stopPropagation();${delFn}" style="font-size:0.85rem;color:#dc2626;">🗑️ Delete</button>`:''}</div>`:''}</div></div>`}).join('')+'</div>';}
html+='</div>';
$('mainContent').innerHTML=html;
}catch(e){console.error('History view error:',e);$('mainContent').innerHTML='<div class="empty-state"><h2>History</h2><p>Error loading. Try again.</p></div>';}
}

// --- Activity view (pure notes only, no tasks) ---
async function renderActivityView(){
try{
const{data:allLogs,error}=await db.from('contact_logs').select('*').order('contact_date',{ascending:false}).order('created_at',{ascending:false}).limit(200);
if(error)throw error;
_knownAuthors=[...new Set((allLogs||[]).map(l=>l.author).filter(Boolean))].sort();
const physMap={};physicians.forEach(p=>physMap[p.id]=p);
// ACTIVITY tab shows only pure notes (no tasks — exclude records with reminder_date)
const pureNotes=allLogs.filter(l=>!l.reminder_date);
const search=_activitySearchTerm||$('searchInput').value.trim().toLowerCase();
const _aLocMap={};practiceLocations.forEach(l=>_aLocMap[l.id]=l);const _aPracMap={};practices.forEach(p=>_aPracMap[p.id]=p);
let filtered=search?pureNotes.filter(l=>{const p=physMap[l.provider_id]||{};const fullName=((p.first_name||'')+' '+(p.last_name||'')).trim();const loc=l.practice_location_id?_aLocMap[l.practice_location_id]:null;const pracName=loc?(_aPracMap[(loc.practice_id||'')]||{}).name||'':'';return(l.notes||'').toLowerCase().includes(search)||(l.author||'').toLowerCase().includes(search)||(l.contact_date||'').includes(search)||fullName.toLowerCase().includes(search)||(loc&&(loc.city||'').toLowerCase().includes(search))||(loc&&(loc.address||'').toLowerCase().includes(search))||(loc&&(loc.label||'').toLowerCase().includes(search))||pracName.toLowerCase().includes(search);}):pureNotes;
if(_activityAuthorFilter)filtered=filtered.filter(l=>(l.author||'').toLowerCase()===_activityAuthorFilter.toLowerCase());
$('physicianList').innerHTML=filtered.length===0?'<li class="loading">No activity found</li>':
filtered.map(l=>{const p=l.provider_id?physMap[l.provider_id]:null;
let time=l.contact_time||'';let notes=l.notes||'';
if(!time&&notes.startsWith('[')){const m=notes.match(/^\[(\d{1,2}:\d{2})\]\s*/);if(m){time=m[1];notes=notes.slice(m[0].length);}}
const preview=notes.length>120?notes.slice(0,120)+'...':notes;
const nameDisplay=p?`${p.first_name||''} ${p.last_name||''}`.trim():(l.practice_location_id?getLocationLabel(l.practice_location_id):'General Reminder');
const clickFn=l.provider_id?`viewPhysician('${l.provider_id}')`:l.practice_location_id?`viewLocation('${l.practice_location_id}')`:''
return`<li class="physician-item" onclick="${clickFn}">
<div class="name">${nameDisplay}</div>
<div class="practice">${l.contact_date}${time?' '+time:''}${l.author?' - '+l.author:''}</div>
<div style="font-size:0.75rem;color:rgba(255,255,255,0.75);margin-top:0.25rem;">${preview}</div>
</li>`;}).join('');
$('physicianCount').textContent=filtered.length+' of '+pureNotes.length+' activities';
const addBtn=`<button onclick="openContactModal()" style="padding:0.4rem 0.9rem;background:#1e3a8a;color:white;border:none;border-radius:6px;font-size:0.85rem;font-weight:600;cursor:pointer;">+ Add Activity</button>`;
$('mainContent').innerHTML=_activityTabsHtml()+`<div class="section"><div class="section-header"><h3>Activity Log</h3><div style="display:flex;align-items:center;gap:0.75rem;"><div style="font-size:0.8rem;color:#666;">${filtered.length} entries${search?' matching "'+search+'"':''}</div>${addBtn}</div></div>
${filtered.length===0?'<div class="empty-notice">No activity found.</div>':
'<div class="contact-entries">'+filtered.map(e=>{const phys=e.provider_id?physMap[e.provider_id]:null;const physName=phys?fmtName(phys):(e.practice_location_id?getLocationLabel(e.practice_location_id):'Note');const locCtx=e.practice_location_id?getLocationContext(e.practice_location_id):'';const{time,text}=parseNoteTime(e.notes);const preview=text.length>120?text.slice(0,120)+'...':text;const emailLink=getPhysEmailLink(phys);const phoneLink=getTaskPhoneLink(e);const editFn=e.provider_id?`editNoteFromActivity('${e.id}','${e.provider_id}')`:e.practice_location_id?`editPracticeNote('${e.id}')`:''
const delFn=e.provider_id?`deleteNoteFromActivity('${e.id}','${e.provider_id}').then(()=>renderActivityView())`:e.practice_location_id?`deletePracticeNote('${e.id}').then(()=>renderActivityView())`:''
const clickFn=e.provider_id?`viewPhysician('${e.provider_id}')`:e.practice_location_id?`viewLocation('${e.practice_location_id}')`:''
return`<div class="contact-entry" style="border-left:4px solid #1e3a8a;cursor:pointer;" onclick="${clickFn}"><div style="flex:1;"><div style="font-weight:600;color:#1e3a8a;">${physName}${phoneLink}${emailLink}</div>${locCtx?`<div style="font-size:0.75rem;color:#666;margin-top:0.1rem;">${locCtx}</div>`:''}<div style="font-size:0.85rem;color:#333;margin-top:0.2rem;">${preview}</div><div style="font-size:0.7rem;color:#999;margin-top:0.2rem;">${e.contact_date}${time?' · '+time.trim():''}${e.author?' by '+e.author:''}</div>${editFn||delFn?`<div style="display:flex;gap:0.5rem;margin-top:0.4rem;">${editFn?`<button class="icon-btn" onclick="event.stopPropagation();${editFn}" style="font-size:0.85rem;">✏️ Edit</button>`:''}${delFn?`<button class="icon-btn" onclick="event.stopPropagation();${delFn}" style="font-size:0.85rem;color:#dc2626;">🗑️ Delete</button>`:''}</div>`:''}</div></div>`;}).join('')+'</div>'}
</div>`;
}catch(e){console.error('Activity view error:',e);$('physicianList').innerHTML='<li class="loading">Error loading activity</li>';$('mainContent').innerHTML='<div class="empty-state"><h2>Activity</h2><p>Error loading. Try again.</p></div>';}
}

// --- Tasks view ---
async function renderTasksView(){
$('physicianCount').textContent='Tasks & Reminders';
$('physicianList').innerHTML='';
const today = localDate();
try {
const{data:allReminders,error}=await db.from('contact_logs').select('*').not('reminder_date','is',null).order('reminder_date',{ascending:true});
const reminders=(allReminders||[]).filter(r=>r.reminder_date!=='2000-01-01');
const completedTasks=(allReminders||[]).filter(r=>r.reminder_date==='2000-01-01').sort((a,b)=>b.contact_date.localeCompare(a.contact_date));
if(error)throw error;
const physMap={};physicians.forEach(p=>physMap[p.id]=p);
_taskDetailLogs={};[...reminders,...completedTasks].forEach(r=>_taskDetailLogs[r.id]=r);
const newTaskBtn=`<button onclick="openAddTaskModal(null,null)" style="padding:0.4rem 0.9rem;background:#1e3a8a;color:white;border:none;border-radius:6px;font-size:0.85rem;font-weight:600;cursor:pointer;">+ New Task</button>`;
const tabsPrefix=currentView==='activity'?_activityTabsHtml():'';
if(!reminders||reminders.length===0){
if(completedTasks.length===0){$('mainContent').innerHTML=tabsPrefix+`<div class="section"><div class="section-header"><h3>Tasks &amp; Reminders</h3>${newTaskBtn}</div><div class="empty-notice">No tasks yet. Use the button above to create one.</div></div>`;return;}
// No active tasks but completed ones exist — fall through to show completed section
}
const search=_activitySearchTerm||$('searchInput').value.trim().toLowerCase();
function _taskMatches(r){const ph=physMap[r.provider_id]||{};const fullName=((ph.first_name||'')+' '+(ph.last_name||'')).trim();const locLabel=r.practice_location_id?getLocationLabel(r.practice_location_id).toLowerCase():'';return(r.notes||'').toLowerCase().includes(search)||(r.author||'').toLowerCase().includes(search)||fullName.toLowerCase().includes(search)||(ph.first_name||'').toLowerCase().includes(search)||(ph.last_name||'').toLowerCase().includes(search)||locLabel.includes(search);}
let filtered=search?reminders.filter(_taskMatches):reminders;
let filteredCompleted=search?completedTasks.filter(_taskMatches):completedTasks;
if(_activityAuthorFilter){filtered=filtered.filter(l=>(l.author||'').toLowerCase()===_activityAuthorFilter.toLowerCase());filteredCompleted=filteredCompleted.filter(l=>(l.author||'').toLowerCase()===_activityAuthorFilter.toLowerCase());}
if(search&&filtered.length===0&&filteredCompleted.length===0){$('mainContent').innerHTML=tabsPrefix+`<div class="section"><div class="section-header"><h3>Tasks &amp; Reminders</h3>${newTaskBtn}</div><div class="empty-notice">No tasks matching "${search}".</div></div>`;return;}
const OPEN_DATE='2099-12-31';
const openTasks=filtered.filter(r=>r.reminder_date===OPEN_DATE);
const datedR=filtered.filter(r=>r.reminder_date!==OPEN_DATE);
const overdue=datedR.filter(r=>r.reminder_date<today);
const upcoming=datedR.filter(r=>r.reminder_date>=today);
let html=tabsPrefix+`<div class="section"><div class="section-header"><h3>Tasks &amp; Reminders</h3><div style="display:flex;align-items:center;gap:0.75rem;"><div style="font-size:0.8rem;color:#666;">${reminders.length===0?'All caught up!':search?`${filtered.length} of ${reminders.length} matching "${search}"`:reminders.length+' active'}${overdue.length>0?` — <span style="color:#dc2626;font-weight:600;">${overdue.length} overdue</span>`:''}${openTasks.length>0?` — ${openTasks.length} open`:''}</div>${newTaskBtn}</div></div>`;
if(overdue.length>0){
html+=`<div style="margin-bottom:1rem;"><div style="font-size:0.75rem;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.5rem;padding-bottom:0.25rem;border-bottom:2px solid #fca5a5;display:flex;justify-content:space-between;align-items:center;cursor:pointer;user-select:none;" onclick="toggleTaskSection('overdue')">⚠️ Overdue (${overdue.length})<span id="tsc-caret-overdue" style="font-size:1rem;">▼</span></div><div id="tsc-overdue" class="contact-entries" style="${_taskSectionsState['overdue']?'display:none':''}">`;
overdue.forEach(r=>{
const statusLine=`<div data-task-status style="font-size:0.75rem;color:#dc2626;font-weight:600;">Due ${r.reminder_date} — OVERDUE</div>`;
html+=_renderTaskCard(r,'#dc2626','#fff5f5','#dc2626',statusLine,physMap);
});
html+='</div></div>';
}
if(upcoming.length>0){
const byDate={};upcoming.forEach(r=>{if(!byDate[r.reminder_date])byDate[r.reminder_date]=[];byDate[r.reminder_date].push(r);});
Object.entries(byDate).forEach(([date,dayR])=>{
const d=new Date(date+'T12:00:00');const label=d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
const isToday=date===today;const secId='date-'+date;
html+=`<div style="margin-bottom:0.75rem;"><div style="font-size:0.75rem;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.5rem;padding-bottom:0.25rem;border-bottom:2px solid #fcd34d;display:flex;justify-content:space-between;align-items:center;cursor:pointer;user-select:none;" onclick="toggleTaskSection('${secId}')">${isToday?'📅 TODAY — ':''}${label}<span id="tsc-caret-${secId}" style="font-size:1rem;">▼</span></div><div id="tsc-${secId}" class="contact-entries" style="${_taskSectionsState[secId]?'display:none':''}">`;
dayR.forEach(r=>{
html+=_renderTaskCard(r,'#f59e0b','#fffbeb','#1e3a8a','',physMap);
});
html+='</div></div>';
});
}
if(openTasks.length>0){
html+=`<div style="margin-bottom:0.75rem;"><div style="font-size:0.75rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.5rem;padding-bottom:0.25rem;border-bottom:2px solid #d1d5db;display:flex;justify-content:space-between;align-items:center;cursor:pointer;user-select:none;" onclick="toggleTaskSection('open')">📌 Open Tasks — no due date (${openTasks.length})<span id="tsc-caret-open" style="font-size:1rem;">▼</span></div><div id="tsc-open" class="contact-entries" style="${_taskSectionsState['open']?'display:none':''}">`;
openTasks.forEach(r=>{
html+=_renderTaskCard(r,'#f59e0b','#fffbeb','#1e3a8a','',physMap);
});
html+='</div></div>';
}
if(filteredCompleted.length>0){
const showCount=20;const shown=filteredCompleted.slice(0,showCount);
html+=`<div style="margin-bottom:0.75rem;"><div style="font-size:0.75rem;font-weight:700;color:#10b981;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.5rem;padding-bottom:0.25rem;border-bottom:2px solid #a7f3d0;display:flex;justify-content:space-between;align-items:center;cursor:pointer;user-select:none;" onclick="toggleTaskSection('completed')">✓ Recently Completed (${filteredCompleted.length}${filteredCompleted.length>showCount?' — showing '+showCount:''})<span id="tsc-caret-completed" style="font-size:1rem;">▼</span></div><div id="tsc-completed" class="contact-entries" style="${_taskSectionsState['completed']?'display:none':''}">`;
shown.forEach(r=>{
const phys=r.provider_id?physMap[r.provider_id]:null;const physName=phys?fmtName(phys):(r.practice_location_id?getLocationLabel(r.practice_location_id):'Note');
const {displayNotes}=parseTaskRecord(r.notes);
const preview=displayNotes.length>100?displayNotes.substring(0,100)+'...':displayNotes;
const delFn=r.provider_id?`deleteNoteFromActivity('${r.id}','${r.provider_id}').then(()=>renderTasksView())`:r.practice_location_id?`deletePracticeNote('${r.id}').then(()=>renderTasksView())`:''
html+=`<div class="contact-entry" style="border-left:4px solid #10b981;background:#f0fdf4;opacity:0.85;display:flex;gap:0.5rem;align-items:flex-start;"><div style="width:24px;height:24px;min-width:24px;border-radius:50%;background:#10b981;color:white;display:flex;align-items:center;justify-content:center;font-size:0.8rem;flex-shrink:0;margin-top:0.15rem;">✓</div><div style="flex:1;"><div style="font-weight:600;color:#065f46;">${physName}</div><div style="font-size:0.85rem;color:#333;margin-top:0.1rem;">${preview}</div><div style="font-size:0.7rem;color:#999;margin-top:0.2rem;">Logged ${r.contact_date}${r.author?' by '+r.author:''}</div>${delFn?`<button class="icon-btn" onclick="${delFn}" style="font-size:0.8rem;color:#dc2626;margin-top:0.25rem;">🗑️ Delete</button>`:''}</div></div>`;
});
html+='</div></div>';
}
html+='</div>';
$('mainContent').innerHTML=html;
}catch(e){console.error('Tasks view error:',e);const tabsPrefix=currentView==='activity'?_activityTabsHtml():'';$('mainContent').innerHTML=tabsPrefix+'<div class="section"><div class="section-header"><h3>Tasks</h3></div><div class="empty-notice">Error loading tasks</div></div>';}
}

// --- Optimistic task completion: update card in place without full re-render ---
async function completeReminderInPlace(logId, cardId, reloadFn) {
try {
updateSyncIndicators('syncing');
const {error} = await db.from('contact_logs').update({reminder_date:'2000-01-01'}).eq('id',logId);
if(error)throw error;
showToast('Task marked complete ✓','success');
updateSyncIndicators('synced');
// Update the card visually in place
const card=document.getElementById(cardId);
if(card){
card.style.borderLeftColor='#10b981';
card.style.background='#f0fdf4';
card.style.opacity='0.9';
const btn=card.querySelector('button');
if(btn){btn.outerHTML=`<div style="width:24px;height:24px;min-width:24px;border-radius:50%;background:#10b981;color:white;display:flex;align-items:center;justify-content:center;font-size:0.8rem;flex-shrink:0;margin-top:0.15rem;">✓</div>`;}
const statusEl=card.querySelector('[data-status]')||card.querySelector('[data-task-status]');
if(statusEl){statusEl.textContent='✓ Done';statusEl.style.color='#065f46';}
const nameEl=card.querySelector('div[style*="font-weight:600"]');
if(nameEl&&!nameEl.style.textDecoration)nameEl.style.textDecoration='line-through';
}
if(typeof reloadFn==='function')reloadFn();
}catch(e){showToast('Error: '+e.message,'error');updateSyncIndicators('error');}
}

// --- Dashboard view ---
async function renderDashboard(){
const{data:allLogs,error}=await db.from('contact_logs').select('*').order('contact_date',{ascending:false});
const logs=allLogs||[];
const now=new Date();const today=localDate(now);
const weekAgo=localDate(new Date(now-7*86400000));
const monthAgo=localDate(new Date(now-30*86400000));
const thisWeek=logs.filter(l=>l.contact_date>=weekAgo).length;
const thisMonth=logs.filter(l=>l.contact_date>=monthAgo).length;
const tierCounts={};physicians.forEach(p=>{const t=p.priority||'Unset';tierCounts[t]=(tierCounts[t]||0)+1;});
const tierHTML=Object.entries(tierCounts).sort((a,b)=>a[0].localeCompare(b[0])).map(([t,c])=>`<div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid #f0f0f0;"><span>${t==='Unset'?'Unset':'P'+t}</span><strong>${c}</strong></div>`).join('');
const specCounts={};physicians.forEach(p=>{const s=p.specialty||'Unset';specCounts[s]=(specCounts[s]||0)+1;});
const specHTML=Object.entries(specCounts).sort((a,b)=>b[1]-a[1]).map(([s,c])=>`<div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid #f0f0f0;"><span>${s}</span><strong>${c}</strong></div>`).join('');
const cityCounts={};physicians.forEach(p=>{const loc=getPrimaryLoc(p.id);const c=loc.city||'Unknown';cityCounts[c]=(cityCounts[c]||0)+1;});
const cityHTML=Object.entries(cityCounts).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([c,n])=>`<div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid #f0f0f0;"><span>${c}</span><strong>${n}</strong></div>`).join('');
const contactCounts={};logs.forEach(l=>{contactCounts[l.provider_id]=(contactCounts[l.provider_id]||0)+1;});
const physMap={};physicians.forEach(p=>physMap[p.id]=p);
const mostContacted=Object.entries(contactCounts).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([id,c])=>{const p=physMap[id];return p?`<div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid #f0f0f0;cursor:pointer;" onclick="setView('physicians');viewPhysician('${id}')"><span>${p.first_name} ${p.last_name}</span><strong>${c}</strong></div>`:'';}).join('');
const contacted=new Set(logs.map(l=>l.provider_id));
const neverContacted=physicians.filter(p=>!contacted.has(p.id));
const neverHTML=neverContacted.slice(0,10).map(p=>`<div style="padding:0.5rem 0;border-bottom:1px solid #f0f0f0;cursor:pointer;" onclick="setView('physicians');viewPhysician('${p.id}')">${p.first_name} ${p.last_name} <span style="font-size:0.75rem;color:#999;">${p.priority?'P'+p.priority:'No priority'}</span></div>`).join('');
const card=(title,content)=>`<div style="background:white;padding:1.25rem;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);"><h4 style="color:#1e3a8a;margin-bottom:0.75rem;font-size:1rem;">${title}</h4>${content}</div>`;
const stat=(label,val,color)=>`<div style="background:white;padding:1.25rem;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);text-align:center;"><div style="font-size:2rem;font-weight:700;color:${color||'#1e3a8a'};">${val}</div><div style="font-size:0.75rem;color:#999;margin-top:0.25rem;">${label}</div></div>`;
$('mainContent').innerHTML=`
<div style="margin-bottom:1rem;"><h2 style="color:#1e3a8a;font-size:1.5rem;">Territory Dashboard</h2></div>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:0.75rem;margin-bottom:1rem;">
${stat('Providers',physicians.length)}
${stat('Practices',practices.length)}
${stat('Locations',practiceLocations.length)}
${stat('Total Contacts',logs.length)}
${stat('This Week',thisWeek,'#f97316')}
${stat('This Month',thisMonth,'#0ea5e9')}
</div>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:0.75rem;">
${card('By Tier',tierHTML)}
${card('By Specialty',specHTML)}
${card('By City (Top 15)',cityHTML)}
${card('Most Contacted',mostContacted)}
${card('Never Contacted ('+neverContacted.length+')',neverHTML||'<div style="color:#10b981;padding:0.5rem 0;">All physicians contacted!</div>')}
</div>`;
$('physicianCount').textContent='Territory Dashboard';
}

// --- Map view ---
let territoryMap=null;
const geocodeCache=(function(){try{const c=JSON.parse(localStorage.getItem('geocodeCache')||'{}');// v3: wipe zip-only cache entries so they re-geocode with full address strategy
const v=localStorage.getItem('geocodeCacheV')||'1';if(v!=='4'){localStorage.removeItem('geocodeCache');localStorage.setItem('geocodeCacheV','4');return {};}return c;}catch(e){return {};}})();
function saveGeocodeCache(){try{localStorage.setItem('geocodeCache',JSON.stringify(geocodeCache));}catch(e){}}
let territoryMapCache=null;
let _mapBuiltMarkers=[]; // module-level so locateOnMap() always has access even mid-geocoding
function getMapDataVersion(){return practiceLocations.length+'_'+physicians.length+'_'+Object.keys(physicianAssignments).length+'_links';}
function getPracticeIcon(){return L.divIcon({className:'',html:'<div style="width:14px;height:14px;background:#1e3a8a;border:2.5px solid white;border-radius:50%;box-shadow:0 2px 5px rgba(0,0,0,0.4);"></div>',iconSize:[14,14],iconAnchor:[7,7]});}
function buildMarkerPopup(loc,practiceName,assignedPhys,addr){
const physLinks=(assignedPhys||[]).map(p=>`<a href="#" onclick="territoryMap&&territoryMap.closePopup();setView('physicians');viewPhysician('${p.id}');return false;" style="color:#1e3a8a;font-weight:600;text-decoration:none;">${fmtName(p)}</a>`).join('<br>');
const practiceLink=loc.practice_id?`<a href="#" onclick="territoryMap&&territoryMap.closePopup();setView('practices');viewPractice('${loc.practice_id}');return false;" style="display:inline-block;margin-bottom:0.3rem;color:white;background:#1e3a8a;padding:0.25rem 0.6rem;border-radius:5px;font-weight:700;font-size:0.82rem;text-decoration:none;">📋 View Profile</a><br>`:'';
return '<strong>'+(practiceName||loc.label||'Office')+'</strong><br>'
+addr+'<br>'
+(physLinks?'<span style="font-size:0.88em;">'+physLinks+'</span><br>':'')
+practiceLink
+'<a href="https://maps.apple.com/?q='+encodeURIComponent(addr)+'" target="_blank" style="color:#1e3a8a;font-size:0.82rem;">Get Directions</a>';
}
async function renderMapView(){
const search=($('searchInput').value||'').toLowerCase().trim();
$('mainContent').innerHTML='<div style="height:calc(100vh - 2rem);"><div id="mapContainer" style="height:100%;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);"></div></div>';
if(territoryMap){territoryMap.remove();territoryMap=null;}
_mapBuiltMarkers=[];
territoryMap=L.map('mapContainer',{tap:false}).setView([39.65,-104.95],10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:19}).addTo(territoryMap);
setTimeout(()=>{if(territoryMap)territoryMap.invalidateSize();},200);
const LocBtn=L.Control.extend({options:{position:'topright'},onAdd:function(){const b=L.DomUtil.create('button');b.innerHTML='📍 My Location';b.style.cssText='background:white;border:2px solid #1e3a8a;color:#1e3a8a;padding:0.5rem 0.75rem;border-radius:8px;font-size:0.85rem;font-weight:600;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,0.2);white-space:nowrap;';L.DomEvent.on(b,'click',L.DomEvent.stopPropagation);L.DomEvent.on(b,'click',locateOnMap);return b;}});new LocBtn().addTo(territoryMap);
territoryMap.on('locationerror',()=>showToast('Location access denied or unavailable','error'));
const version=getMapDataVersion();
if(!search&&territoryMapCache&&territoryMapCache.version===version){
_mapBuiltMarkers=territoryMapCache.markers;
territoryMapCache.markers.forEach(m=>{L.marker([m.lat,m.lng],{icon:getPracticeIcon()}).addTo(territoryMap).bindPopup(m.popup);});
$('physicianCount').textContent='Territory Map ('+territoryMapCache.markers.length+' locations)';
if(territoryMapCache.bounds.length>1)territoryMap.fitBounds(territoryMapCache.bounds,{padding:[30,30]});
else if(territoryMapCache.bounds.length===1)territoryMap.setView(territoryMapCache.bounds[0],15);
return;
}
const filteredLocIds=new Set();
if(search){
const filteredPhys=getFilteredPhysicians(search);
filteredPhys.forEach(p=>{(physicianAssignments[p.id]||[]).forEach(a=>{if(a.practice_location_id)filteredLocIds.add(a.practice_location_id);});});
practiceLocations.filter(l=>l.address&&(l.city||l.zip)).forEach(l=>{
const pracName=practices.find(pr=>pr.id===l.practice_id)?.name||'';
if([l.address,l.city,l.zip,l.phone,l.fax,l.label,pracName].some(v=>(v||'').toLowerCase().includes(search)))filteredLocIds.add(l.id);
});
}
const locs=practiceLocations.filter(l=>l.address&&(l.city||l.zip)&&(!search||filteredLocIds.has(l.id)));
if(search&&territoryMapCache&&territoryMapCache.version===version){
const subset=territoryMapCache.markers.filter(m=>filteredLocIds.has(m.locId));
_mapBuiltMarkers=subset;
const bounds=[];
subset.forEach(m=>{L.marker([m.lat,m.lng],{icon:getPracticeIcon()}).addTo(territoryMap).bindPopup(m.popup);bounds.push([m.lat,m.lng]);});
$('physicianCount').textContent='Map: "'+search+'" ('+subset.length+' locations)';
if(bounds.length>1)territoryMap.fitBounds(bounds,{padding:[30,30]});
else if(bounds.length===1)territoryMap.setView(bounds[0],15);
return;
}
// Visible banner — centered, green pill, stays until done
const statusEl=document.createElement('div');
statusEl.style.cssText='position:absolute;bottom:16px;left:50%;transform:translateX(-50%);z-index:1000;background:#1e3a8a;color:white;padding:0.55rem 1.1rem;border-radius:20px;font-size:0.82rem;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,0.35);white-space:nowrap;pointer-events:none;';
document.getElementById('mapContainer').appendChild(statusEl);
if(locs.length===0){
statusEl.textContent='No locations with address data — check DB';
$('physicianCount').textContent=search?'Map: "'+search+'" (0 locations)':'Territory Map (0 locations — no address data)';
return;
}
const uncachedCount=locs.filter(l=>!geocodeCache[l.address+', '+l.city+(l.zip?', '+l.zip:'')]).length;
statusEl.textContent=uncachedCount?'Geocoding '+uncachedCount+' new locations… ('+locs.length+' total)':'Loading '+locs.length+' locations…';
$('physicianCount').textContent='Territory Map (loading '+locs.length+'…)';
const bounds=[];
let plotted=0,failed=0;
for(const loc of locs){
const addr=loc.address+', '+loc.city+(loc.zip?', '+loc.zip:'');
const practiceName=loc.practices?.name||practices.find(p=>p.id===loc.practice_id)?.name||'';
const assignedPhys=physicians.filter(p=>(physicianAssignments[p.id]||[]).some(a=>a.practice_location_id===loc.id));
try{
let coords=geocodeCache[addr];
if(!coords){
let d=null;
if(loc.address&&(loc.city||loc.zip)){
const baseStreet=(loc.address||'').replace(/\s*(#\S+|ste\.?\s*\S+|suite\s*\S+|unit\s*\S+|apt\.?\s*\S+)$/i,'').trim();
const r=await fetch('https://nominatim.openstreetmap.org/search?format=json&street='+encodeURIComponent(baseStreet)+'&city='+encodeURIComponent(loc.city||'')+'&postalcode='+encodeURIComponent(loc.zip||'')+'&countrycodes=us&limit=1');
d=await r.json();
}
if(!d||!d[0]){
const zipQuery=(loc.zip?loc.zip:(loc.city||'')).trim();
const r2=await fetch('https://nominatim.openstreetmap.org/search?format=json&q='+encodeURIComponent(zipQuery)+'&countrycodes=us&limit=1');
d=await r2.json();
}
if(d&&d[0]){coords={lat:parseFloat(d[0].lat),lng:parseFloat(d[0].lon)};geocodeCache[addr]=coords;saveGeocodeCache();}
await new Promise(ok=>setTimeout(ok,300));
}
if(coords){
const popup=buildMarkerPopup(loc,practiceName,assignedPhys,addr);
L.marker([coords.lat,coords.lng],{icon:getPracticeIcon()}).addTo(territoryMap).bindPopup(popup);
bounds.push([coords.lat,coords.lng]);
_mapBuiltMarkers.push({lat:coords.lat,lng:coords.lng,popup,locId:loc.id});
plotted++;
}else{failed++;}
}catch(e){failed++;console.warn('Geocode error:',addr,e);}
statusEl.textContent=plotted+' / '+locs.length+' plotted'+(failed?' ('+failed+' failed)':'')+(plotted<locs.length?'…':'');
$('physicianCount').textContent='Territory Map ('+plotted+' / '+locs.length+')';
}
const doneMsg=plotted+' location'+(plotted!==1?'s':'')+' on map'+(failed?' · '+failed+' failed':'');
statusEl.textContent=doneMsg;
$('physicianCount').textContent='Territory Map ('+plotted+' locations)';
setTimeout(()=>{if(statusEl.parentNode)statusEl.style.opacity='0';setTimeout(()=>{if(statusEl.parentNode)statusEl.remove();},600);},12000);
if(!search)territoryMapCache={version,markers:_mapBuiltMarkers.slice(),bounds};
if(myLocationMarker){
const ul=myLocationMarker.getLatLng();const ul2=[ul.lat,ul.lng];
const nb=_mapBuiltMarkers.filter(m=>haversineMiles(ul2[0],ul2[1],m.lat,m.lng)<=10);
if(nb.length){const b2=[[ul2[0],ul2[1]],...nb.map(m=>[m.lat,m.lng])];territoryMap.fitBounds(b2,{padding:[50,50]});showToast(nb.length+' location'+(nb.length!==1?'s':'')+' within 10 mi','info');}
else{if(bounds.length>1)territoryMap.fitBounds(bounds,{padding:[30,30]});else if(bounds.length===1)territoryMap.setView(bounds[0],15);}
}else{
if(bounds.length>1)territoryMap.fitBounds(bounds,{padding:[30,30]});
else if(bounds.length===1)territoryMap.setView(bounds[0],15);
else territoryMap.invalidateSize();
}
}

let myLocationMarker = null;
let myLocationCircle = null;
const DEMO_HOME = [39.7392, -104.9903]; // Denver, CO — demo territory center
function haversineMiles(lat1,lon1,lat2,lon2){const R=3958.8;const dLat=(lat2-lat1)*Math.PI/180;const dLon=(lon2-lon1)*Math.PI/180;const a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}
function locateOnMap() {
if (!territoryMap) { showToast('Open the map first', 'info'); return; }
const latlng = DEMO_HOME;
if (myLocationMarker) myLocationMarker.remove();
if (myLocationCircle) myLocationCircle.remove();
const icon = L.divIcon({className:'', html:'<div style="width:18px;height:18px;background:#2563eb;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>', iconSize:[18,18], iconAnchor:[9,9]});
myLocationMarker = L.marker(latlng, {icon}).addTo(territoryMap).bindPopup('<strong>Territory Home Base</strong><br><span style="font-size:0.8rem;color:#666;">Denver, CO</span>').openPopup();
myLocationCircle = L.circle(latlng, {radius:16093, color:'#2563eb', fillColor:'#2563eb', fillOpacity:0.06, weight:1, dashArray:'6,4'}).addTo(territoryMap);
const nearby = _mapBuiltMarkers.filter(m => haversineMiles(latlng[0], latlng[1], m.lat, m.lng) <= 10);
if (nearby.length) {
const bounds = [[latlng[0],latlng[1]], ...nearby.map(m=>[m.lat,m.lng])];
territoryMap.fitBounds(bounds, {padding:[50,50]});
showToast(nearby.length+' location'+(nearby.length!==1?'s':'')+' within 10 mi', 'info');
} else {
territoryMap.setView(latlng, 11);
showToast('Territory center — Denver, CO', 'info');
}
}
