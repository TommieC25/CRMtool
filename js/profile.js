// === js/profile.js === Physician profile, practice profile, practice contact modal

function renderProfile() {
const p = currentPhysician;
if (!p) return;
const logs = contactLogs[p.id] || [];
const assignments = physicianAssignments[p.id] || [];
const practiceIds = [...new Set(assignments.map(a => {
const loc = a.practice_locations || practiceLocations.find(l => l.id === a.practice_location_id);
return loc?.practice_id;
}).filter(Boolean))];
const associatedPractices = practices.filter(pr => practiceIds.includes(pr.id));
$('mainContent').innerHTML = `
<div class="profile-header">
${_prevView==='map'?'<button onclick="setView(\'map\')" style="margin-bottom:0.5rem;background:none;border:1px solid #1e3a8a;color:#1e3a8a;border-radius:6px;padding:0.3rem 0.7rem;font-size:0.8rem;cursor:pointer;">← Back to Map</button>':''}
<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;flex-wrap:wrap;">
<div class="profile-name" style="flex:1;">${fmtName(p)}</div>
<div style="display:flex;gap:0.5rem;flex-shrink:0;flex-wrap:wrap;">
<button class="edit-btn" onclick="startCallSession('${p.id}',null,'${(p.mobile_phone||'').replace(/'/g,'')}')" style="background:#059669;">📞 Call</button>
<button class="edit-btn" onclick="openContactModal()" style="background:#10b981;">+ Activity</button>
<button class="edit-btn" onclick="editPhysicianInfo()" style="background:#1e3a8a;">Edit</button>
<button class="delete-btn" onclick="deletePhysician()">Delete</button>
</div>
</div>
<div class="profile-practice" style="margin-top:0.35rem;">
${associatedPractices.length > 0 ? associatedPractices.map(pr => `<span style="cursor:pointer;text-decoration:underline;color:#1e3a8a;" onclick="event.stopPropagation();editPracticeFromProfile('${pr.id}')">${pr.name}</span>`).join(' | ') : 'No practice assigned'}
</div>
<div class="profile-meta">
${isStaffSpecialty(p.specialty)
  ? `${p.title?mi('Role',p.title):mi('Role','Office Staff')}${p.email?`<div class="meta-item" style="grid-column:1/-1"><div class="meta-label">Email</div><div class="meta-value" style="word-break:break-all;"><a href="mailto:${p.email}" style="color:#1e3a8a;">${p.email}</a></div></div>`:''}<div class="meta-item"><div class="meta-label">Type</div><div class="meta-value" style="color:#7c3aed;font-weight:600;">Staff Contact</div></div>`
  : `<div class="meta-item"><div class="meta-label">Priority Tier</div><div class="meta-value"><select onchange="quickSavePriority(this.value)" style="font-size:0.85rem;font-weight:700;padding:0.2rem 0.4rem;border:2px solid #1e3a8a;border-radius:6px;color:#1e3a8a;background:white;width:auto;cursor:pointer;">${['','1','2','3','4','5'].map(v=>v===''?`<option value="" ${!normPriority(p.priority)?'selected':''}>— set tier —</option>`:`<option value="${v}" ${normPriority(p.priority)===v?'selected':''}>P${v}</option>`).join('')}</select></div></div>${mi('Specialty',p.specialty||'Not set')}${mi('Degree',p.degree||'—')}${p.title?mi('Title',p.title):''}${p.email?`<div class="meta-item" style="grid-column:1/-1"><div class="meta-label">Email</div><div class="meta-value" style="word-break:break-all;"><a href="mailto:${p.email}" style="color:#1e3a8a;">${p.email}</a></div></div>`:''}${p.mobile_phone?`<div class="meta-item"><div class="meta-label">Mobile</div><div class="meta-value"><a href="tel:${p.mobile_phone}" data-provider-id="${p.id}" style="color:#1e3a8a;">${fmtPhone(p.mobile_phone)}</a></div></div>`:''}${mi('Academic Connection',p.academic_connection||p.um_connection||'None')}${mi('Projected Volume',p.proj_vol||p.mohs_volume||'Unknown')}`}
<div class="meta-item"><span class="meta-label">Sales Target</span><label style="display:inline-flex;align-items:center;gap:0.4rem;cursor:pointer;padding:0.25rem 0.6rem;border-radius:6px;background:${p.is_target?'#dc2626':'#e5e5e5'};color:${p.is_target?'white':'#666'};font-size:0.8rem;font-weight:700;transition:all 0.2s;" onclick="toggleTarget(event)"><input type="checkbox" ${p.is_target?'checked':''} style="width:16px;height:16px;min-width:16px;" readonly>${p.is_target?'YES':'NO'}</label></div>
${p.is_mobile?`<div class="meta-item" style="grid-column:1/-1"><span class="meta-label">Practice Type</span><span style="display:inline-block;background:#ede9fe;color:#6d28d9;font-weight:700;font-size:0.82rem;padding:0.2rem 0.6rem;border-radius:6px;">🏠 Mobile / Home Health — no fixed office</span></div>`:''}

${mi('Last Contact',p.last_contact||'Never')}${mi('Locations',assignments.length+' location'+(assignments.length!==1?'s':''))}
</div>
</div>
<div class="section">
<div class="section-header">
<h3>${isStaffSpecialty(p.specialty)?'Staff Contact':'Provider Profile'}</h3>
<div>
<button class="edit-btn" onclick="editPhysicianInfo()">Edit</button>
</div>
</div>
<div class="contact-grid">
${ci('✉️',isStaffSpecialty(p.specialty)?'Email':'Provider Email',p.email?`<a href="mailto:${p.email}">${p.email}</a>`:'')}
${ci('📱','Mobile Phone',p.mobile_phone?`<a href="tel:${p.mobile_phone}" data-provider-id="${p.id}">${fmtPhone(p.mobile_phone)}</a>`:'')}
${ci('📝','General Notes',p.general_notes)}
${!p.email&&!p.mobile_phone&&!p.general_notes?'<div class="empty-notice">Click Edit to add email, mobile, and notes</div>':''}
</div>
</div>
<div class="section">
<div class="section-header">
<h3>Practice Locations</h3>
<button class="edit-btn" onclick="openAssignLocationModal()">+ Assign Location</button>
</div>
${assignments.length === 0 ?
'<div class="empty-notice">No locations assigned. Click + Assign Location to add practice locations.</div>' :
'<div class="locations-grid">' +
assignments.map(assign => {
const loc = assign.practice_locations || practiceLocations.find(l => l.id === assign.practice_location_id);
if (!loc) return '';
const practiceName = loc.practices?.name || getPracticeName(loc.practice_id);
return `
<div class="location-card ${assign.is_primary ? 'primary' : ''}">
<div class="location-card-header">
<div class="location-label" style="cursor:pointer;flex:1;" onclick="viewLocation('${loc.id}')">
${loc.label || 'Office'}
${practiceName ? `<span class="practice-badge" title="View practice">🏢 ${practiceName}</span>` : ''}
</div>
<div class="location-actions">
${assign.is_primary
  ? '<span style="font-size:0.72rem;background:#fef3c7;color:#92400e;border:1px solid #fbbf24;border-radius:4px;padding:0.15rem 0.5rem;font-weight:700;">⭐ Primary</span>'
  : `<button onclick="setPrimaryLocation('${assign.id}')" title="Make this the primary location" style="font-size:0.72rem;background:white;border:1px solid #d1d5db;color:#555;border-radius:4px;padding:0.15rem 0.5rem;font-weight:600;cursor:pointer;touch-action:manipulation;">Set Primary</button>`}
<button class="icon-btn" onclick="editLocationDetails('${loc.id}')" title="Edit">✏️</button>
<button class="icon-btn" onclick="removeAssignment('${assign.id}')" title="Remove">🗑️</button>
</div>
</div>
<div class="location-details" style="cursor:pointer;" onclick="viewLocation('${loc.id}')">${locDetails(loc)}</div>
</div>
`}).join('') +
'</div>'
}
</div>
<div class="section">
<div class="section-header">
<h3>Activity Log</h3>
<div style="display:flex;gap:0.5rem;">
<button class="edit-btn" onclick="openAddTaskModal('${p.id}',null)">+ Task</button>
<button class="edit-btn" onclick="openContactModal()">+ Add Activity</button>
</div>
</div>
${logs.length === 0 ?
'<div class="empty-notice">No activity yet. Click + Add Activity to record your first call or visit.</div>' :
'<div class="contact-entries">' + logs.map(e => renderProfileEntry(e)).join('') + '</div>'
}
</div>
`;
}

