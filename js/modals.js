// === js/modals.js === Provider modal, practice modal, location modal, assign modals

// --- Provider modal ---
function openPhysicianModal() {
editMode=false;selectedPracticeId=null;selectedLocationIds=[];$('modalTitle').textContent='Add Provider';
$('physicianForm').reset();setFields({priority:'',specialty:''});$('isTarget').checked=false;
$('newPracticeFields').style.display='none';$('locationSelector').style.display='none';
$('physicianSaveBtn').textContent='Save Provider';$('physicianSaveBtn').className='btn-primary';
populatePracticeOptions();$('physicianModal').classList.add('active');
}
function closeModal(id){$(id).classList.remove('active');}
function closePhysicianModal(){closeModal('physicianModal');}
function populatePracticeOptions() {
const container = $('practiceOptions');
const search = ($('practiceSearchInput')?.value || '').toLowerCase();
const filtered = search ? practices.filter(p => p.name.toLowerCase().includes(search)) : practices;
container.innerHTML = filtered.map(p => `
<div class="selector-option ${selectedPracticeId === p.id ? 'selected' : ''}"
onclick="selectPractice('${p.id}')">
<input type="radio" name="practice" ${selectedPracticeId === p.id ? 'checked' : ''}>
<span class="selector-option-label">${p.name}</span>
</div>
`).join('') || '<div class="empty-notice">No practices found.</div>';
}
function filterPracticeOptions() { populatePracticeOptions(); }
function filterAssignLocationOptions() {
const search = ($('assignLocationSearch')?.value || '').toLowerCase();
document.querySelectorAll('#assignLocationOptions > div').forEach(group => {
const name = group.querySelector('div[style]')?.textContent?.toLowerCase() || '';
const locs = group.querySelectorAll('.selector-option');
let anyVisible = false;
locs.forEach(loc => {
const text = loc.textContent.toLowerCase();
const match = !search || name.includes(search) || text.includes(search);
loc.style.display = match ? '' : 'none';
if (match) anyVisible = true;
});
group.style.display = anyVisible ? '' : 'none';
});
}
function selectPractice(practiceId) {
selectedPracticeId = practiceId;
populatePracticeOptions();
populateLocationOptions(practiceId);
$('locationSelector').style.display = 'block';
$('newPracticeFields').style.display = 'none';
}
function populateLocationOptions(practiceId) {
const locations = practiceLocations.filter(l => l.practice_id === practiceId);
const container = $('locationOptions');
if (locations.length === 0) {
container.innerHTML = '<div class="empty-notice">No locations for this practice. Add one below.</div>';
return;
}
container.innerHTML = locations.map(loc => `
<div class="selector-option ${selectedLocationIds.includes(loc.id) ? 'selected' : ''}"
onclick="toggleLocationSelection('${loc.id}')">
<input type="checkbox" ${selectedLocationIds.includes(loc.id) ? 'checked' : ''}>
<div>
<span class="selector-option-label">${loc.label || 'Office'}</span>
<div class="selector-option-sub">${loc.city || ''} ${loc.zip || ''}</div>
</div>
</div>
`).join('');
}
function toggleLocationSelection(locationId) {
const index = selectedLocationIds.indexOf(locationId);
if (index === -1) {
selectedLocationIds.push(locationId);
} else {
selectedLocationIds.splice(index, 1);
}
populateLocationOptions(selectedPracticeId);
}
function toggleNewPractice() {
const fields = $('newPracticeFields');
fields.style.display = fields.style.display === 'none' ? 'block' : 'none';
if (fields.style.display === 'block') {
selectedPracticeId = null;
populatePracticeOptions();
$('locationSelector').style.display = 'none';
}
}
async function toggleNewLocation() {
let practiceId = selectedPracticeId;
if (!practiceId) {
const npn = $('newPracticeName').value;
if (!npn) { showToast('Please select or create a practice first', 'error'); return; }
try {
const {data:np,error} = await db.from('practices').insert({name:npn}).select().single();
if (error) throw error;
practices.push(np);
practiceId = np.id;
selectedPracticeId = np.id;
showToast('Practice created: ' + npn, 'success');
} catch(e) { showToast('Error creating practice: ' + e.message, 'error'); return; }
}
closePhysicianModal();
openLocationModal(practiceId);
}
async function toggleAdvancedSolution(e) {
e.preventDefault();e.stopPropagation();
if(!currentPhysician) return;
const newVal = !currentPhysician.advanced_solution;
const{error}=await db.from('providers').update({advanced_solution:newVal}).eq('id',currentPhysician.id);
if(error){showToast('Error updating AS: '+error.message,'error');return;}
currentPhysician.advanced_solution=newVal;
const idx=physicians.findIndex(p=>p.id===currentPhysician.id);
if(idx>=0) physicians[idx].advanced_solution=newVal;
renderProfile();
showToast(newVal?'Marked as Advanced Solution':'Removed Advanced Solution','success');
}
async function toggleTarget(e) {
e.preventDefault();e.stopPropagation();
if(!currentPhysician) return;
const newVal = !currentPhysician.is_target;
const{error}=await db.from('providers').update({is_target:newVal}).eq('id',currentPhysician.id);
if(error){showToast('Error updating Target: '+error.message,'error');return;}
currentPhysician.is_target=newVal;
const idx=physicians.findIndex(p=>p.id===currentPhysician.id);
if(idx>=0) physicians[idx].is_target=newVal;
renderProfile();
showToast(newVal?'Marked as Sales Target':'Removed from Sales Targets','success');
}
function editPhysicianInfo() {
editMode=true;const p=currentPhysician;$('modalTitle').textContent='Edit Provider';
setFields({firstName:p.first_name,lastName:p.last_name,physicianEmail:p.email||'',mobilePhone:p.mobile_phone||'',priority:normPriority(p.priority)||'',specialty:p.specialty||'',umConnection:p.academic_connection||p.um_connection||'',patientVolume:p.proj_vol||p.mohs_volume||'',physicianGeneralNotes:p.general_notes||'',degree:p.degree||'',staffTitle:p.title||''});$('isTarget').checked=!!p.is_target;$('isMobile').checked=!!p.is_mobile;
$('practiceSelector').style.display='none';$('locationSelector').style.display='none';
$('physicianSaveBtn').textContent='Save Provider';$('physicianSaveBtn').className='btn-primary';$('physicianModal').classList.add('active');
}
async function savePhysician(e) {
e.preventDefault();
const data = {first_name:$('firstName').value,last_name:$('lastName').value,email:$('physicianEmail').value||null,mobile_phone:$('mobilePhone').value||null,priority:$('priority').value||null,specialty:$('specialty').value||null,academic_connection:$('umConnection').value||null,proj_vol:$('patientVolume').value||null,mohs_volume:null,general_notes:$('physicianGeneralNotes').value||null};
const degreeVal=normDegree($('degree').value)||null;const titleVal=$('staffTitle').value||null;
data.degree=degreeVal;data.title=titleVal;data.is_target=!!$('isTarget').checked;data.is_mobile=!!$('isMobile').checked;
await withSave('physicianSaveBtn','Save Provider',async()=>{
if(editMode){if(!currentPhysician){showToast('Error: provider context lost. Close and try again.','error');return;}const{error}=await db.from('providers').update(data).eq('id',currentPhysician.id);if(error)throw error;Object.assign(currentPhysician,data);renderProfile();showToast('Provider updated','success');
}else{
let practiceId=selectedPracticeId;const npn=$('newPracticeName').value;
if(npn&&!practiceId){const{data:np,error:pe}=await db.from('practices').insert({name:npn}).select().single();if(pe)throw pe;practiceId=np.id;practices.push(np);}
const{data:newP,error}=await db.from('providers').insert(data).select().single();if(error)throw error;
if(selectedLocationIds.length>0){const a=selectedLocationIds.map((lid,i)=>({provider_id:newP.id,practice_location_id:lid,is_primary:i===0}));const{error:ae}=await db.from('provider_location_assignments').insert(a);if(ae)throw ae;}
else if(practiceId){
const existingLocs=practiceLocations.filter(l=>l.practice_id===practiceId);
if(existingLocs.length>0){
const{error:ae}=await db.from('provider_location_assignments').insert({provider_id:newP.id,practice_location_id:existingLocs[0].id,is_primary:true});
if(ae)throw ae;
}else{
const{data:newLoc,error:le}=await db.from('practice_locations').insert({practice_id:practiceId,label:'Main Office'}).select().single();
if(le)throw le;
const{error:ae}=await db.from('provider_location_assignments').insert({provider_id:newP.id,practice_location_id:newLoc.id,is_primary:true});
if(ae)throw ae;
}
}
physicians.push(newP);physicians.sort((a,b)=>a.last_name.localeCompare(b.last_name));showToast('Provider added','success');
await refreshAssignments(newP.id);
}
renderList();saveCrmCache();setTimeout(()=>closePhysicianModal(),500);
});
}
async function deletePhysician() {
if(!currentPhysician)return;
if(!confirm(`Delete ${fmtName(currentPhysician)}?`))return;
try{
updateSyncIndicators('syncing');
const pid=currentPhysician.id;
const{error}=await db.rpc('delete_provider',{provider_id_param:pid});
if(error)throw error;
physicians=physicians.filter(ph=>ph.id!==pid);currentPhysician=null;renderList();renderEmptyState();
showToast('Deleted','success');updateSyncIndicators('synced');
}catch(e){console.error('Delete error:',e);showToast('Error: '+e.message,'error');updateSyncIndicators('error');}
}

