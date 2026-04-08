// === js/contact.js === Contact modal, note editing, reminder completion, admin panel toggle

function prefixNote(prefix){const ta=$('contactNotes');if(!ta.value.startsWith('Call: ')&&!ta.value.startsWith('Visit: ')&&!ta.value.startsWith('Email: ')){ta.value=prefix+ta.value;}else{ta.value=ta.value.replace(/^(Call|Visit|Email): /,prefix);}ta.focus();const row=$('alsoAttendedRow');if(row){row.style.display=(prefix==='Visit: ')?'block':'none';if(prefix!=='Visit: '){const det=$('alsoAttendedDetails');if(det)det.style.display='none';const sp=$('staffPresent');if(sp)sp.value='';}}}

function openContactModal() {
editingContactId = null;
$('contactForm').reset();
$('contactModalTitle').textContent = 'Add Contact Note';
$('authorName').value = localStorage.getItem('lastCallLogAuthor') || '';
$('contactSaveBtn').textContent = 'Save Note';
$('contactSaveBtn').className = 'btn-primary';
setToday();
// Global mode (no provider): show provider+practice search rows; otherwise hide them
const provRow=$('contactProviderRow');
const pracRow=$('contactPracticeRow');
if(!currentPhysician){
  if(provRow){provRow.style.display='block';$('contactProviderSearch').value='';$('contactProviderSelectedId').value='';$('contactProviderResults').style.display='none';}
  if(pracRow){pracRow.style.display='block';$('contactPracticeSearch').value='';$('contactPracticeSelectedId').value='';$('contactPracticeResults').style.display='none';}
}else{
  if(provRow)provRow.style.display='none';
  if(pracRow)pracRow.style.display='none';
}
populateLocationDropdown();
populateAlsoAttended();
const row=$('alsoAttendedRow');if(row)row.style.display='none';
const det=$('alsoAttendedDetails');if(det)det.style.display='none';
const sp=$('staffPresent');if(sp)sp.value='';
const pr = $('practicePhysSelectRow'); if (pr) pr.style.display = 'none';
$('contactForm').onsubmit = function(ev) { saveContact(ev); return false; };
$('setReminder').checked = false;
if($('reminderRow'))$('reminderRow').style.display='block';
$('contactModal').classList.add('active');
}

function populateLocationDropdown() {
const select = $('contactLocation');
if (!currentPhysician) {
  select.innerHTML = '<option value="">Select location...</option>';
  if($('locationSelectRow'))$('locationSelectRow').style.display='none';
  return;
}
const assignments = physicianAssignments[currentPhysician.id] || [];
const locations = assignments.map(a => {
const loc = practiceLocations.find(l => l.id === a.practice_location_id);
if (loc) {
const practice = practices.find(p => p.id === loc.practice_id);
return { id: loc.id, label: fmtLocOption(loc, practice) };
}
return null;
}).filter(Boolean);
select.innerHTML = locations.length === 1
? `<option value="${locations[0].id}">${locations[0].label}</option>`
: '<option value="">Select location...</option>' +
locations.map(l => `<option value="${l.id}">${l.label}</option>`).join('');
// Refresh attendees when location changes
select.onchange = () => { if($('contactNotes').value.startsWith('Visit: ')) populateAlsoAttended(); };
$('locationSelectRow').style.display = locations.length <= 1 ? 'none' : 'block';
if (locations.length === 1) {
select.value = locations[0].id;
}
}

function populateAlsoAttended() {
const list = $('alsoAttendedList');
if (!list || !currentPhysician) return;
// Filter by the currently selected location if one is chosen
const selectedLocId = $('contactLocation').value;
let colleagues;
if (selectedLocId) {
colleagues = physicians.filter(p => {
if (p.id === currentPhysician.id) return false;
return (physicianAssignments[p.id] || []).some(a => a.practice_location_id === selectedLocId);
});
} else {
const myLocIds = (physicianAssignments[currentPhysician.id] || []).map(a => a.practice_location_id);
colleagues = physicians.filter(p => {
if (p.id === currentPhysician.id) return false;
return (physicianAssignments[p.id] || []).some(a => myLocIds.includes(a.practice_location_id));
});
}
if (colleagues.length === 0) {
list.innerHTML = `<div style="font-size:0.8rem;color:#999;padding:0.2rem 0;">${selectedLocId ? 'No other providers at this location' : 'No colleague providers at shared locations'}</div>`;
} else {
list.innerHTML = colleagues.map(p => `<div class="selector-option" style="margin-bottom:0.25rem;" onclick="var c=this.querySelector('input');c.checked=!c.checked;">
<input type="checkbox" value="${p.id}" class="also-attended-cb">
<span class="selector-option-label">${fmtName(p)}</span>
</div>`).join('');
}
}

function closeContactModal(){closeModal('contactModal');}