async function quickSavePriority(val) {
if (!currentPhysician) return;
const priority = val || null;
try {
const {error} = await db.from('providers').update({priority}).eq('id', currentPhysician.id);
if (error) throw error;
currentPhysician.priority = priority;
// update sidebar badge without full re-render
renderList();
showToast('Priority updated to ' + (val ? 'P'+val : 'unset'), 'success');
} catch(e) { showToast('Error: '+e.message,'error'); }
}

async function renderPracticeProfile() {
const p = currentPractice;
const locations = practiceLocations.filter(l => l.practice_id === p.id);
const practicePhysicians = physicians.filter(phys => {
const assigns = physicianAssignments[phys.id] || [];
return assigns.some(a => {
const loc = a.practice_locations || practiceLocations.find(l => l.id === a.practice_location_id);
return loc && loc.practice_id === p.id;
});
});
$('mainContent').innerHTML = `
<div class="profile-header">
${_prevView==='map'?'<button onclick="setView(\'map\')" style="margin-bottom:0.5rem;background:none;border:1px solid #1e3a8a;color:#1e3a8a;border-radius:6px;padding:0.3rem 0.7rem;font-size:0.8rem;cursor:pointer;">← Back to Map</button>':''}
<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;flex-wrap:wrap;">
<div class="profile-name" style="flex:1;">${p.name}</div>
<div style="display:flex;gap:0.5rem;flex-shrink:0;flex-wrap:wrap;">
<button class="edit-btn" onclick="startCallSession(null,null,'')" style="background:#059669;">📞 Call</button>
<button class="edit-btn" onclick="openPracticeContactModal()" style="background:#10b981;">+ Activity</button>
<button class="edit-btn" onclick="editPractice()" style="background:#1e3a8a;">Edit</button>
</div>
</div>
<div class="profile-practice">${p.website ? `<a href="${p.website.match(/^https?:\/\//)?p.website:'https://'+p.website}" target="_blank">${p.website}</a>` : 'No website'}</div>
<div class="profile-meta">
${mi('Locations',locations.length)}${mi('Providers',practicePhysicians.length)}${mi('Cities',[...new Set(locations.map(l=>l.city).filter(Boolean))].join(', ')||'N/A')}
</div>
</div>
<div class="section">
<div class="section-header">
<h3>Practice Details</h3>
<div>
<button class="edit-btn" onclick="editPractice()">Edit</button>
<button class="delete-btn" onclick="deletePractice()">Delete</button>
</div>
</div>
<div class="contact-grid">${(()=>{const pLocs=practiceLocations.filter(l=>l.practice_id===p.id);const pEmail=pLocs.map(l=>l.practice_email).find(Boolean)||'';const pPhone=pLocs.map(l=>l.phone).find(Boolean)||'';const pPhoneLoc=pLocs.find(l=>l.phone)||null;const pFax=pLocs.map(l=>l.fax).find(Boolean)||'';const pHours=pLocs.map(l=>l.office_hours).find(Boolean)||'';const pStaff=pLocs.map(l=>l.office_staff).find(Boolean)||'';const pBestDays=pLocs.map(l=>l.best_days).find(Boolean)||'';const wSite=p.website?`<a href="${p.website.match(/^https?:\/\//)?p.website:'https://'+p.website}" target="_blank" style="color:#1e3a8a;">${p.website}</a>`:'';const practiceEmail=p.email||'';return (wSite?ci('🌐','Website',wSite):'')+ci('✉️','Email',practiceEmail?`<a href="mailto:${practiceEmail}">${practiceEmail}</a>`:pEmail?`<a href="mailto:${pEmail}">${pEmail}</a>`:'')+ci('📞','Phone',pPhone?`<a href="tel:${pPhone.replace(/\D/g,'')}"${pPhoneLoc?` data-loc-id="${pPhoneLoc.id}"`:''}>${fmtPhone(pPhone)}</a>`:'')+ci('📠','Fax',pFax?fmtPhone(pFax):'')+ci('🕐','Office Hours',pHours)+ci('👥','Office Staff',pStaff)+ci('📅','Best Days',pBestDays)+ci('📝','Notes',p.general_notes)||(!pEmail&&!practiceEmail&&!p.general_notes&&!pPhone?'<div class="empty-notice">No details for this practice</div>':'');})()}</div>
</div>
<div class="section">
<div class="section-header">
<h3>Locations</h3>
<button class="edit-btn" onclick="openLocationModal('${p.id}')">+ Add Location</button>
</div>
${locations.length === 0 ?
'<div class="empty-notice">No locations yet. Click + Add Location to add an address.</div>' :
'<div class="locations-grid">' +
locations.map(loc => `
<div class="location-card">
<div class="location-card-header">
<div class="location-label" style="cursor:pointer;text-decoration:underline;flex:1;" onclick="viewLocation('${loc.id}')">${loc.label || 'Office'}</div>
<div class="location-actions">
<button class="icon-btn" onclick="editLocationDetails('${loc.id}')" title="Edit">✏️</button>
<button class="icon-btn" onclick="deleteLocation('${loc.id}')" title="Delete">🗑️</button>
</div>
</div>
<div class="location-details" style="cursor:pointer;" onclick="viewLocation('${loc.id}')">${locDetails(loc)}</div>
</div>
`).join('') +
'</div>'
}
</div>
<div class="section">
<div class="section-header">
<h3>Activity Log</h3>
<div style="display:flex;gap:0.5rem;">
<button class="edit-btn" onclick="openAddTaskForPractice()">+ Task</button>
<button class="edit-btn" onclick="startCallSession(null,null,'')" style="background:#059669;">📞 Call</button>
<button class="edit-btn" onclick="openPracticeContactModal()">+ Activity</button>
</div>
</div>
<div id="practiceActivityContent"><div class="loading">Loading activity...</div></div>
</div>
<div class="section">
<div class="section-header">
<h3>Providers & Staff</h3>
<button class="edit-btn" onclick="openAssignPhysicianModal()">+ Assign</button>
</div>
${practicePhysicians.length === 0 ?
'<div class="empty-notice">No providers or staff assigned to this practice yet.</div>' :
'<div class="contact-grid">' +
practicePhysicians.map(phys => {
const isStaffP = isStaffSpecialty(phys.specialty);
return `<div class="contact-item" style="cursor: pointer;" onclick="setView('physicians');viewPhysician('${phys.id}')">
<div class="contact-icon">${isStaffP ? '👤' : '👨‍⚕️'}</div>
<div class="contact-item-content">
<div class="contact-item-label">${isStaffP ? (phys.title || 'Staff') : (normPriority(phys.priority) ? 'P'+normPriority(phys.priority) : 'No tier')}</div>
<div class="contact-item-value">${fmtName(phys)}</div>
</div>
</div>`;
}).join('') +
'</div>'
}
</div>
`;
await loadPracticeActivity(p.id);
}