// --- Practice modal ---
function openPracticeModal(){editingPracticeId=null;locationsToDelete=[];$('practiceModalTitle').textContent='Add Practice';$('practiceForm').reset();$('practiceEmail').value='';$('practiceAddressSection').style.display='';$('practiceLocationsEditSection').style.display='none';$('practiceSaveBtn').textContent='Save Practice';$('practiceSaveBtn').className='btn-primary';$('practiceModal').classList.add('active');}
function closePracticeModal(){closeModal('practiceModal');}
function editPractice(){editingPracticeId=currentPractice.id;locationsToDelete=[];$('practiceModalTitle').textContent='Edit Practice';const _locEmail=practiceLocations.filter(l=>l.practice_id===currentPractice.id).map(l=>l.practice_email).find(Boolean)||'';setFields({practiceName:currentPractice.name,practiceWebsite:currentPractice.website||'',practiceNotes:currentPractice.general_notes||'',practiceEmail:currentPractice.email||_locEmail});$('practiceAddressSection').style.display='none';populateLocationEditCards(currentPractice.id);$('practiceLocationsEditSection').style.display='';$('practiceSaveBtn').textContent='Save Practice';$('practiceSaveBtn').className='btn-primary';$('practiceModal').classList.add('active');}
function editPracticeFromProfile(practiceId){
const pr=practices.find(p=>p.id===practiceId);if(!pr)return;
editingPracticeId=pr.id;locationsToDelete=[];$('practiceModalTitle').textContent='Edit Practice';
const _locEmail=practiceLocations.filter(l=>l.practice_id===pr.id).map(l=>l.practice_email).find(Boolean)||'';
setFields({practiceName:pr.name,practiceWebsite:pr.website||'',practiceNotes:pr.general_notes||'',practiceEmail:pr.email||_locEmail});
$('practiceAddressSection').style.display='none';populateLocationEditCards(pr.id);$('practiceLocationsEditSection').style.display='';$('practiceSaveBtn').textContent='Save Practice';$('practiceSaveBtn').className='btn-primary';$('practiceModal').classList.add('active');
}
let locEditCounter = 0;
function buildLocationCardHTML(loc, idx) {
const id = loc ? loc.id : 'new_' + (++locEditCounter);
const isNew = !loc;
return `<div class="loc-edit-card" data-loc-id="${id}" data-is-new="${isNew}">
<div class="loc-edit-card-header">
<span class="loc-edit-card-title">${loc ? (loc.label || 'Office') : 'New Location'}</span>
<button type="button" class="remove-loc-btn" onclick="removeLocationCard(this, '${id}', ${isNew})" title="Remove">&times;</button>
</div>
<div class="loc-field"><label>Label</label><input type="text" data-field="label" value="${(loc?.label||'').replace(/"/g,'&quot;')}" placeholder="e.g., Main Office, Key Biscayne"></div>
<div class="loc-field"><label>Address</label><input type="text" data-field="address" value="${(loc?.address||'').replace(/"/g,'&quot;')}" placeholder="123 Main St"></div>
<div class="form-row">
<div class="loc-field"><label>City</label><input type="text" data-field="city" value="${(loc?.city||'').replace(/"/g,'&quot;')}"></div>
<div class="loc-field"><label>ZIP</label><input type="text" data-field="zip" value="${(loc?.zip||'').replace(/"/g,'&quot;')}"></div>
</div>
<div class="form-row">
<div class="loc-field"><label>Phone</label><input type="tel" data-field="phone" value="${(loc?.phone||'').replace(/"/g,'&quot;')}"></div>
<div class="loc-field"><label>Fax</label><input type="tel" data-field="fax" value="${(loc?.fax||'').replace(/"/g,'&quot;')}"></div>
</div>
<button type="button" class="loc-advanced-toggle" onclick="this.nextElementSibling.classList.toggle('show');this.textContent=this.nextElementSibling.classList.contains('show')?'Hide details':'More details...'">More details...</button>
<div class="loc-advanced">
<div class="loc-field"><label>Email</label><input type="email" data-field="practice_email" value="${(loc?.practice_email||'').replace(/"/g,'&quot;')}" placeholder="office@practice.com"></div>
<div class="loc-field"><label>Office Hours</label><input type="text" data-field="office_hours" value="${(loc?.office_hours||'').replace(/"/g,'&quot;')}" placeholder="Mon-Fri 9AM-5PM"></div>
<div class="loc-field"><label>Office Staff</label><input type="text" data-field="office_staff" value="${(loc?.office_staff||'').replace(/"/g,'&quot;')}"></div>
<div class="loc-field"><label>Receptionist</label><input type="text" data-field="receptionist_name" value="${(loc?.receptionist_name||'').replace(/"/g,'&quot;')}"></div>
<div class="loc-field"><label>Best Days to Visit</label><input type="text" data-field="best_days" value="${(loc?.best_days||'').replace(/"/g,'&quot;')}"></div>
</div>
</div>`;
}
function populateLocationEditCards(practiceId) {
const locations = practiceLocations.filter(l => l.practice_id === practiceId);
const container = $('practiceLocationsCards');
if (locations.length === 0) {
container.innerHTML = '<div class="empty-notice" style="padding:1rem;font-size:0.85rem;">No locations yet. Click "+ Add Location" to add one.</div>';
} else {
container.innerHTML = locations.map((loc, i) => buildLocationCardHTML(loc, i)).join('');
}
}
function addNewLocationCard() {
const container = $('practiceLocationsCards');
const emptyNotice = container.querySelector('.empty-notice');
if (emptyNotice) emptyNotice.remove();
container.insertAdjacentHTML('beforeend', buildLocationCardHTML(null, container.children.length));
const newCard = container.lastElementChild;
newCard.querySelector('input[data-field="label"]').focus();
}
let locationsToDelete = [];
function removeLocationCard(btn, locId, isNew) {
const card = btn.closest('.loc-edit-card');
if (!isNew && locId) {
if (!confirm('Remove this location? It will be deleted when you save.')) return;
locationsToDelete.push(locId);
}
card.remove();
const container = $('practiceLocationsCards');
if (container.children.length === 0) {
container.innerHTML = '<div class="empty-notice" style="padding:1rem;font-size:0.85rem;">No locations. Click "+ Add Location" to add one.</div>';
}
}
function getLocationCardsData() {
const cards = document.querySelectorAll('#practiceLocationsCards .loc-edit-card');
return Array.from(cards).map(card => {
const getData = (field) => {const el = card.querySelector(`input[data-field="${field}"]`); return el ? el.value || null : null;};
return {
id: card.dataset.locId,
isNew: card.dataset.isNew === 'true',
label: getData('label'),
address: getData('address'),
city: getData('city'),
zip: getData('zip'),
phone: getData('phone'),
fax: getData('fax'),
practice_email: getData('practice_email'),
office_hours: getData('office_hours'),
office_staff: getData('office_staff'),
receptionist_name: getData('receptionist_name'),
best_days: getData('best_days')
};
});
}
// NOTE: practices.email column requires: ALTER TABLE practices ADD COLUMN email VARCHAR(255);
async function savePractice(e) {
e.preventDefault();
const data={name:$('practiceName').value,website:$('practiceWebsite').value||null,general_notes:$('practiceNotes').value||null,email:$('practiceEmail').value||null};
await withSave('practiceSaveBtn','Save Practice',async()=>{
if(editingPracticeId){
const{error}=await db.from('practices').update(data).eq('id',editingPracticeId);if(error)throw error;
const locCards = getLocationCardsData();
for (const loc of locCards) {
const locData = {practice_id:editingPracticeId,label:loc.label,address:loc.address,city:loc.city,zip:loc.zip,phone:loc.phone,fax:loc.fax,practice_email:loc.practice_email,office_hours:loc.office_hours,office_staff:loc.office_staff,receptionist_name:loc.receptionist_name,best_days:loc.best_days};
if (loc.isNew) {
const{error:le}=await db.from('practice_locations').insert(locData);if(le)console.error('Location insert error:',le);
} else {
const{error:le}=await db.from('practice_locations').update(locData).eq('id',loc.id);if(le)console.error('Location update error:',le);
}
}
for (const delId of locationsToDelete) {
await db.from('provider_location_assignments').delete().eq('practice_location_id',delId);
await db.from('practice_locations').delete().eq('id',delId);
}
locationsToDelete = [];
showToast('Practice updated','success');
}else{const{data:newPract,error}=await db.from('practices').insert(data).select().single();if(error)throw error;
const addr=$('practiceAddress').value,city=$('practiceCity').value,zip=$('practiceZip').value,ph=$('practicePhone').value,fx=$('practiceFax').value;
const pEmail=$('practiceEmail').value||null;
if(addr||city){const locData={practice_id:newPract.id,label:'Main Office',address:addr||null,city:city||null,zip:zip||null,phone:ph||null,fax:fx||null,practice_email:pEmail};const{error:le}=await db.from('practice_locations').insert(locData);if(le)console.error('Location insert error:',le);}
showToast('Practice added','success');}
closePracticeModal();saveCrmCache();if(currentPractice){currentPractice=practices.find(p=>p.id===currentPractice.id);renderPracticeProfile();}if(currentPhysician){renderProfile();}loadAllData().catch(()=>{});
});
}
async function deletePractice() {
if(!currentPractice)return;
if(!confirm(`Delete ${currentPractice.name}? This will also delete all its locations.`))return;
try{
updateSyncIndicators('syncing');
const pid=currentPractice.id;
const locIds=practiceLocations.filter(l=>l.practice_id===pid).map(l=>l.id);
if(locIds.length>0){
const{error:e1}=await db.from('provider_location_assignments').delete().in('practice_location_id',locIds);if(e1)throw e1;
const{error:e2}=await db.from('practice_locations').delete().eq('practice_id',pid);if(e2)throw e2;
}
const{error:e3}=await db.from('practices').delete().eq('id',pid);if(e3)throw e3;
practices=practices.filter(p=>p.id!==pid);
const _delLocIds=practiceLocations.filter(l=>l.practice_id===pid).map(l=>l.id);
practiceLocations=practiceLocations.filter(l=>l.practice_id!==pid);
_delLocIds.forEach(lid=>{Object.keys(physicianAssignments).forEach(k=>{physicianAssignments[k]=physicianAssignments[k].filter(a=>a.practice_location_id!==lid);});});
currentPractice=null;saveCrmCache();renderList();renderEmptyState();
showToast('Deleted','success');updateSyncIndicators('synced');
}catch(e){console.error('Delete error:',e);showToast('Error: '+e.message,'error');updateSyncIndicators('error');}
}
function parseAddressBlock(mode) {
// mode = 'location' (default) fills locationAddress/City/Zip/Phone
// mode = 'quick' fills quickPracticeAddr/City/Zip/Phone
// mode = 'practice' fills practiceAddress/City/Zip/Phone
const srcId = (mode === 'quick') ? 'quickAddressBlock' : (mode === 'practice') ? 'practiceAddressBlock' : 'addressBlock';
const raw = ($(''+srcId)?.value || '').trim();
if (!raw) { showToast('Paste an address first', 'info'); return; }
const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
let addr = '', city = '', zip = '', phone = '';
// Phone
const phoneMatch = raw.match(/(\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4})/);
if (phoneMatch) phone = phoneMatch[1];
// City/State/Zip: search lines bottom-up for a line like "City[,] ST 12345"
// Handles both "Miami, FL 33176" and "Pembroke Pines FL 33028" (no comma before state)
let cityLineIdx = -1;
for (let i = lines.length - 1; i >= 0; i--) {
  const m = lines[i].match(/^([A-Za-z][^,]*?),?\s+([A-Z]{2})\s+(\d{5})(?:-\d{4})?/);
  if (m) { city = m[1].trim(); zip = m[3]; cityLineIdx = i; break; }
}
// Fallback for single-line: "123 Main St, Miami, FL 33176"
if (!city) {
  const m = raw.replace(/\n/g,' ').match(/,\s*([A-Za-z][A-Za-z\s\-'\.]*?),?\s+([A-Z]{2})\s+(\d{5})/);
  if (m) { city = m[1].trim(); zip = m[3]; }
}
// Zip fallback: look for FL state abbreviation then 5 digits (not directionals like NE/NW/SE/SW)
if (!zip) { const m = raw.match(/\bFL\s+(\d{5})\b/); if (m) zip = m[1]; }
// Address: first line starting with a digit, excluding the city/state/zip line
for (let i = 0; i < lines.length; i++) {
  if (i === cityLineIdx) continue;
  if (/^\d/.test(lines[i])) { addr = lines[i]; break; }
}
if (!addr && cityLineIdx > 0) addr = lines[0];
// If city was found via single-line fallback (cityLineIdx=-1), addr may contain the city/state/zip tail — strip it
if (addr && city && cityLineIdx === -1) {
  const tailMatch = addr.match(new RegExp(',?\\s*' + city.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '.*$', 'i'));
  if (tailMatch && tailMatch.index > 0) addr = addr.slice(0, tailMatch.index).trim().replace(/,\s*$/, '');
}
// Normalize address: convert "Suite 205" → "#205", directionals, strip nan tokens
if (addr && typeof normalizeAddr === 'function') addr = normalizeAddr(addr);
if (mode === 'quick') {
  if ($('quickPracticeAddr') && addr) $('quickPracticeAddr').value = addr;
  if ($('quickPracticeCity') && city) $('quickPracticeCity').value = city;
  if ($('quickPracticeZip') && zip) $('quickPracticeZip').value = zip;
  if ($('quickPracticePhone') && phone && !$('quickPracticePhone').value) $('quickPracticePhone').value = phone;
} else if (mode === 'practice') {
  if ($('practiceAddress') && addr) $('practiceAddress').value = addr;
  if ($('practiceCity') && city) $('practiceCity').value = city;
  if ($('practiceZip') && zip) $('practiceZip').value = zip;
  if ($('practicePhone') && phone && !$('practicePhone').value) $('practicePhone').value = phone;
} else {
  if ($('locationAddress') && addr) $('locationAddress').value = addr;
  if ($('locationCity') && city) $('locationCity').value = city;
  if ($('locationZip') && zip) $('locationZip').value = zip;
  if ($('locationPhone') && phone && !$('locationPhone').value) $('locationPhone').value = phone;
}
showToast('Address fields filled — review and adjust as needed', 'success');
}

// --- Location modal ---
function openLocationModal(practiceId = null) {
editingLocationId = null;
$('locationModalTitle').textContent = 'Add Location';
$('locationForm').reset();
if ($('addressBlock')) $('addressBlock').value = '';
$('locationSaveBtn').textContent = 'Save Location';
$('locationSaveBtn').className = 'btn-primary';
const select = $('locationPracticeId');
select.innerHTML = '<option value="">-- Select Practice --</option>' +
practices.map(p => `<option value="${p.id}" ${p.id === practiceId ? 'selected' : ''}>${p.name}</option>`).join('');
$('locationPracticeEditRow').style.display='none';
$('locationModal').classList.add('active');
}
function closeLocationModal(){closeModal('locationModal');}
function editLocationDetails(locationId) {
const loc=practiceLocations.find(l=>l.id===locationId);if(!loc)return;
editingLocationId=locationId;$('locationModalTitle').textContent='Edit Location';
if ($('addressBlock')) $('addressBlock').value = '';
setFields({locationPracticeId:loc.practice_id,locationLabel:loc.label||'',locationAddress:loc.address||'',locationCity:loc.city||'',locationZip:loc.zip||'',locationPhone:loc.phone||'',locationFax:loc.fax||'',locationEmail:loc.practice_email||'',locationHours:loc.office_hours||'',locationStaff:loc.office_staff||'',locationReceptionist:loc.receptionist_name||'',locationBestDays:loc.best_days||'',locationNotes:loc.notes||''});
$('locationSaveBtn').textContent='Save Location';$('locationSaveBtn').className='btn-primary';
$('locationPracticeId').innerHTML='<option value="">-- Select Practice --</option>'+practices.map(p=>`<option value="${p.id}" ${p.id===loc.practice_id?'selected':''}>${p.name}</option>`).join('');
const pr=practices.find(p=>p.id===loc.practice_id);
$('locationPracticeNameEdit').value=pr?pr.name:'';
$('locationPracticeEditRow').style.display='';
$('locationModal').classList.add('active');
}
async function saveInlinePracticeName() {
const newName = $('locationPracticeNameEdit').value.trim();
if (!newName) { showToast('Practice name cannot be empty', 'error'); return; }
const practiceId = $('locationPracticeId').value;
if (!practiceId) { showToast('No practice selected', 'error'); return; }
try {
const {error} = await db.from('practices').update({name: newName}).eq('id', practiceId);
if (error) throw error;
const pr = practices.find(p => p.id === practiceId);
if (pr) pr.name = newName;
const opt = $('locationPracticeId').querySelector(`option[value="${practiceId}"]`);
if (opt) opt.textContent = newName;
showToast('Practice renamed to "' + newName + '"', 'success');
} catch(e) { showToast('Error renaming practice: ' + e.message, 'error'); }
}
async function saveLocation(e) {
e.preventDefault();
const data={practice_id:$('locationPracticeId').value,label:$('locationLabel').value,address:$('locationAddress').value||null,city:$('locationCity').value||null,zip:$('locationZip').value||null,phone:$('locationPhone').value||null,fax:$('locationFax').value||null,practice_email:$('locationEmail').value||null,office_hours:$('locationHours').value||null,office_staff:$('locationStaff').value||null,receptionist_name:$('locationReceptionist').value||null,best_days:$('locationBestDays').value||null,notes:$('locationNotes').value||null};
if(!editingLocationId){const missing=[];if(!data.address){missing.push('Address');const el=$('locationAddress');el.style.borderColor='#dc2626';setTimeout(()=>el.style.borderColor='',3000);}if(!data.city){missing.push('City');const el=$('locationCity');el.style.borderColor='#dc2626';setTimeout(()=>el.style.borderColor='',3000);}if(missing.length){showToast(missing.join(' and ')+' required to save a location','error');return;}}
await withSave('locationSaveBtn','Save Location',async()=>{
if(editingLocationId){const{error}=await db.from('practice_locations').update(data).eq('id',editingLocationId);if(error)throw error;showToast('Location updated','success');
}else{const{error}=await db.from('practice_locations').insert(data);if(error)throw error;showToast('Location added','success');}
closeLocationModal();saveCrmCache();if(currentPractice)renderPracticeProfile();if(currentPhysician)renderProfile();loadAllData().catch(()=>{});
});
}
async function deleteLocation(locationId) {
if(!confirm('Delete this location and all provider assignments?'))return;
try{
updateSyncIndicators('syncing');
const{error:e1}=await db.from('provider_location_assignments').delete().eq('practice_location_id',locationId);if(e1)throw e1;
const{error:e2}=await db.from('practice_locations').delete().eq('id',locationId);if(e2)throw e2;
practiceLocations=practiceLocations.filter(l=>l.id!==locationId);
Object.keys(physicianAssignments).forEach(k=>{physicianAssignments[k]=physicianAssignments[k].filter(a=>a.practice_location_id!==locationId);});
saveCrmCache();if(currentPractice)renderPracticeProfile();
showToast('Deleted','success');updateSyncIndicators('synced');
}catch(e){console.error('Delete error:',e);showToast('Error: '+e.message,'error');updateSyncIndicators('error');}
}

// --- Assign location modal ---
function openAssignLocationModal() {
const existingAssignments = (physicianAssignments[currentPhysician.id] || []).map(a => a.practice_location_id);
const container = $('assignLocationOptions');
container.innerHTML = practices.map(practice => {
const locations = practiceLocations.filter(l => l.practice_id === practice.id);
if (locations.length === 0) return '';
return `
<div style="margin-bottom: 1rem;">
<div style="font-weight: 600; margin-bottom: 0.5rem; color: #1e3a8a;">${practice.name}</div>
${locations.map(loc => `
<div class="selector-option" data-loc-id="${loc.id}" onclick="toggleAssignLocation('${loc.id}', this)">
<input type="checkbox" ${existingAssignments.includes(loc.id) ? 'checked' : ''}>
<div>
<span class="selector-option-label">${loc.label || 'Office'}</span>
<div class="selector-option-sub">${loc.city || ''} ${loc.address || ''}</div>
</div>
</div>
`).join('')}
</div>
`;
}).join('') || '<div class="empty-notice">No locations available. Create a practice and location first.</div>';
$('assignLocationModal').classList.add('active');
}
function closeAssignLocationModal(){closeModal('assignLocationModal');}
function toggleAssignLocation(locationId, element) {
const checkbox = element.querySelector('input[type="checkbox"]');
checkbox.checked = !checkbox.checked;
}
async function saveLocationAssignments() {
const options = document.querySelectorAll('#assignLocationOptions .selector-option');
const selectedIds = [];
options.forEach(opt => {
const cb = opt.querySelector('input[type="checkbox"]');
const locId = opt.getAttribute('data-loc-id');
if (cb && cb.checked && locId) selectedIds.push(locId);
});
try {
updateSyncIndicators('syncing');
const {error:delErr} = await db
.from('provider_location_assignments')
.delete()
.eq('provider_id', currentPhysician.id);
if (delErr) throw delErr;
if (selectedIds.length > 0) {
const assignments = selectedIds.map((locId, index) => ({
provider_id: currentPhysician.id,
practice_location_id: locId,
is_primary: index === 0
}));
const { error } = await db
.from('provider_location_assignments')
.insert(assignments);
if (error) throw error;
}
await refreshAssignments(currentPhysician.id);
renderProfile();
closeAssignLocationModal();
showToast('Location assignments updated', 'success');
updateSyncIndicators('synced');
} catch (error) {
console.error('Save error:', error);
showToast('Error saving: ' + error.message, 'error');
updateSyncIndicators('error');
}
}
async function quickAddPracticeAndAssign() {
const name = $('quickPracticeName').value.trim();
if (!name) { showToast('Practice name required', 'error'); return; }
try {
updateSyncIndicators('syncing');
const {data:newPract,error:pe} = await db.from('practices').insert({name}).select().single();
if (pe) throw pe;
const locData = {practice_id:newPract.id,label:'Main Office',address:$('quickPracticeAddr').value||null,city:$('quickPracticeCity').value||null,zip:$('quickPracticeZip').value||null,phone:$('quickPracticePhone').value||null,practice_email:$('quickPracticeEmail').value||null};
const {data:newLoc,error:le} = await db.from('practice_locations').insert(locData).select().single();
if (le) throw le;
const {error:ae} = await db.from('provider_location_assignments').insert({provider_id:currentPhysician.id,practice_location_id:newLoc.id,is_primary:false});
if (ae) throw ae;
['quickPracticeName','quickPracticeAddr','quickPracticeCity','quickPracticeZip','quickPracticePhone','quickPracticeEmail','quickAddressBlock'].forEach(id=>{const el=$(id);if(el)el.value='';});
practices.push(newPract);newLoc.practices={name:newPract.name};practiceLocations.push(newLoc);
await refreshAssignments(currentPhysician.id);
renderProfile();
closeAssignLocationModal();
showToast(`${name} created and assigned`, 'success');
updateSyncIndicators('synced');
} catch(e) {
console.error('Quick add practice error:', e);
showToast('Error: ' + e.message, 'error');
updateSyncIndicators('error');
}
}
async function removeAssignment(assignmentId) {
await dbDel('provider_location_assignments',assignmentId,'Remove this location assignment?',async()=>{if(currentPhysician&&physicianAssignments[currentPhysician.id]){physicianAssignments[currentPhysician.id]=physicianAssignments[currentPhysician.id].filter(a=>a.id!==assignmentId);}saveCrmCache();renderProfile();});
}
async function setPrimaryLocation(assignmentId) {
if (!currentPhysician) return;
try {
  updateSyncIndicators('syncing');
  // Clear primary on all assignments for this provider
  const {error:e1} = await db.from('provider_location_assignments').update({is_primary:false}).eq('provider_id',currentPhysician.id);
  if (e1) throw e1;
  // Set primary on the chosen one
  const {error:e2} = await db.from('provider_location_assignments').update({is_primary:true}).eq('id',assignmentId);
  if (e2) throw e2;
  if(physicianAssignments[currentPhysician.id]){physicianAssignments[currentPhysician.id].forEach(a=>{a.is_primary=(a.id===assignmentId);});}
  saveCrmCache();
  renderProfile();
  showToast('Primary location updated', 'success');
  updateSyncIndicators('synced');
} catch(e) { showToast('Error: '+e.message, 'error'); updateSyncIndicators('error'); }
}

// --- Assign provider modal (from practice view) ---
function openAssignPhysicianModal() {
if(!currentPractice)return;
const locations = practiceLocations.filter(l => l.practice_id === currentPractice.id);
const select = $('assignPhysLocationSelect');
select.innerHTML = locations.map(loc => `<option value="${loc.id}">${loc.label || 'Office'} - ${loc.address || ''}, ${loc.city || ''}</option>`).join('');
if (locations.length === 0) { showToast('Add a location to this practice first', 'error'); return; }
const locId = select.value;
const existingPhysIds = physicians.filter(p => {
const assigns = physicianAssignments[p.id] || [];
return assigns.some(a => locations.some(l => l.id === a.practice_location_id));
}).map(p => p.id);
renderAssignPhysicianOptions(existingPhysIds);
$('assignPhysSearch').value = '';
$('assignPhysicianModal').classList.add('active');
}
function renderAssignPhysicianOptions(existingPhysIds) {
const search = ($('assignPhysSearch')?.value || '').toLowerCase();
const filtered = search ? physicians.filter(p => `${p.first_name} ${p.last_name}`.toLowerCase().includes(search)) : physicians;
$('assignPhysicianOptions').innerHTML = filtered.map(p => `
<div class="selector-option" data-phys-id="${p.id}" onclick="toggleAssignPhys('${p.id}', this)">
<input type="checkbox" ${existingPhysIds.includes(p.id) ? 'checked' : ''}>
<div>
<span class="selector-option-label">${fmtName(p)}</span>
<div class="selector-option-sub">${p.specialty || ''}</div>
</div>
</div>
`).join('') || '<div class="empty-notice">No providers found</div>';
}
function filterAssignPhysicianOptions() {
if(!currentPractice)return;
const currentChecked = new Set();
document.querySelectorAll('#assignPhysicianOptions .selector-option').forEach(opt => {
const cb = opt.querySelector('input[type="checkbox"]');
const pid = opt.getAttribute('data-phys-id');
if (cb && cb.checked && pid) currentChecked.add(pid);
});
const locations = practiceLocations.filter(l => l.practice_id === currentPractice.id);
const existingPhysIds = physicians.filter(p => {
const assigns = physicianAssignments[p.id] || [];
return assigns.some(a => locations.some(l => l.id === a.practice_location_id));
}).map(p => p.id);
const mergedIds = [...new Set([...existingPhysIds, ...currentChecked])];
renderAssignPhysicianOptions(mergedIds);
}
function toggleAssignPhys(physId, element) {
const cb = element.querySelector('input[type="checkbox"]');
cb.checked = !cb.checked;
}
function closeAssignPhysicianModal(){closeModal('assignPhysicianModal');}
async function quickAddPhysician() {
const errEl=$('quickAddError');if(errEl){errEl.style.display='none';errEl.textContent='';}
function showQuickErr(msg){if(errEl){errEl.textContent=msg;errEl.style.display='block';}else{showToast(msg,'error');}}
const first = $('quickPhysFirst').value.trim();
const last = $('quickPhysLast').value.trim();
if (!first || !last) { showQuickErr('First and last name are required.'); return; }
const locId = $('assignPhysLocationSelect').value;
if (!locId) { showQuickErr('Please select a location at the top of this form.'); return; }
try {
updateSyncIndicators('syncing');
const data = {first_name:first,last_name:last,degree:normDegree($('quickPhysDegree').value)||null,title:$('quickPhysTitle').value.trim()||null,specialty:$('quickPhysSpecialty').value||null,priority:$('quickPhysPriority').value||null,email:$('quickPhysEmail').value.trim()||null,mobile_phone:$('quickPhysMobile').value.trim()||null,general_notes:$('quickPhysNotes').value.trim()||null};
const {data:newPhys,error} = await db.from('providers').insert(data).select().single();
if (error) throw error;
const {error:assignErr} = await db.from('provider_location_assignments').insert({provider_id:newPhys.id,practice_location_id:locId,is_primary:true});
if (assignErr) throw assignErr;
physicians.push(newPhys);physicians.sort((a,b)=>a.last_name.localeCompare(b.last_name));
await refreshAssignments(newPhys.id);
$('quickPhysFirst').value = '';
$('quickPhysLast').value = '';
$('quickPhysDegree').value = '';
$('quickPhysSpecialty').value = '';
$('quickPhysPriority').value = '';
$('quickPhysTitle').value = '';
$('quickPhysEmail').value = '';
$('quickPhysMobile').value = '';
$('quickPhysNotes').value = '';
renderPracticeProfile();
const locations = practiceLocations.filter(l => l.practice_id === currentPractice.id);
const existingPhysIds = physicians.filter(p => {
const assigns = physicianAssignments[p.id] || [];
return assigns.some(a => locations.some(l => l.id === a.practice_location_id));
}).map(p => p.id);
renderAssignPhysicianOptions(existingPhysIds);
showToast(`${first} ${last} added and assigned`, 'success');
updateSyncIndicators('synced');
} catch(e) {
console.error('Quick add error:', e);
showToast('Error: ' + e.message, 'error');
updateSyncIndicators('error');
}
}
async function savePhysicianToLocation() {
const locId = $('assignPhysLocationSelect').value;
if (!locId) { showToast('Select a location', 'error'); return; }
const options = document.querySelectorAll('#assignPhysicianOptions .selector-option');
const selectedPhysIds = [];
const unselectedPhysIds = [];
options.forEach(opt => {
const cb = opt.querySelector('input[type="checkbox"]');
const physId = opt.getAttribute('data-phys-id');
if (physId && cb) {
if (cb.checked) selectedPhysIds.push(physId);
else unselectedPhysIds.push(physId);
}
});
try {
updateSyncIndicators('syncing');
for (const physId of selectedPhysIds) {
const {data:existing} = await db.from('provider_location_assignments').select('id').eq('provider_id',physId).eq('practice_location_id',locId).maybeSingle();
if (!existing) {
const {error} = await db.from('provider_location_assignments').insert({provider_id:physId,practice_location_id:locId,is_primary:false});
if (error) throw error;
}
}
for (const physId of unselectedPhysIds) {
await db.from('provider_location_assignments').delete().eq('provider_id',physId).eq('practice_location_id',locId);
}
const _affectedPhysIds=[...new Set([...selectedPhysIds,...unselectedPhysIds])];
await Promise.all(_affectedPhysIds.map(pid=>refreshAssignments(pid)));
renderPracticeProfile();
closeAssignPhysicianModal();
showToast('Providers assigned', 'success');
updateSyncIndicators('synced');
} catch(e) {
console.error('Assign error:', e);
showToast('Error: ' + e.message, 'error');
updateSyncIndicators('error');
}
}