function _filterPhysSearch(inputId, resultsId, onSelectFn) {
const q=($(inputId).value||'').toLowerCase().trim();
const results=$(resultsId);
if(!q){results.style.display='none';return;}
const matches=physicians.filter(p=>fmtName(p).toLowerCase().includes(q)||(p.specialty||'').toLowerCase().includes(q)).slice(0,8);
if(!matches.length){results.innerHTML='<div style="padding:0.5rem 0.75rem;font-size:0.85rem;color:#999;">No providers found</div>';results.style.display='block';return;}
results.innerHTML=matches.map(p=>{
  const locs=(physicianAssignments[p.id]||[]).map(a=>practiceLocations.find(l=>l.id===a.practice_location_id)).filter(Boolean);
  const prac=locs.length?(practices.find(pr=>pr.id===locs[0].practice_id)||{}).name||'':'';
  return `<div onclick="${onSelectFn}('${p.id}')" style="padding:0.5rem 0.75rem;cursor:pointer;border-bottom:1px solid #f0f0f0;font-size:0.875rem;" onmouseover="this.style.background='#f0f9f4'" onmouseout="this.style.background=''"><span style="font-weight:600;">${fmtName(p)}</span>${prac?`<span style="color:#888;font-size:0.8rem;"> · ${prac}</span>`:''}</div>`;
}).join('');
results.style.display='block';
}
function filterContactProviders(){_filterPhysSearch('contactProviderSearch','contactProviderResults','selectContactProvider');}
function filterContactPractices() {
const q=($('contactPracticeSearch').value||'').toLowerCase().trim();
const res=$('contactPracticeResults');
if(!q){res.style.display='none';return;}
const matches=practices.filter(p=>p.name.toLowerCase().includes(q)).slice(0,8);
if(!matches.length){res.style.display='none';return;}
res.innerHTML=matches.map(p=>{const locs=practiceLocations.filter(l=>l.practice_id===p.id);const city=locs.map(l=>l.city).filter(Boolean)[0]||'';return`<div onclick="selectContactPractice('${p.id}')" style="padding:0.5rem 0.75rem;cursor:pointer;border-bottom:1px solid #f0f0f0;font-size:0.875rem;" onmouseover="this.style.background='#fffbeb'" onmouseout="this.style.background=''"><span style="font-weight:600;">${p.name}</span>${city?`<span style="color:#888;font-size:0.8rem;"> · ${city}</span>`:''}</div>`;}).join('');
res.style.display='block';
}
function selectContactPractice(practiceId) {
const prac=practices.find(p=>p.id===practiceId);
if(!prac)return;
$('contactPracticeSearch').value=prac.name;
$('contactPracticeSelectedId').value=practiceId;
$('contactPracticeResults').style.display='none';
// Clear any provider selection
$('contactProviderSearch').value='';$('contactProviderSelectedId').value='';
// Populate location from practice locations
const locs=practiceLocations.filter(l=>l.practice_id===practiceId);
const sel=$('contactLocation');
sel.innerHTML=locs.length===0?'<option value="">No locations</option>':locs.length===1?`<option value="${locs[0].id}">${locs[0].label&&locs[0].label!==locs[0].city?locs[0].label:(locs[0].address||'Office')}${locs[0].city?', '+locs[0].city:''}</option>`:'<option value="">Select location...</option>'+locs.map(l=>`<option value="${l.id}">${l.label&&l.label!==l.city?l.label:(l.address||'Office')}${l.city?', '+l.city:''}</option>`).join('');
$('locationSelectRow').style.display=locs.length<=1?'none':'block';
if(locs.length===1)sel.value=locs[0].id;
}
function selectContactProvider(physId) {
const p=physicians.find(ph=>ph.id===physId);
if(!p)return;
$('contactProviderSearch').value=fmtName(p);
$('contactProviderSelectedId').value=physId;
$('contactProviderResults').style.display='none';
// Clear practice selection
$('contactPracticeSearch').value='';$('contactPracticeSelectedId').value='';
// Populate location dropdown for this provider
const assignments=(physicianAssignments[physId]||[]);
const locs=assignments.map(a=>{const loc=practiceLocations.find(l=>l.id===a.practice_location_id);if(!loc)return null;const prac=practices.find(pr=>pr.id===loc.practice_id);return{id:loc.id,label:fmtLocOption(loc,prac)};}).filter(Boolean);
const sel=$('contactLocation');
sel.innerHTML=(locs.length===0?'<option value="">No locations assigned</option>':'<option value="">Select location...</option>')+locs.map(l=>`<option value="${l.id}">${l.label}</option>`).join('');
$('locationSelectRow').style.display=locs.length<=1?'none':'block';
if(locs.length===1)sel.value=locs[0].id;
}