async function renderLocationProfile(loc) {
const practice = practices.find(p => p.id === loc.practice_id);
const locPhysicians = physicians.filter(phys => {
const assigns = physicianAssignments[phys.id] || [];
return assigns.some(a => a.practice_location_id === loc.id);
});
$('mainContent').innerHTML = `
<div class="profile-header">
<div style="font-size:0.85rem;margin-bottom:0.5rem;"><span style="cursor:pointer;color:#1e3a8a;text-decoration:underline;" onclick="viewPractice('${practice?.id}')">← ${practice?.name || 'Practice'}</span></div>
<div class="profile-name">${loc.label || 'Office'}</div>
<div class="profile-practice">${[fmtSuiteAddr(loc.address), loc.city, loc.zip].filter(Boolean).join(', ')}</div>
<div class="profile-meta">
${mi('Providers', locPhysicians.length)}${mi('City', loc.city || '—')}${mi('Zip', loc.zip || '—')}
</div>
</div>
<div class="section">
<div class="section-header">
<h3>Location Details</h3>
<div>
<button class="edit-btn" onclick="editLocationDetails('${loc.id}')">Edit</button>
<button class="delete-btn" onclick="deleteLocation('${loc.id}')">Delete</button>
</div>
</div>
<div class="contact-grid">
${ci('📍','Address',locAddr(loc))}${ci('📞','Phone',loc.phone?locPhone(loc.phone,loc.id):'')}${ci('📠','Fax',loc.fax?fmtPhone(loc.fax):'')}${ci('✉️','Email',loc.practice_email?`<a href="mailto:${loc.practice_email}">${loc.practice_email}</a>`:'')}${ci('🕐','Office Hours',loc.office_hours||'')}${ci('👥','Office Staff',loc.office_staff||'')}${ci('👤','Receptionist',loc.receptionist_name||'')}${ci('📅','Best Days',loc.best_days||'')}${ci('📝','General Info',loc.notes||'')}
${!loc.phone&&!loc.practice_email&&!loc.office_hours&&!loc.office_staff&&!loc.receptionist_name&&!loc.best_days&&!loc.fax&&!loc.notes?'<div class="empty-notice">No details recorded. Use Edit to add details.</div>':''}
</div>
</div>
<div class="section">
<div class="section-header">
<h3>Providers & Staff</h3>
</div>
${locPhysicians.length === 0 ?
'<div class="empty-notice">No providers assigned to this location.</div>' :
'<div class="contact-grid">' + locPhysicians.map(phys => {
const isStaffL = isStaffSpecialty(phys.specialty);
return `
<div class="contact-item" style="cursor:pointer;" onclick="setView('physicians');viewPhysician('${phys.id}')">
<div class="contact-icon">${isStaffL ? '👤' : '👨‍⚕️'}</div>
<div class="contact-item-content">
<div class="contact-item-label">${isStaffL ? (phys.title || 'Staff') : (normPriority(phys.priority) ? 'P'+normPriority(phys.priority) : 'No tier')}${!isStaffL && phys.specialty ? ' · ' + phys.specialty : ''}</div>
<div class="contact-item-value">${fmtName(phys)}</div>
</div>
</div>`;
}).join('') + '</div>'}
</div>
<div class="section">
<div class="section-header">
<h3>Activity Log</h3>
<div style="display:flex;gap:0.5rem;">
<button class="edit-btn" onclick="openAddTaskModal(null,'${loc.id}')">+ Task</button>
<button class="edit-btn" onclick="startCallSession(null,'${loc.id}','${(loc.phone||'').replace(/'/g,'')}')">📞 Call</button>
<button class="edit-btn" onclick="openLocationContactModal('${loc.id}')">+ Activity</button>
</div>
</div>
<div id="locationActivityContent"><div class="loading">Loading activity...</div></div>
</div>
`;
loadLocationActivity(loc.id);
}