async function saveContact(e) {
if(e) e.preventDefault();
try {
// In global mode (no currentPhysician), read from provider OR practice search
let _savePhysician = currentPhysician;
let _savePracticeLocId = null; // for practice-only notes
if(!_savePhysician){
  const selId=$('contactProviderSelectedId')?.value;
  const pracId=$('contactPracticeSelectedId')?.value;
  if(selId){
    _savePhysician=physicians.find(p=>p.id===selId);
    if(!_savePhysician){showToast('Provider not found','error');return;}
  } else if(pracId){
    // Practice-only note — no provider required
    _savePracticeLocId=$('contactLocation').value||null;
  } else {
    showToast('Please select a provider or practice','error');return;
  }
}
const dateVal=$('contactDate').value,authorVal=$('authorName').value;
const nv=($('contactNotes').value||'').trim();
if(!dateVal){showToast('Please enter a date','error');return;}
if(!authorVal){const _a=$('authorName');_a.style.border='2px solid #dc2626';_a.style.borderRadius='6px';setTimeout(()=>{_a.style.border='';},2500);_a.scrollIntoView({behavior:'smooth',block:'center'});showToast('Select your rep name — Tom or Travis','error');return;}
localStorage.setItem('lastCallLogAuthor',authorVal);
if(!nv){showToast('Please enter note text','error');return;}
const tv=$('contactTime').value;
const locVal=_savePhysician?($('contactLocation').value||null):_savePracticeLocId;
const reminderOn=$('setReminder').checked;
const baseNote=tv?`[${tv}] ${nv}`:nv;
const staffVal=$('staffPresent')?$('staffPresent').value.trim():'';
const noteText=staffVal?`${baseNote} | Staff: ${staffVal}`:baseNote;
// Practice-only path (no provider)
if(!_savePhysician){
await withSave('contactSaveBtn','Save Note',async()=>{
const data={provider_id:null,contact_date:dateVal,author:authorVal,notes:noteText,practice_location_id:locVal};
if(editingContactId){const{error}=await db.from('contact_logs').update(data).eq('id',editingContactId);if(error)throw error;showToast('Note updated','success');}
else{const{error}=await db.from('contact_logs').insert(data);if(error)throw error;showToast('Practice note logged','success');}
if(currentView==='activity'){renderActivityTabView();}
if(reminderOn){setTimeout(()=>{closeContactModal();openAddTaskModal(null,locVal);},400);}
else{setTimeout(()=>closeContactModal(),500);}
});
return;
}
// Activity record — clean, no reminder_date, no embedded task text
const data={provider_id:_savePhysician.id,contact_date:dateVal,author:authorVal,notes:noteText,practice_location_id:locVal};
const alsoCbs=document.querySelectorAll('.also-attended-cb:checked');
const alsoIds=[...alsoCbs].map(cb=>cb.value);
await withSave('contactSaveBtn','Save Note',async()=>{
if(editingContactId){
// Edit: update activity only, do not touch reminder_date (tasks are separate)
const{error}=await db.from('contact_logs').update(data).eq('id',editingContactId);if(error)throw error;showToast('Note updated','success');
}else{
const{error}=await db.from('contact_logs').insert(data);if(error)throw error;
if(alsoIds.length>0){
const alsoEntries=alsoIds.map(pid=>({provider_id:pid,contact_date:dateVal,author:authorVal,notes:noteText,practice_location_id:locVal}));
const{error:ae}=await db.from('contact_logs').insert(alsoEntries);
if(ae)console.error('Also-attended insert error:',ae);
for(const pid of alsoIds){await db.from('providers').update({last_contact:dateVal}).eq('id',pid);}
}
const total=1+alsoIds.length;
showToast(`Note logged for ${total} provider${total>1?'s':''}`,'success');
}
await db.from('providers').update({last_contact:dateVal}).eq('id',_savePhysician.id);
_savePhysician.last_contact=dateVal;
if(currentPhysician&&currentPhysician.id===_savePhysician.id){currentPhysician.last_contact=dateVal;await loadContactLogs(currentPhysician.id);}
if(currentView==='activity'){renderActivityTabView();}else if(currentPhysician&&currentPhysician.id===_savePhysician.id){renderProfile();}
// If follow-up task requested, open separate task modal after closing activity modal
if(reminderOn){
setTimeout(()=>{closeContactModal();openAddTaskModal(_savePhysician.id,locVal);},400);
}else{
setTimeout(()=>closeContactModal(),500);
}
});
}catch(err){showToast('Error saving note: '+err.message,'error');console.error('saveContact error:',err);}
}

async function editNote(logId) {
if (!currentPhysician) return;
const log = (contactLogs[currentPhysician.id] || []).find(l => l.id === logId);
if (!log) return;
editingContactId = logId;
const isTask = log.reminder_date && log.reminder_date !== '2000-01-01';
$('contactModalTitle').textContent = isTask ? 'Edit Task' : 'Edit Contact Note';
$('contactModalTitle').style.color = isTask ? '#8b5cf6' : '';
$('contactSaveBtn').textContent = isTask ? 'Save Task' : 'Save Note';
$('contactSaveBtn').className = 'btn-primary';
populateLocationDropdown();
$('contactDate').value = log.contact_date;
$('contactLocation').value = log.practice_location_id || '';
$('authorName').value = log.author || '';
let notes = log.notes || '';
let time = '';
const timeMatch = notes.match(/^\[(\d{1,2}:\d{2})\]\s*/);
if (timeMatch) { time = timeMatch[1]; notes = notes.replace(timeMatch[0], ''); }
// Strip legacy embedded task text for clean display (backward compat with old records)
const taskMatch = notes.match(/\s*\|\s*\[Task:\s*(.*?)\]$/);
if (taskMatch) notes = notes.slice(0, taskMatch.index).trim();
$('contactTime').value = time;
$('contactNotes').value = notes;
$('setReminder').checked = false;
if($('reminderRow'))$('reminderRow').style.display = isTask ? 'none' : 'block';
$('contactModal').classList.add('active');
}

async function deleteNote(logId) {
await dbDel('contact_logs',logId,'Delete this note?',async()=>{if(!currentPhysician)return;await loadContactLogs(currentPhysician.id);if(currentView==='activity'){renderActivityTabView();}else{renderProfile();}});
}

async function completeReminder(logId) {
try {
updateSyncIndicators('syncing');
const {error} = await db.from('contact_logs').update({reminder_date: '2000-01-01'}).eq('id', logId);
if (error) throw error;
showToast('Task completed ✓', 'success');
updateSyncIndicators('synced');
if (!currentPhysician && !currentPractice && !(currentView === 'activity' && activitySubTab === 'tasks')) { renderEmptyState(); }
} catch(e) { showToast('Error: ' + e.message, 'error'); updateSyncIndicators('error'); }
}

async function editNoteFromActivity(logId, physicianId) {
try {
currentPhysician = physicians.find(p => p.id === physicianId);
currentPractice = null;
if (!currentPhysician) return;
await loadContactLogs(physicianId);
if (currentView === 'activity' && activitySubTab !== 'tasks') {
setTimeout(() => editNote(logId), 50);
} else {
renderList();
renderProfile();
if (window.innerWidth <= 768) closeSidebar();
setTimeout(() => editNote(logId), 150);
}
} catch(e) { showToast('Error loading note: ' + e.message, 'error'); }
}

async function deleteNoteFromActivity(logId, physicianId) {
try {
currentPhysician = physicians.find(p => p.id === physicianId);
currentPractice = null;
if (!currentPhysician) return;
await loadContactLogs(physicianId);
await deleteNote(logId);
} catch(e) { showToast('Error: ' + e.message, 'error'); }
}

// Edit any contact log entry from the practice profile (works for both provider-linked and practice-level notes)
async function editPracticeNote(logId) {
try{
const{data:log,error}=await db.from('contact_logs').select('*').eq('id',logId).single();
if(error||!log){showToast('Note not found','error');return;}
editingContactId=logId;
const isTask=log.reminder_date&&log.reminder_date!=='2000-01-01';
$('contactForm').reset();
$('contactModalTitle').textContent=isTask?'Edit Task':'Edit Note';
$('contactModalTitle').style.color=isTask?'#8b5cf6':'';
$('contactSaveBtn').textContent=isTask?'Save Task':'Save Changes';
$('contactSaveBtn').className='btn-primary';
$('contactDate').value=log.contact_date||'';
$('authorName').value=log.author||'';
const tm=(log.notes||'').match(/^\[(\d{1,2}:\d{2})\]\s*/);
$('contactTime').value=tm?tm[1]:'';
$('contactNotes').value=tm?log.notes.slice(tm[0].length):(log.notes||'');
if($('locationSelectRow'))$('locationSelectRow').style.display='none';
if($('reminderRow'))$('reminderRow').style.display=isTask?'none':'block';
if(!isTask)$('setReminder').checked=false;
const pr=$('practicePhysSelectRow');if(pr)pr.style.display='none';
const _editLog=log;
$('contactForm').onsubmit=async function(ev){
ev.preventDefault();
const tv=$('contactTime').value,nv=$('contactNotes').value;
const newNote=tv?`[${tv}] ${nv}`:nv;
const reminderOn=!isTask&&$('setReminder').checked;
await withSave('contactSaveBtn',isTask?'Save Task':'Save Changes',async()=>{
const{error}=await db.from('contact_logs').update({notes:newNote,author:$('authorName').value,contact_date:$('contactDate').value}).eq('id',editingContactId);
if(error)throw error;
showToast(isTask?'Task updated':'Note updated','success');
closeContactModal();
$('contactForm').onsubmit=function(ev){saveContact(ev);return false;};
if(reminderOn){const provId=_editLog.provider_id||null;const locId=_editLog.practice_location_id||null;setTimeout(()=>openAddTaskModal(provId,locId),400);}
if(currentPractice)loadPracticeActivity(currentPractice.id).then(()=>renderPracticeProfile()).catch(()=>{});
});
return false;
};
$('contactModal').classList.add('active');
}catch(e){showToast('Error: '+e.message,'error');}
}
async function deletePracticeNote(logId) {
await dbDel('contact_logs',logId,'Delete this note?',async()=>{
if(currentPractice){renderPracticeProfile();await loadPracticeActivity(currentPractice.id);}
});
}

function _buildTaskContext(physicianId, locationId) {
const phys = physicianId ? physicians.find(p => p.id === physicianId) : null;
let loc = locationId ? practiceLocations.find(l => l.id === locationId) : null;
// Fall back to primary location when no explicit location given
if (!loc && physicianId) loc = getPrimaryLoc(physicianId);
const practice = loc ? practices.find(p => p.id === loc.practice_id) : null;
let ctx = '';
if (phys) { ctx = `<strong>${fmtName(phys)}</strong>`; if (practice) ctx += ` · ${practice.name}`; if (loc && loc.address) ctx += ` · ${loc.address}${loc.city?', '+loc.city:''}`; }
else if (practice) { ctx = `<strong>${practice.name}</strong>`; if (loc) ctx += ` · ${loc.label || loc.address || loc.city || ''}`; }
else if (loc) { ctx = `<strong>${loc.label || loc.address || 'Location'}</strong>`; }
return ctx;
}