async function loadLocationActivity(locId) {
try {
const { data: logs, error } = await db.from('contact_logs')
.select('*')
.eq('practice_location_id', locId)
.order('contact_date', { ascending: false })
.order('created_at', { ascending: false })
.limit(50);
if (error) throw error;
const el = $('locationActivityContent');
if (!el) return;
if (!logs || logs.length === 0) {
el.innerHTML = '<div class="empty-notice">No activity logged yet. Click + Log Call to record your first call or visit.</div>';
return;
}
el.innerHTML = '<div class="contact-entries">' + logs.map(e => {
const phys = e.provider_id ? physicians.find(p => p.id === e.provider_id) : null;
return renderLogEntry(e, { physName: phys ? fmtName(phys) : null, editable: true, editFn: `editPracticeNote('${e.id}')`, deleteFn: `deletePracticeNote('${e.id}')`, onClick: phys ? `viewPhysician('${phys.id}')` : undefined, full: true, showTimestamp: true });
}).join('') + '</div>';
} catch(err) {
const el = $('locationActivityContent');
if (el) el.innerHTML = '<div class="empty-notice">Could not load activity</div>';
}
}

async function loadPracticeActivity(practiceId) {
const locIds = practiceLocations.filter(l => l.practice_id === practiceId).map(l => l.id);
if (locIds.length === 0) {
const el = $('practiceActivityContent');
if (el) el.innerHTML = '<div class="empty-notice">No locations assigned yet. Add locations to log activity.</div>';
return;
}
try {
const { data: logs, error } = await db.from('contact_logs').select('*').in('practice_location_id', locIds).order('contact_date', { ascending: false }).order('created_at', { ascending: false });
if (error) throw error;
const el = $('practiceActivityContent');
if (!el) return;
if (!logs || logs.length === 0) {
el.innerHTML = '<div class="empty-notice">No activity logged yet. Click + Log Call to record your first call or visit.</div>';
return;
}
el.innerHTML = '<div class="contact-entries">' + logs.map(e => {
const phys = e.provider_id ? physicians.find(p => p.id === e.provider_id) : null;
const isTask = !!e.reminder_date;
const editFn = isTask ? `openTaskDetailModal('${e.id}')` : `editPracticeNote('${e.id}')`;
const deleteFn = e.provider_id ? `deleteNoteFromActivity('${e.id}','${e.provider_id}')` : `deletePracticeNote('${e.id}')`;
const onClick = isTask ? `openTaskDetailModal('${e.id}')` : (phys ? `viewPhysician('${phys.id}')` : undefined);
return renderLogEntry(e, { physName: phys ? fmtName(phys) : null, editable: true, editFn, deleteFn, onClick, full: true, showTimestamp: true });
}).join('') + '</div>';
} catch(e) {
const el = $('practiceActivityContent');
if (el) el.innerHTML = '<div class="empty-notice">Could not load activity</div>';
}
}