function openAddTaskModal(physicianId, locationId) {
const _sb=$('addTaskSaveBtn');if(_sb){_sb.textContent='Save Task';_sb.className='btn-primary';}
if($('addTaskEditId'))$('addTaskEditId').value = '';
$('addTaskNote').value = '';
if($('addTaskAuthor'))$('addTaskAuthor').value = '';
if($('addTaskTime'))$('addTaskTime').value = '';
$('addTaskPhysicianId').value = physicianId || '';
$('addTaskLocationId').value = locationId || '';
$('addTaskModalTitle').textContent = 'New Task';
// mode: 'provider' | 'practice' | 'global'
const mode = physicianId ? 'provider' : locationId ? 'practice' : 'global';
// Context block
const ctx = $('addTaskContext');
if(ctx){ctx.innerHTML=_buildTaskContext(physicianId,locationId);ctx.style.display=mode!=='global'?'block':'none';}
// Provider search row
const provRow=$('addTaskProviderRow');
if(provRow){
  provRow.style.display=mode==='global'?'block':'none';
  if(mode==='global'){$('addTaskProviderSearch').value='';$('addTaskProviderResults').style.display='none';}
}
// Practice search row
const pracRow=$('addTaskPracticeRow');
if(pracRow){
  pracRow.style.display=mode==='global'?'block':'none';
  if(mode==='global'){$('addTaskPracticeSearch').value='';$('addTaskPracticeResults').style.display='none';}
}
// Location row
const locRow=$('addTaskLocationRow');
if(locRow){
  locRow.style.display='block';
  if(mode==='global'){
    $('addTaskLocationSelect').innerHTML='<option value="">No specific location</option>';
  } else if(mode==='provider'){
    const assigned=(physicianAssignments[physicianId]||[]).map(a=>{const loc=practiceLocations.find(l=>l.id===a.practice_location_id);if(!loc)return null;const prac=practices.find(pr=>pr.id===loc.practice_id);return{id:loc.id,label:`${prac?prac.name+' \u2014 ':''}${loc.label&&loc.label!==loc.city?loc.label:loc.city||'Office'}${loc.address?' ('+loc.address+')':''}`};}).filter(Boolean);
    const locs=assigned.length>0?assigned:practiceLocations.filter(l=>l.zip||l.address).map(l=>{const prac=practices.find(pr=>pr.id===l.practice_id);return{id:l.id,label:`${prac?prac.name+' \u2014 ':''}${l.label&&l.label!==l.city?l.label:l.city||'Office'}${l.address?' ('+l.address+')':''}`};});
    const noLocMsg=assigned.length===0?'<option value="" disabled style="color:#dc2626;">No locations assigned — add from profile first</option>':'';
    const sel=$('addTaskLocationSelect');sel.innerHTML='<option value="">No specific location</option>'+noLocMsg+locs.map(l=>`<option value="${l.id}"${l.id===locationId?' selected':''}>${l.label}</option>`).join('');
    $('addTaskLocationId').value=locationId||'';
  } else {
    // practice mode: show all locations for this practice
    const loc=practiceLocations.find(l=>l.id===locationId);
    const practiceId=loc?loc.practice_id:null;
    const pracLocs=practiceId?practiceLocations.filter(l=>l.practice_id===practiceId):(loc?[loc]:[]);
    const sel=$('addTaskLocationSelect');
    sel.innerHTML='<option value="">No specific location</option>'+pracLocs.map(l=>`<option value="${l.id}"${l.id===locationId?' selected':''}>${l.label&&l.label!==l.city?l.label:l.city||'Office'}${l.address?' ('+l.address+')':''}</option>`).join('');
    $('addTaskLocationId').value=locationId||'';
  }
}
populateReminderDateButtons('task');
$('addTaskModal').classList.add('active');
_checkAddTaskLinked();
setTimeout(() => $('addTaskNote').focus(), 100);
}
function _checkAddTaskLinked() {
const warn = $('addTaskUnlinkedWarning');
if (!warn) return;
const isGlobal = $('addTaskProviderRow') && $('addTaskProviderRow').style.display !== 'none';
const hasProvider = !!($('addTaskPhysicianId').value);
const hasLocation = !!($('addTaskLocationId').value);
warn.style.display = (isGlobal && !hasProvider && !hasLocation) ? 'block' : 'none';
}
function filterAddTaskPractices() {
const q=($('addTaskPracticeSearch').value||'').toLowerCase().trim();
const results=$('addTaskPracticeResults');
if(!q){results.style.display='none';return;}
const matches=practices.filter(p=>(p.name||'').toLowerCase().includes(q)).slice(0,8);
if(!matches.length){results.innerHTML='<div style="padding:0.5rem 0.75rem;font-size:0.85rem;color:#999;">No practices found</div>';results.style.display='block';return;}
results.innerHTML=matches.map(p=>{
  const locs=practiceLocations.filter(l=>l.practice_id===p.id);
  const city=[...new Set(locs.map(l=>l.city).filter(Boolean))].slice(0,2).join(', ');
  return `<div onclick="selectAddTaskPractice('${p.id}')" style="padding:0.5rem 0.75rem;cursor:pointer;border-bottom:1px solid #f0f0f0;font-size:0.875rem;" onmouseover="this.style.background='#f0f9f4'" onmouseout="this.style.background=''"><span style="font-weight:600;">${p.name}</span>${city?`<span style="color:#888;font-size:0.8rem;"> · ${city}</span>`:''}${locs.length?`<span style="color:#aaa;font-size:0.75rem;"> (${locs.length} loc)</span>`:''}</div>`;
}).join('');
results.style.display='block';
}
function selectAddTaskPractice(practiceId) {
const prac=practices.find(p=>p.id===practiceId);
if(!prac)return;
// Clear provider fields
$('addTaskPhysicianId').value='';
$('addTaskProviderSearch').value='';
$('addTaskPracticeSearch').value=prac.name;
$('addTaskPracticeResults').style.display='none';
// Populate location with this practice's locations
const locs=practiceLocations.filter(l=>l.practice_id===practiceId);
const sel=$('addTaskLocationSelect');
sel.innerHTML='<option value="">No specific location</option>'+locs.map(l=>`<option value="${l.id}">${l.label&&l.label!==l.city?l.label:l.city||'Office'}${l.address?' ('+l.address+')':''}</option>`).join('');
if(locs.length===1){sel.value=locs[0].id;$('addTaskLocationId').value=locs[0].id;}
$('addTaskLocationRow').style.display='block';
// Update context using first location
const firstLoc=locs[0];
const ctx=$('addTaskContext');
if(ctx){ctx.innerHTML=_buildTaskContext(null,firstLoc?firstLoc.id:null);ctx.style.display='block';}
_checkAddTaskLinked();
}
function openAddTaskForPractice() {
if(!currentPractice)return;
const locs=practiceLocations.filter(l=>l.practice_id===currentPractice.id);
openAddTaskModal(null,locs.length>0?locs[0].id:null);
}

function filterAddTaskProviders(){_filterPhysSearch('addTaskProviderSearch','addTaskProviderResults','selectAddTaskProvider');}

function selectAddTaskProvider(physicianId) {
const phys=physicians.find(p=>p.id===physicianId);
if(!phys)return;
$('addTaskPhysicianId').value=physicianId;
$('addTaskProviderSearch').value=fmtName(phys);
$('addTaskProviderResults').style.display='none';
// Populate location dropdown for this provider
const assignments=(physicianAssignments[physicianId]||[]);
const locs=assignments.map(a=>{
  const loc=practiceLocations.find(l=>l.id===a.practice_location_id);
  if(!loc)return null;
  const prac=practices.find(pr=>pr.id===loc.practice_id);
  return{id:loc.id,label:fmtLocOption(loc,prac)};
}).filter(Boolean);
const sel=$('addTaskLocationSelect');
sel.innerHTML='<option value="">No specific location</option>'+locs.map(l=>`<option value="${l.id}">${l.label}</option>`).join('');
if(locs.length===1){sel.value=locs[0].id;$('addTaskLocationId').value=locs[0].id;}
$('addTaskLocationRow').style.display='block';
// Update context
const ctx=$('addTaskContext');
if(ctx){ctx.innerHTML=_buildTaskContext(physicianId,null);ctx.style.display='block';}
_checkAddTaskLinked();
}

// Opens addTaskModal in edit mode for an existing task record (called from task detail modal)
function openEditTaskModal() {
const rec = window._openedTaskRec;
if (!rec) return;
// ── Full modal reset before populating ──────────────────────────────────────
// Every field is wiped first so no state from any previous modal open can
// bleed through — regardless of which fields the current record happens to set.
const _sb=$('addTaskSaveBtn');if(_sb){_sb.textContent='Save Task';_sb.className='btn-primary';}
['addTaskProviderSearch','addTaskPracticeSearch','addTaskNote','addTaskTime'].forEach(id=>{const el=$(id);if(el)el.value='';});
['addTaskPhysicianId','addTaskLocationId','addTaskEditId','taskSelectedDate','taskCustomDate'].forEach(id=>{const el=$(id);if(el)el.value='';});;
['addTaskProviderResults','addTaskPracticeResults','addTaskUnlinkedWarning'].forEach(id=>{const el=$(id);if(el)el.style.display='none';});
['addTaskProviderRow','addTaskPracticeRow','addTaskLocationRow'].forEach(id=>{const el=$(id);if(el)el.style.display='none';});
const _ctx=$('addTaskContext');if(_ctx){_ctx.innerHTML='';_ctx.style.display='none';}
const _sel=$('addTaskLocationSelect');if(_sel)_sel.innerHTML='<option value="">No specific location</option>';
const _dp=$('taskDatePreview');if(_dp)_dp.textContent='';
if($('addTaskAuthor'))$('addTaskAuthor').value='';
$('addTaskModalTitle').textContent='Edit Task';
// ── Populate from record ─────────────────────────────────────────────────────
const tm = (rec.notes||'').match(/^\[(\d{1,2}:\d{2})\]\s*/);
let noteText = tm ? rec.notes.replace(tm[0], '') : (rec.notes||'');
const taskMatch = noteText.match(/\s*\|\s*\[Task:\s*(.*?)\]$/);
const taskNote = taskMatch ? taskMatch[1].trim() : noteText;
if($('addTaskEditId'))$('addTaskEditId').value = rec.id;
$('addTaskNote').value = taskNote;
$('addTaskPhysicianId').value = rec.provider_id || '';
$('addTaskLocationId').value = rec.practice_location_id || '';
if($('addTaskProviderRow'))$('addTaskProviderRow').style.display='block';
if(rec.provider_id){selectAddTaskProvider(rec.provider_id);if(rec.practice_location_id&&$('addTaskLocationSelect')){$('addTaskLocationSelect').value=rec.practice_location_id;$('addTaskLocationId').value=rec.practice_location_id;if(_ctx){_ctx.innerHTML=_buildTaskContext(rec.provider_id,rec.practice_location_id);_ctx.style.display='block';}}}
else{if(_ctx){_ctx.innerHTML=_buildTaskContext(null,rec.practice_location_id);_ctx.style.display=rec.practice_location_id?'block':'none';}}
if($('addTaskAuthor'))$('addTaskAuthor').value=rec.author||'';
if($('addTaskTime'))$('addTaskTime').value=tm?tm[1]:'';
populateReminderDateButtons('task');
if(rec.reminder_date)selectReminderDate(rec.reminder_date,'','task');
$('addTaskModal').classList.add('active');
setTimeout(()=>$('addTaskNote').focus(),100);
}

function closeAddTaskModal() { closeModal('addTaskModal'); }