function openPracticeContactModal() {
editingContactId = null;
$('contactForm').reset();
$('contactModalTitle').textContent = 'Log Practice Call';
$('authorName').value = localStorage.getItem('lastCallLogAuthor') || '';
$('contactSaveBtn').textContent = 'Save Note';
$('contactSaveBtn').className = 'btn-primary';
setToday();
const locations = practiceLocations.filter(l => l.practice_id === currentPractice.id);
const select = $('contactLocation');
select.innerHTML = locations.length === 1
? `<option value="${locations[0].id}">${locations[0].address || locations[0].label}, ${locations[0].city || ''}</option>`
: '<option value="">Select location...</option>' + locations.map(l => `<option value="${l.id}">${l.address || l.label || 'Office'}, ${l.city || ''}</option>`).join('');
$('locationSelectRow').style.display = locations.length <= 1 ? 'none' : 'block';
if (locations.length === 1) select.value = locations[0].id;
const practPhys = physicians.filter(ph => {
const assigns = physicianAssignments[ph.id] || [];
return assigns.some(a => locations.some(l => l.id === a.practice_location_id));
});
let physRow = $('practicePhysSelectRow');
if (!physRow) {
physRow = document.createElement('div');
physRow.id = 'practicePhysSelectRow';
$('locationSelectRow').parentElement.insertBefore(physRow, $('locationSelectRow'));
}
if (practPhys.length > 0) {
physRow.innerHTML = `<label>Who was present? <span style="font-weight:400;color:#aaa;text-transform:none;letter-spacing:0;">(optional — check if provider was there)</span></label>
<div id="practicePhysCheckboxes" style="max-height:180px;overflow-y:auto;border:2px solid #e5e5e5;border-radius:8px;padding:0.5rem;">
${practPhys.map(p => `<div class="selector-option" style="margin-bottom:0.25rem;" onclick="var c=this.querySelector('input');c.checked=!c.checked;">
<input type="checkbox" value="${p.id}" class="practice-phys-cb">
<span class="selector-option-label">${fmtName(p)}</span>
</div>`).join('')}
<div class="selector-option" style="margin-bottom:0.25rem;background:#fff9e6;border:1px solid #fcd34d;" onclick="var c=this.querySelector('input');c.checked=!c.checked;var n=document.getElementById('officeStaffNameInput');if(n)n.style.display=c.checked?'block':'none';">
<input type="checkbox" value="office_staff" class="practice-phys-cb" id="officeStaffCb">
<span class="selector-option-label">📋 Office Staff (enter name)</span>
</div>
</div>
<input type="text" id="officeStaffNameInput" placeholder="Office staff name (optional)" style="display:none;margin-top:0.25rem;padding:0.5rem;font-size:0.85rem;border:1px solid #fcd34d;border-radius:6px;width:100%;">
<div style="font-size:0.75rem;color:#999;margin-top:0.25rem;">Leave unchecked to log a location-level note with no physician attached</div>`;
physRow.style.display = 'block';
if (practPhys.length === 1) physRow.querySelector('.practice-phys-cb').checked = true;
} else {
physRow.innerHTML = `<label>Who was present? <span style="font-weight:400;color:#aaa;text-transform:none;letter-spacing:0;">(optional)</span></label>
<div style="padding:0.5rem;border:2px solid #e5e5e5;border-radius:8px;">
<div class="selector-option" style="background:#fff9e6;border:1px solid #fcd34d;" onclick="var c=this.querySelector('input');c.checked=!c.checked;var n=document.getElementById('officeStaffNameInput');if(n)n.style.display=c.checked?'block':'none';">
<input type="checkbox" value="office_staff" class="practice-phys-cb" id="officeStaffCb">
<span class="selector-option-label">📋 Office Staff (enter name)</span>
</div>
</div>
<input type="text" id="officeStaffNameInput" placeholder="Office staff name (optional)" style="display:none;margin-top:0.25rem;padding:0.5rem;font-size:0.85rem;border:1px solid #fcd34d;border-radius:6px;width:100%;">
<div style="font-size:0.75rem;color:#999;margin-top:0.25rem;">No physicians assigned yet — note will be saved at the location level.</div>`;
physRow.style.display = 'block';
}
$('setReminder').checked = false;
if($('reminderRow'))$('reminderRow').style.display='block';
$('contactForm').onsubmit = function(ev) { savePracticeContact(ev); return false; };
$('contactModal').classList.add('active');
}

async function savePracticeContact(e) {
e.preventDefault();
const cbs = document.querySelectorAll('.practice-phys-cb:checked');
const selectedValues = [...cbs].map(cb => cb.value);
const physIds = selectedValues.filter(v => v !== 'office_staff');
const hasOfficeStaff = selectedValues.includes('office_staff');
const staffName = ($('officeStaffNameInput')?.value || '').trim();
const tv = $('contactTime').value, nv = $('contactNotes').value;
const locVal = $('contactLocation').value || null;
const reminderOn = $('setReminder').checked;
const dateVal = $('contactDate').value, authorVal = $('authorName').value;
await withSave('contactSaveBtn', 'Save Note', async() => {
const entries = [];
const baseNote = tv ? `[${tv}] ${nv}` : nv;
// Activity entries — clean, no reminder_date, no embedded task text
physIds.forEach(pid => {
entries.push({provider_id:pid,contact_date:dateVal,author:authorVal,notes:baseNote,practice_location_id:locVal});
});
// Office staff entry always saves with null provider_id
if (hasOfficeStaff) {
const staffPrefix = staffName ? `[Office Staff: ${staffName}] ` : '[Office Staff] ';
const staffNote = tv ? `[${tv}] ${staffPrefix}${nv}` : `${staffPrefix}${nv}`;
entries.push({provider_id:null,contact_date:dateVal,author:authorVal,notes:staffNote,practice_location_id:locVal});
}
// If nothing selected, save as pure location-level note (provider_id = null)
if (entries.length === 0) {
entries.push({provider_id:null,contact_date:dateVal,author:authorVal,notes:baseNote,practice_location_id:locVal});
}
const {error} = await db.from('contact_logs').insert(entries);
if (error) throw error;
await Promise.all(physIds.map(pid => db.from('providers').update({last_contact:dateVal}).eq('id',pid)));
const label = physIds.length > 0 ? `Call logged for ${physIds.length} physician${physIds.length!==1?'s':''}` : 'Location note logged';
showToast(label, 'success');
const taskPhysId = physIds.length > 0 ? physIds[0] : null;
closeContactModal();$('contactForm').onsubmit=function(ev){saveContact(ev);return false;};const _psr=$('practicePhysSelectRow');if(_psr)_psr.style.display='none';if(reminderOn)openAddTaskModal(taskPhysId,locVal);
physIds.forEach(pid=>{const p=physicians.find(ph=>ph.id===pid);if(p)p.last_contact=dateVal;});saveCrmCache();
renderPracticeProfile();loadPracticeActivity(currentPractice.id);
});
}