async function saveNewTask() {
const note = ($('addTaskNote').value || '').trim();
if (!note) { showToast('Please enter a task note', 'error'); return; }
const date = $('taskSelectedDate').value;
if (!date) { showToast('Please select a due date', 'error'); return; }
const authorVal = ($('addTaskAuthor')?.value || '').trim();
if (!authorVal) { const _a=$('addTaskAuthor');if(_a){_a.style.border='2px solid #dc2626';_a.style.borderRadius='8px';setTimeout(()=>{_a.style.border='';},2500);_a.scrollIntoView({behavior:'smooth',block:'center'});}showToast('Select your rep name — Tom or Travis','error');return; }
const editId = ($('addTaskEditId')?.value) || null;
const physicianId = $('addTaskPhysicianId').value || null;
// When in global mode the location comes from the visible select; otherwise use the hidden field
const locRow=$('addTaskLocationRow');
const locationId = (locRow&&locRow.style.display!=='none'&&$('addTaskLocationSelect'))
  ? ($('addTaskLocationSelect').value||null)
  : ($('addTaskLocationId').value||null);
const today = localDate();
await withSave('addTaskSaveBtn', editId ? 'Save Task' : 'Save Task', async () => {
let error, _newRec = null;
if (editId) {
({error} = await db.from('contact_logs').update({ notes: note, reminder_date: date, author: authorVal, provider_id: physicianId||null, practice_location_id: locationId||null }).eq('id', editId));
} else {
({data:_newRec,error} = await db.from('contact_logs').insert({ provider_id: physicianId, contact_date: today, author: authorVal, notes: note, practice_location_id: locationId, reminder_date: date }).select().single());
}
if (error) throw error;
// Keep _taskDetailLogs in sync so re-opening the task detail modal shows updated text
if (editId) {
  const existing = (typeof _taskDetailLogs !== 'undefined' && _taskDetailLogs[editId]) || (window._taskDetailLogs||{})[editId] || {};
  const updated = Object.assign({}, existing, { notes: note, reminder_date: date, author: authorVal, provider_id: physicianId||null, practice_location_id: locationId||null });
  if (typeof _taskDetailLogs !== 'undefined') _taskDetailLogs[editId] = updated;
  if (!window._taskDetailLogs) window._taskDetailLogs = {};
  window._taskDetailLogs[editId] = updated;
  window._openedTaskRec = updated;
}
showToast(editId ? 'Task updated' : 'Task saved', 'success');
closeAddTaskModal();
if (currentView === 'activity') renderTasksView();
if (physicianId && currentPhysician && currentPhysician.id === physicianId) { loadContactLogs(physicianId).then(()=>renderProfile()).catch(()=>{}); }
if (!editId && _newRec && date && date !== '2099-12-31') {
const _p=physicianId?physicians.find(p=>p.id===physicianId):null,_l=locationId?practiceLocations.find(l=>l.id===locationId):null,_pr=_l?practices.find(p=>p.id===_l.practice_id):null;
const _taskTime=($('addTaskTime')||{}).value||'';
const calUrl=buildGoogleCalendarUrl(_newRec,_p,_l,_pr,_taskTime);
const _tc=$('toastContainer'),_t=document.createElement('div');
_t.className='toast success';
_t.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:0.75rem;padding:0.85rem 1rem;flex-wrap:wrap;';
const _a=document.createElement('a');_a.href=calUrl;_a.target='_blank';_a.rel='noopener';
_a.textContent='📅 Google Cal';_a.style.cssText='color:white;font-weight:600;text-decoration:underline;font-size:0.95rem;white-space:nowrap;';
const _b=document.createElement('button');_b.textContent='🍎 Apple Cal';_b.style.cssText='background:none;border:1px solid rgba(255,255,255,0.6);color:white;font-weight:600;font-size:0.95rem;cursor:pointer;padding:0.2rem 0.5rem;border-radius:4px;white-space:nowrap;';
_b.onclick=()=>{downloadTaskICS(_newRec,_p,_l,_pr,_taskTime);};
const _x=document.createElement('button');_x.textContent='×';_x.style.cssText='background:none;border:none;color:white;font-size:1.5rem;line-height:1;cursor:pointer;padding:0;flex-shrink:0;';
_x.onclick=()=>_t.remove();_t.appendChild(_a);_t.appendChild(_b);_t.appendChild(_x);_tc.appendChild(_t);
setTimeout(()=>_t.remove(),15000);
}
});
}

function toggleAdminPanel() {
const panel = $('adminPanel');
panel.classList.toggle('show');
if (panel.classList.contains('show')) initSheetSyncUrl();
}

// --- Auto call-log interceptor ---
let _pendingCall = null;

function _savePendingCall(ctx) {
  _pendingCall = ctx;
  try { localStorage.setItem('_crmPendingCall', JSON.stringify(ctx)); } catch(e) {}
  // Do NOT show the modal here — showing it immediately blocks the tel: link from
  // placing the call (iOS sees a DOM change and cancels the navigation).
  // The modal is shown instead via the touchstart listener when the user returns,
  // or via the startup check if the page reloaded.
}
function _clearPendingCall() {
  _pendingCall = null;
  try { localStorage.removeItem('_crmPendingCall'); } catch(e) {}
}