function openLocationContactModal(locId) {
const loc = practiceLocations.find(l => l.id === locId);
if (!loc) return;
editingContactId = null;
$('contactForm').reset();
$('contactModalTitle').textContent = 'Log Call / Visit';
$('authorName').value = localStorage.getItem('lastCallLogAuthor') || '';
$('contactSaveBtn').textContent = 'Save Note';
$('contactSaveBtn').className = 'btn-primary';
setToday();
// Pre-set location — not editable
const select = $('contactLocation');
select.innerHTML = `<option value="${loc.id}">${loc.label || loc.address || 'Office'}${loc.city ? ', ' + loc.city : ''}</option>`;
select.value = loc.id;
$('locationSelectRow').style.display = 'none';
// Hide also-attended row
const alsoRow = $('alsoAttendedRow');
if (alsoRow) alsoRow.style.display = 'none';
// Physician checklist (optional)
const locPhys = physicians.filter(ph => (physicianAssignments[ph.id] || []).some(a => a.practice_location_id === locId));
let physRow = $('practicePhysSelectRow');
if (!physRow) {
physRow = document.createElement('div');
physRow.id = 'practicePhysSelectRow';
$('locationSelectRow').parentElement.insertBefore(physRow, $('locationSelectRow'));
}
const physHtml = locPhys.length > 0
? locPhys.map(p => `<div class="selector-option" style="margin-bottom:0.25rem;" onclick="var c=this.querySelector('input');c.checked=!c.checked;"><input type="checkbox" value="${p.id}" class="loc-phys-cb"><span class="selector-option-label">${fmtName(p)}</span></div>`).join('')
: '<div style="font-size:0.8rem;color:#999;padding:0.25rem;">No physicians assigned to this location yet</div>';
physRow.innerHTML = `<label style="font-size:0.75rem;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:0.25rem;">Who was present? <span style="font-weight:400;color:#aaa;text-transform:none;letter-spacing:0;">(optional)</span></label><div style="max-height:180px;overflow-y:auto;border:2px solid #e5e5e5;border-radius:8px;padding:0.5rem;">${physHtml}</div><div style="font-size:0.75rem;color:#999;margin-top:0.25rem;">Leave unchecked to save as a location-level note with no physician attached</div>`;
physRow.style.display = 'block';
$('setReminder').checked = false;
if($('reminderRow'))$('reminderRow').style.display='block';
$('contactForm').onsubmit = function(ev) { saveLocationContact(ev, locId); return false; };
$('contactModal').classList.add('active');
}

async function saveLocationContact(e, locId) {
e.preventDefault();
const tv = $('contactTime').value, nv = $('contactNotes').value;
const dateVal = $('contactDate').value, authorVal = $('authorName').value;
const reminderOn = $('setReminder').checked;
const cbs = document.querySelectorAll('.loc-phys-cb:checked');
const physIds = [...cbs].map(cb => cb.value);
const noteText = tv ? `[${tv}] ${nv}` : nv;
// Activity entries — clean, no reminder_date, no embedded task text
await withSave('contactSaveBtn', 'Save Note', async () => {
let entries;
if (physIds.length > 0) {
entries = physIds.map(pid => ({ provider_id: pid, contact_date: dateVal, author: authorVal, notes: noteText, practice_location_id: locId }));
} else {
entries = [{ provider_id: null, contact_date: dateVal, author: authorVal, notes: noteText, practice_location_id: locId }];
}
const { error } = await db.from('contact_logs').insert(entries);
if (error) throw error;
await Promise.all(physIds.map(pid => db.from('providers').update({ last_contact: dateVal }).eq('id', pid)));
const label = physIds.length > 0 ? `Note logged for ${physIds.length} physician${physIds.length !== 1 ? 's' : ''}` : 'Location note logged';
showToast(label, 'success');
const taskPhysId = physIds.length > 0 ? physIds[0] : null;
closeContactModal();$('contactForm').onsubmit=function(ev){saveContact(ev);return false;};const _psr2=$('practicePhysSelectRow');if(_psr2)_psr2.style.display='none';if(reminderOn)openAddTaskModal(taskPhysId,locId);
physIds.forEach(pid=>{const p=physicians.find(ph=>ph.id===pid);if(p)p.last_contact=dateVal;});saveCrmCache();
const _updLoc=practiceLocations.find(l=>l.id===locId);if(_updLoc){currentPractice=practices.find(p=>p.id===_updLoc.practice_id);renderLocationProfile(_updLoc);}
});
}