function initCallLogInterceptor() {
// Restore any pending call saved before this page load (iOS killed/reloaded the tab)
try {
  const saved = localStorage.getItem('_crmPendingCall');
  if (saved) {
    const ctx = JSON.parse(saved);
    const age = Date.now() - ctx.ts;
    if (age >= 500 && age <= 3600000) {
      _pendingCall = ctx;
      setTimeout(() => _showCallLogPrompt(ctx), 300);
    } else {
      localStorage.removeItem('_crmPendingCall');
    }
  }
} catch(e) {}

// Recovery: on any touch that is NOT on a tel: link, check for a pending call.
// Skipping tel: links is critical — if the user is tapping a phone number to
// start a new call, we must not show the modal (it blocks the call from placing).
// This fires on first tap back in the app after a call ends.
document.addEventListener('touchstart', function(e) {
  if (e.target.closest('a[href^="tel:"]')) return; // new call starting — skip
  try {
    const saved = localStorage.getItem('_crmPendingCall');
    if (!saved) return;
    const ctx = JSON.parse(saved);
    const age = Date.now() - ctx.ts;
    if (age >= 500 && age <= 3600000) {
      if (!_pendingCall) _pendingCall = ctx;
      _showCallLogPrompt(ctx);
    } else if (age > 3600000) {
      localStorage.removeItem('_crmPendingCall');
    }
  } catch(e) {}
}, { passive: true });

// PRIMARY INTERCEPTOR: touchend, not click.
// On iOS PWA, tapping a tel: link causes iOS to immediately open Phone before
// the 'click' event fires — JS is suspended mid-flight. 'touchend' fires
// before the native action, so we catch it here.
// Track start position to reject scroll-cancel-on-link (not a real tap).
let _txStart = 0, _tyStart = 0;
document.addEventListener('touchstart', function(e) {
  if (e.target.closest('a[href^="tel:"]')) {
    _txStart = e.touches[0].clientX;
    _tyStart = e.touches[0].clientY;
  }
}, { capture: true, passive: true });

let _lastTelIntercept = 0; // debounce: ignore click if touchend already fired
document.addEventListener('touchend', function(e) {
  const a = e.target.closest('a[href^="tel:"]');
  if (!a) return;
  const dx = Math.abs(e.changedTouches[0].clientX - _txStart);
  const dy = Math.abs(e.changedTouches[0].clientY - _tyStart);
  if (dx > 12 || dy > 12) return; // was a scroll, not a tap
  _lastTelIntercept = Date.now();
  _doTelIntercept(a);
}, { capture: true, passive: true });

// click kept as fallback for non-iOS or desktop testing
document.addEventListener('click', function(e) {
  if (Date.now() - _lastTelIntercept < 800) return; // already handled by touchend
  const a = e.target.closest('a[href^="tel:"]');
  if (!a) return;
  _doTelIntercept(a);
}, true);
}

function _doTelIntercept(a) {
  const locId = a.dataset.locId || null;
  // Never inherit currentPhysician for a location/office phone (data-loc-id present).
  // Only fall back to currentPhysician for provider personal numbers (no loc association).
  const providerId = a.dataset.providerId || (!locId && currentPhysician ? currentPhysician.id : null) || null;
  const phone = (a.getAttribute('href') || '').replace('tel:','');
  let displayName = '';
  if (providerId) {
    const phys = physicians.find(p => p.id === providerId);
    if (phys) displayName = fmtName(phys);
  }
  if (!displayName && locId) {
    const loc = practiceLocations.find(l => l.id === locId);
    if (loc) {
      const prac = practices.find(p => p.id === loc.practice_id);
      displayName = prac?.name || loc.label || loc.city || '';
    }
  }
  if (!displayName && currentPractice) displayName = currentPractice.name || '';
  if (!displayName) displayName = fmtPhone(phone) || phone;
  _savePendingCall({ providerId, locId, phone, displayName, ts: Date.now() });
  showToast('📞 Call saved — green bar will appear when you return', 'success');
}

function _showCallLogPrompt(ctx) {
const el = $('callLogBanner');
if (!el) return;
$('callLogBannerName').textContent = ctx.displayName;
el.style.display = 'flex'; // non-blocking banner — user can browse CRM freely during call
}

function _dismissCallPrompt() {
_clearPendingCall();
const el = $('callLogBanner');
if (el) el.style.display = 'none';
}

function _confirmCallLog() {
if (!_pendingCall) return;
const ctx = _pendingCall;
_dismissCallPrompt();
if (ctx.providerId) {
  // Provider call — open standard contact modal with provider context
  currentPhysician = physicians.find(p => p.id === ctx.providerId) || null;
  currentPractice = null;
  openContactModal();
  setTimeout(() => {
    prefixNote('Call: ');
    if (ctx.locId) {
      const sel = $('contactLocation');
      if (sel) { const opt = Array.from(sel.options).find(o => o.value === ctx.locId); if (opt) sel.value = ctx.locId; }
    }
    const lastAuthor = localStorage.getItem('lastCallLogAuthor');
    if (lastAuthor) $('authorName').value = lastAuthor;
  }, 60);
} else if (ctx.locId) {
  // Practice/location call — open location modal (pre-fills location + provider checklist)
  openLocationContactModal(ctx.locId);
  setTimeout(() => {
    prefixNote('Call: ');
    const lastAuthor = localStorage.getItem('lastCallLogAuthor');
    if (lastAuthor) $('authorName').value = lastAuthor;
  }, 60);
} else {
  currentPhysician = null;
  openContactModal();
  setTimeout(() => { prefixNote('Call: '); }, 60);
}
}
