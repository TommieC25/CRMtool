// === js/admin.js === CSV import, database clear, CSV export, field routing export

// --- CSV Import ---
function importCSVPaste(){const el=document.getElementById('csvPasteArea');const t=(el?.value||'').trim();if(!t){showToast('Paste CSV text first','error');return;}if(el)el.value='';importCSV({text:()=>Promise.resolve(t)});}
async function importCSVText(text){await importCSV({text:()=>Promise.resolve(text)});}
function normalizeAddr(s){return(s||'').trim().replace(/\bnan\b/gi,'').replace(/\s+/g,' ').trim().replace(/(Suite|Ste\.?|Apt\.?|Unit)\.?\s*#?\s*(\d+)/gi,'#$2').replace(/\b(Southwest|Northwest|Northeast|Southeast|North|South|East|West)\b/gi,m=>{const d={southwest:'SW',northwest:'NW',northeast:'NE',southeast:'SE',north:'N',south:'S',east:'E',west:'W'};return d[m.toLowerCase()]||m.toUpperCase();}).replace(/\b(SW|NW|NE|SE)\b/gi,m=>m.toUpperCase()).replace(/\s+/g,' ').trim();}
async function importCSV(file) {
if(!file)return;
const status=s=>{const el=$('importStatus');if(el)el.textContent=s;const el2=$('importStatusMain');if(el2)el2.textContent=s;};
status('Reading CSV...');
try{
const text=await file.text();
const lines=text.split('\n').filter(l=>l.trim());
const headers=lines[0].split(',').map(h=>h.trim().toLowerCase().replace(/\s+/g,'_'));
const rows=[];
for(let i=1;i<lines.length;i++){
const vals=[];let cur='',inQ=false;
for(const ch of lines[i]){if(ch==='"'){inQ=!inQ;}else if(ch===','&&!inQ){vals.push(cur.trim());cur='';}else{cur+=ch;}}
vals.push(cur.trim());
const row={};headers.forEach((h,j)=>row[h]=vals[j]||'');rows.push(row);
}
status(`Parsed ${rows.length} rows. Importing...`);
updateSyncIndicators('syncing');
// Phase 1: Find/create all practices
const practiceNames=[...new Set(rows.map(r=>(r.practice_name||'').trim()).filter(Boolean))];
const practiceMap={};
for(const name of practiceNames){
const{data:exArr}=await db.from('practices').select('*').ilike('name',name).limit(1);
const ex=exArr&&exArr.length>0?exArr[0]:null;
if(ex){practiceMap[name]=ex.id;}else{
const{data:np}=await db.from('practices').insert({name}).select().maybeSingle();
if(np)practiceMap[name]=np.id;
}}
function getPractId(practName){const n=(practName||'').trim();return practiceMap[n]||practiceMap[Object.keys(practiceMap).find(k=>k.toLowerCase()===n.toLowerCase())];}

// Phase 2: Find/create ALL locations first (independent of which provider is listed)
status('Creating practice locations...');
const locMap={};// key: `${practiceId}|${address}` -> location record
const seenLocKeys=new Set();const practLocsCache={};
for(const r of rows){
const practId=getPractId(r.practice_name);
const addr=normalizeAddr(r.address);
if(!practId||!addr||addr==='[Research needed]')continue;
const locKey=`${practId}|${addr}`;
if(seenLocKeys.has(locKey))continue;
seenLocKeys.add(locKey);
const city=(r.city||'').trim();
if(!practLocsCache[practId]){const{data:pls}=await db.from('practice_locations').select('*').eq('practice_id',practId);practLocsCache[practId]=pls||[];}
const exLoc=practLocsCache[practId].find(l=>normalizeAddr(l.address||'').toLowerCase()===addr.toLowerCase());
let locRec=exLoc;if(!locRec){const{data:nl}=await db.from('practice_locations').insert({practice_id:practId,label:city||'Office',address:addr,city,zip:(r.zip||'').trim(),phone:r.phone||null,fax:r.fax||null,office_hours:r.office_hours||null,office_staff:r.office_staff||null,receptionist_name:r.receptionist_name||r.receptionist||null,best_days:r.best_days||null,practice_email:r.practice_email||r.office_email||null}).select().maybeSingle();if(nl){practLocsCache[practId].push(nl);locRec=nl;}}
if(locRec)locMap[locKey]=locRec;
}

// Phase 3: Build provider map — track which practices each provider belongs to
const physMap=new Map();
rows.forEach(r=>{
if(!(r.first_name||'').trim()&&!(r.last_name||'').trim())return;
const key=`${(r.first_name||'').trim().toLowerCase().replace(/\s+[a-z]\.\s*$/,'')}|${(r.last_name||'').trim().toLowerCase()}`;
if(!physMap.has(key))physMap.set(key,{phys:{first_name:(r.first_name||'').trim(),last_name:(r.last_name||'').trim(),email:r.email||null,mobile_phone:r.mobile_phone||null,priority:r.priority||null,academic_connection:r.academic_connection||r.um_connection||null,specialty:r.specialty||null,degree:normDegree(r.degree)||null,title:r.title||null,proj_vol:r.proj_vol||r.patient_volume||r.vol||null,ss_vol:r.ss_vol?parseInt(r.ss_vol,10)||null:null,general_notes:r.general_notes||null},practiceIds:new Set(),primaryLocKey:null});
const e=physMap.get(key);
const practId=getPractId(r.practice_name);
if(practId)e.practiceIds.add(practId);
// Track primary location (first address listed for this provider)
const addr=normalizeAddr(r.address);
if(!e.primaryLocKey&&practId&&addr&&addr!=='[Research needed]')e.primaryLocKey=`${practId}|${addr}`;
});

// Phase 4: Find/create each provider then assign to ALL locations of their practice(s)
let count=0;const total=physMap.size;
for(const[key,entry] of physMap){
count++;if(count%5===0||count===total)status(`Assigning providers ${count} of ${total}...`);
const fnNorm=entry.phys.first_name.toLowerCase().replace(/\s+[a-z]\.\s*$/,'').trim();
const{data:exArr}=await db.from('providers').select('*').ilike('last_name',entry.phys.last_name).limit(20);
const ex=(exArr||[]).find(p=>(p.first_name||'').toLowerCase().replace(/\s+[a-z]\.\s*$/,'').trim()===fnNorm)||null;
const phys=ex||(await db.from('providers').insert(entry.phys).select().maybeSingle()).data;
if(!phys)continue;
// Assign to ALL locations of every practice this provider belongs to
for(const practId of entry.practiceIds){
const{data:allLocs}=await db.from('practice_locations').select('id').eq('practice_id',practId);
for(const loc of allLocs||[]){
const isPrimary=entry.primaryLocKey&&locMap[entry.primaryLocKey]?.id===loc.id;
const{data:exA}=await db.from('provider_location_assignments').select('id').eq('provider_id',phys.id).eq('practice_location_id',loc.id).maybeSingle();
if(!exA)await db.from('provider_location_assignments').insert({provider_id:phys.id,practice_location_id:loc.id,is_primary:!!isPrimary});
}}}
await loadAllData();
status(`Done! Imported ${physMap.size} providers, ${practiceNames.length} practices.`);
showToast(`Imported ${physMap.size} providers`,'success');
updateSyncIndicators('synced');
}catch(e){console.error('Import error:',e);status('Error: '+e.message);showToast('Import failed: '+e.message,'error');updateSyncIndicators('error');}
}

async function syncGoogleSheet() {
  const urlEl = $('sheetSyncUrl');
  const url = (urlEl ? urlEl.value.trim() : '') || localStorage.getItem('sheetSyncUrl') || '';
  const statusEl = $('syncSheetStatus');
  if (!url) {
    if (statusEl) statusEl.textContent = 'Paste your Apps Script web app URL above first.';
    showToast('No web app URL set — see Admin Settings', 'error');
    return;
  }
  if (statusEl) { statusEl.style.color = '#aaa'; statusEl.textContent = 'Syncing…'; }
  // Use hidden iframe instead of fetch — Safari blocks no-cors fetch to redirecting URLs (Apps Script)
  try {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'display:none;width:0;height:0;border:0;position:absolute;';
    iframe.src = url;
    document.body.appendChild(iframe);
    setTimeout(() => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); }, 15000);
    if (statusEl) { statusEl.style.color = '#10b981'; statusEl.textContent = 'Sync triggered — sheet updates in ~30 sec'; }
    showToast('Google Sheet sync triggered', 'success');
  } catch (e) {
    if (statusEl) { statusEl.style.color = '#dc2626'; statusEl.textContent = 'Request failed: ' + e.message; }
    showToast('Sync request failed: ' + e.message, 'error');
  }
}

function initSheetSyncUrl() {
  const saved = localStorage.getItem('sheetSyncUrl') || '';
  const el = $('sheetSyncUrl');
  if (el && saved) el.value = saved;
  // Pre-fill Anthropic key field (shows masked)
  const keyEl = $('anthropicKeyInput');
  if (keyEl) keyEl.value = localStorage.getItem('anthropic_api_key') || '';
}

async function clearDatabase() {
const confirmMsg = 'Are you sure you want to DELETE ALL DATA?\n\nThis will remove:\n- All providers\n- All practices\n- All locations\n- All contact logs\n\nThis cannot be undone!';
if (!confirm(confirmMsg)) return;
if (!confirm('FINAL WARNING: Click OK to permanently delete all data.')) return;
try {
updateSyncIndicators('syncing');
showToast('Clearing database...', 'info');
for(const t of ['contact_logs','provider_location_assignments','providers','practice_locations','practices']){
const{error,count}=await db.from(t).delete().neq('id','00000000-0000-0000-0000-000000000000');
console.log(`Deleted from ${t}: error=${error?.message||'none'}`);
if(error) throw error;
}
const{data:remaining}=await db.from('providers').select('id,first_name,last_name');
if(remaining&&remaining.length>0){
console.warn(`${remaining.length} providers survived delete! RLS may be blocking deletions.`);
showToast(`Warning: ${remaining.length} records could not be deleted (database permissions issue). Check Supabase RLS policies.`,'error');
for(const r of remaining){
const{error:e2}=await db.from('providers').delete().eq('id',r.id);
console.log(`Individual delete ${r.first_name} ${r.last_name}: ${e2?.message||'ok'}`);
}
}
physicians=[];practices=[];practiceLocations=[];physicianAssignments={};contactLogs={};
currentPhysician=null;currentPractice=null;
await loadAllData();
renderList();
if(physicians.length>0){
showToast(`Clear incomplete: ${physicians.length} providers remain. Check Supabase RLS/policies.`,'error');
}else{
renderEmptyState();
showToast('Database cleared successfully!', 'success');
}
updateSyncIndicators('synced');
} catch (error) {
console.error('Clear database error:', error);
showToast('Error clearing database: ' + error.message, 'error');
updateSyncIndicators('error');
}
}

// --- CSV Export ---
function openExportModal(){document.getElementById('exportModal').classList.add('active');}
function closeExportModal(){closeModal('exportModal');}
function escCSV(val){if(val==null)return '';const s=String(val);if(s.includes(',')||s.includes('"')||s.includes('\n'))return '"'+s.replace(/"/g,'""')+'"';return s;}
function downloadCSV(filename,headers,rows){const csv=[headers.join(','),...rows.map(r=>r.map(escCSV).join(','))].join('\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);}
function todayStamp(){const d=new Date();return d.toISOString().slice(0,10)+'_'+d.toTimeString().slice(0,8).replace(/:/g,'');}
// Format YYYY-MM-DD as MM/DD for compact spreadsheet display
function fmtDateMD(ds){if(!ds)return'';const m=ds.match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?m[2]+'/'+m[3]:ds;}

async function exportCSV(type){
const st=document.getElementById('exportStatus');st.style.display='block';st.style.background='#e0f2fe';st.style.color='#075985';st.textContent='Preparing export...';
try{
if(type==='providers'||type==='all') await exportPhysicians();
if(type==='contacts'||type==='all') await exportContacts();
if(type==='practices'||type==='all') await exportPractices();
st.style.background='#dcfce7';st.style.color='#166534';st.textContent='Export complete!';
showToast('CSV exported successfully','success');
}catch(e){st.style.background='#fee2e2';st.style.color='#991b1b';st.textContent='Export failed: '+e.message;showToast('Export error: '+e.message,'error');}
}

async function exportPhysicians(){
const{data:allPhys,error}=await db.from('providers').select('*').order('last_name');if(error)throw error;
const{data:allAssign}=await db.from('provider_location_assignments').select('*, practice_locations(*, practices(name))');
const am={};(allAssign||[]).forEach(a=>{if(!am[a.provider_id])am[a.provider_id]=[];am[a.provider_id].push(a);});
const{data:allLogs}=await db.from('contact_logs').select('*').order('contact_date',{ascending:false});
const latestLog={};(allLogs||[]).forEach(l=>{if(!latestLog[l.provider_id])latestLog[l.provider_id]=l;});
const h=['Last Name','First Name','Degree','Practice','Tier','Specialty','Email','Mobile Phone','Academic Connection','Projected Volume','SS Volume','Primary Address','Primary City','Primary ZIP','Primary Phone','Primary Fax','Office Hours','Best Days','Receptionist','Location Count','Last Contact','Status','General Notes'];
const rows=(allPhys||[]).map(p=>{const as=am[p.id]||[];const pl=(as.find(a=>a.is_primary)||as[0])?.practice_locations||{};
const log=latestLog[p.id];const statusNote=log?(log.notes||'').replace(/^\[\d{1,2}:\d{2}\]\s*/,''):'';const statusPreview=statusNote.length>80?statusNote.substring(0,80)+'...':statusNote;const status=log?fmtDateMD(log.contact_date)+': '+statusPreview:'';
return[p.last_name,p.first_name,p.degree||'',pl.practices?.name||p.practice_name||'',p.priority||'',p.specialty||'',p.email||'',fmtPhone(p.mobile_phone),p.academic_connection||'',p.proj_vol||p.mohs_volume||'',p.ss_vol||'',pl.address||'',pl.city||'',pl.zip||'',fmtPhone(pl.phone),fmtPhone(pl.fax),pl.office_hours||'',pl.best_days||'',pl.receptionist_name||'',as.length,fmtDateMD(p.last_contact),status,p.general_notes||''];});
downloadCSV('providers_export_'+todayStamp()+'.csv',h,rows);
}

async function exportContacts(){
const{data:allLogs,error}=await db.from('contact_logs').select('*').order('contact_date',{ascending:false});if(error)throw error;
const pm={};physicians.forEach(p=>pm[p.id]=p);
const h=['Date','Time','Author','Provider Last Name','Provider First Name','Location','Notes'];
const rows=(allLogs||[]).map(l=>{const p=pm[l.provider_id]||{};const loc=l.practice_location_id?getLocationLabel(l.practice_location_id):'';
let notes=l.notes||'',time=l.contact_time||'';
if(!time&&notes.startsWith('[')){const m=notes.match(/^\[(\d{1,2}:\d{2})\]\s*/);if(m){time=m[1];notes=notes.slice(m[0].length);}}
return[fmtDateMD(l.contact_date),time,l.author||'',p.last_name||'',p.first_name||'',loc,notes];});
downloadCSV('contact_logs_export_'+todayStamp()+'.csv',h,rows);
}

async function exportPractices(){
const{data:allLocs,error}=await db.from('practice_locations').select('*, practices(name, website, email)').order('city');if(error)throw error;
const h=['Practice Name','Practice Email','Practice Website','Location Label','Address','City','ZIP','Phone','Fax','Office Email','Office Hours','Office Staff','Receptionist','Best Days'];
const rows=(allLocs||[]).map(l=>[l.practices?.name||'',l.practices?.email||'',l.practices?.website||'',l.label||'',l.address||'',l.city||'',l.zip||'',fmtPhone(l.phone),fmtPhone(l.fax),l.practice_email||'',l.office_hours||'',l.office_staff||'',l.receptionist_name||'',l.best_days||'']);
downloadCSV('practices_locations_export_'+todayStamp()+'.csv',h,rows);
}

// --- Routing Export ---
function getRoutingExportHistory() {
try { return JSON.parse(localStorage.getItem('routingExportHistory') || '{}'); } catch(e) { return {}; }
}
function saveRoutingExportHistory(history) {
localStorage.setItem('routingExportHistory', JSON.stringify(history));
}
function buildRoutingRows(latestActivity) {
const rows = [];
const assignedLocIds = new Set();
const actMap = latestActivity || {};
physicians.forEach(phys => {
const assigns = physicianAssignments[phys.id] || [];
const activity = actMap[phys.id] || null;
if (assigns.length === 0) {
rows.push({ key: 'phys_' + phys.id, phys, loc: null, practice: null, type: 'phys-only', activity });
} else {
assigns.forEach(a => {
const loc = a.practice_locations || practiceLocations.find(l => l.id === a.practice_location_id);
if (!loc) return;
assignedLocIds.add(loc.id);
const practice = practices.find(pr => pr.id === loc.practice_id);
rows.push({ key: 'pl_' + phys.id + '_' + loc.id, phys, loc, practice, type: 'phys-loc', activity });
});
}
});
practiceLocations.forEach(loc => {
if (assignedLocIds.has(loc.id)) return;
const practice = practices.find(pr => pr.id === loc.practice_id);
rows.push({ key: 'loc_' + loc.id, phys: null, loc, practice, type: 'loc-only', activity: null });
});
return rows;
}
async function openRoutingExport() {
cachedLatestActivity = {};
try {
const {data:allLogs} = await db.from('contact_logs').select('*').order('contact_date',{ascending:false});
if (allLogs) {
allLogs.forEach(l => { if (!cachedLatestActivity[l.provider_id]) cachedLatestActivity[l.provider_id] = l; });
}
} catch(e) { console.error('Could not load activity for routing:', e); }
const history = getRoutingExportHistory();
const rows = buildRoutingRows(cachedLatestActivity);
let newCount = 0, exportedCount = 0, noPhysCount = 0;
const listHTML = rows.map(r => {
const exported = history[r.key];
const isNew = !exported;
if (r.type === 'loc-only') noPhysCount++;
if (isNew) newCount++; else exportedCount++;
const physName = r.phys ? `${r.phys.first_name} ${r.phys.last_name}${r.phys.degree ? ', ' + r.phys.degree : ''}` : '(No provider assigned)';
const practiceName = r.practice?.name || r.loc?.practices?.name || 'No practice';
const addr = r.loc ? [r.loc.address, r.loc.city, r.loc.zip].filter(Boolean).join(', ') : 'No location';
const activityNote = r.activity ? r.activity.notes || '' : '';
const activityPreview = activityNote.replace(/^\[\d{1,2}:\d{2}\]\s*/, '').substring(0, 60) + (activityNote.length > 60 ? '...' : '');
const activityDate = r.activity?.contact_date || '';
const statusLine = activityDate ? `<div style="font-size:0.7rem;color:#1e3a8a;margin-top:0.125rem;">Last: ${activityDate} — ${activityPreview}</div>` : '';
const rowClass = r.type === 'loc-only' ? 'no-phys-row' : (isNew ? 'new-row' : 'exported-row');
const badgeClass = isNew ? 'new' : 'exported';
const badgeText = isNew ? 'NEW' : 'Exported ' + exported;
return `<div class="routing-row ${rowClass}" onclick="this.querySelector('input').checked=!this.querySelector('input').checked">
<input type="checkbox" data-key="${r.key}" ${isNew ? 'checked' : ''} onclick="event.stopPropagation()">
<div class="routing-row-content">
<div class="routing-row-name">${physName}</div>
<div class="routing-row-detail">${practiceName} — ${addr}</div>
${statusLine}
</div>
<span class="routing-row-badge ${badgeClass}">${badgeText}</span>
</div>`;
}).join('');
$('routingExportSummary').innerHTML = `<strong>${newCount}</strong> new row${newCount !== 1 ? 's' : ''} to export &nbsp;|&nbsp; <strong>${exportedCount}</strong> previously exported &nbsp;|&nbsp; <strong>${noPhysCount}</strong> practice${noPhysCount !== 1 ? 's' : ''} without providers`;
$('routingExportList').innerHTML = listHTML || '<div class="empty-notice">No data to export. Add providers or practices first.</div>';
$('routingExportNewBtn').textContent = `Export New Only (${newCount})`;
$('routingExportModal').classList.add('active');
}
function closeRoutingExport() { closeModal('routingExportModal'); }
function getRoutingCSVHeaders() {
return ['ORIG','CALL','AS?','Target','Rank','Provider First Name','Provider Last Name','First Last','Degree','Status','Specialty','Facility (full name)','Address','City','Zip','Phone Number','Vol','County','Notes'];
}
function routingRowToCSV(r) {
const p = r.phys;
const l = r.loc;
const pr = r.practice;
const practiceName = pr?.name || l?.practices?.name || '';
let status = '';
if (r.activity) {
const note = (r.activity.notes || '').replace(/^\[\d{1,2}:\d{2}\]\s*/, '');
const preview = note.length > 80 ? note.substring(0, 80) + '...' : note;
status = fmtDateMD(r.activity.contact_date) + ': ' + preview;
}
if (r.type === 'loc-only') {
return ['','','','','','(Enter HCP first name)','(Enter HCP last name)','','',status,'',practiceName,l?.address||'',l?.city||'',l?.zip||'',fmtPhone(l?.phone),'',l?.city?guessCounty(l.city):'',l?.practice_email?'Email: '+l.practice_email:''];
}
const firstName = p?.first_name || '';
const lastName = p?.last_name || '';
const firstLast = (firstName + ' ' + lastName).trim();
const degree = p?.degree || '';
const rank = p?.priority || '';
const vol = p?.proj_vol || p?.mohs_volume || '';
const county = l?.city ? guessCounty(l.city) : '';
const notes = p?.general_notes || '';
const asVal = p?.advanced_solution ? 'Y' : '';
const targetVal = p?.is_target ? 'Y' : '';
return ['','' ,asVal,targetVal,rank,firstName,lastName,firstLast,degree,status,p?.specialty||'',practiceName,l?.address||'',l?.city||'',l?.zip||'',fmtPhone(l?.phone),vol,county,notes];
}
function guessCounty(city) {
if (!city) return '';
const c = city.toLowerCase();
const mdCities = ['miami','hialeah','homestead','key biscayne','coral gables','south miami','palmetto bay','doral','north miami','aventura','miami beach','miami gardens','miami lakes','opa-locka','sunny isles','key largo','pinecrest','bay harbor islands','bal harbour','surfside','miami shores','cutler bay','kendall','el portal','biscayne park','sweetwater','west miami','florida city','leisure city','perrine','naranja','virginia gardens','medley'];
const brCities = ['fort lauderdale','hollywood','pembroke pines','coral springs','deerfield beach','plantation','davie','weston','tamarac','lauderdale lakes','coconut creek','pompano beach','cooper city','hallandale beach','margate','miramar','sunrise','oakland park','wilton manors','lauderhill','north lauderdale','parkland','lighthouse point','dania beach','hillsboro beach','sea ranch lakes','lazy lake'];
const pbCities = ['west palm beach','boca raton','boynton beach','delray beach','palm beach gardens','jupiter','lake worth','wellington','royal palm beach','belle glade','palm city','atlantis','north palm beach','greenacres','riviera beach','lake worth beach','juno beach','highland beach','tequesta','loxahatchee','palm beach shores','south bay','pahokee'];
if (mdCities.some(mc => c.includes(mc))) return 'Miami-Dade';
if (brCities.some(bc => c.includes(bc))) return 'Broward';
if (pbCities.some(pc => c.includes(pc))) return 'Palm Beach';
return '';
}
function routingExportSelected(onlyNew) {
const checkboxes = document.querySelectorAll('#routingExportList input[type="checkbox"]');
const allRows = buildRoutingRows(cachedLatestActivity);
const rowMap = {};
allRows.forEach(r => rowMap[r.key] = r);
const history = getRoutingExportHistory();
const stamp = todayStamp();
const selectedKeys = [];
checkboxes.forEach(cb => {
if (onlyNew) {
if (!history[cb.dataset.key]) selectedKeys.push(cb.dataset.key);
} else {
selectedKeys.push(cb.dataset.key);
}
});
if (selectedKeys.length === 0) { showToast('No rows to export', 'info'); return; }
const headers = getRoutingCSVHeaders();
const csvRows = selectedKeys.map(key => { const r = rowMap[key]; if (!r) return null; return routingRowToCSV(r); }).filter(Boolean);
downloadCSV('field_routing_' + stamp + '.csv', headers, csvRows);
selectedKeys.forEach(key => { history[key] = stamp; });
saveRoutingExportHistory(history);
showToast(`Exported ${selectedKeys.length} row${selectedKeys.length !== 1 ? 's' : ''} for field routing`, 'success');
openRoutingExport();
}
function routingExportNew() { routingExportSelected(true); }
function routingExportAll() { routingExportSelected(false); }
function routingClearHistory() {
if (!confirm('Clear all export history? Everything will show as "NEW" again.')) return;
localStorage.removeItem('routingExportHistory');
showToast('Export history cleared', 'info');
openRoutingExport();
}

// --- Target Review ---
let _trFilter = 'all'; // 'all' | 'yes' | 'no'

function openTargetReview() {
  _trFilter = 'all';
  $('targetReviewModal').classList.add('active');
  renderTargetReviewList();
}

function setTargetFilter(f) {
  _trFilter = f;
  ['all','yes','no'].forEach(k => {
    const btn = $('trFilter' + k.charAt(0).toUpperCase() + k.slice(1));
    if (btn) { btn.style.background = k === f ? '#1e3a8a' : '#e5e5e5'; btn.style.color = k === f ? 'white' : '#555'; }
  });
  renderTargetReviewList();
}

function renderTargetReviewList() {
  const list = $('targetReviewList');
  const stats = $('targetReviewStats');
  if (!list) return;
  const total = physicians.length;
  const targets = physicians.filter(p => p.is_target).length;
  if (stats) stats.textContent = `${targets} of ${total} marked as targets`;
  let filtered = physicians;
  if (_trFilter === 'yes') filtered = physicians.filter(p => p.is_target);
  else if (_trFilter === 'no') filtered = physicians.filter(p => !p.is_target);
  const tierOrder = ['1','2','3','4','5',''];
  const byTier = {};
  tierOrder.forEach(t => byTier[t] = []);
  filtered.forEach(p => { const t = normPriority(p.priority) || ''; if (!byTier[t]) byTier[t] = []; byTier[t].push(p); });
  let html = '';
  tierOrder.forEach(tier => {
    const group = byTier[tier] || [];
    if (!group.length) return;
    const tierLabel = tier ? `P${tier}` : 'No Tier';
    const tierColor = tier === '1' ? '#dc2626' : tier === '2' ? '#f97316' : tier === '3' ? '#f59e0b' : tier === '4' ? '#6366f1' : '#9ca3af';
    html += `<div style="padding:0.4rem 1rem 0.2rem;font-size:0.7rem;font-weight:800;color:${tierColor};text-transform:uppercase;letter-spacing:1px;background:#fafafa;border-top:1px solid #f0f0f0;border-bottom:1px solid #f0f0f0;">${tierLabel} — ${group.length} provider${group.length !== 1 ? 's' : ''}</div>`;
    group.forEach(p => {
      const pracName = (() => { const asgn = physicianAssignments[p.id]; if (!asgn || !asgn.length) return ''; const loc = asgn[0].practice_locations || practiceLocations.find(l => l.id === asgn[0].practice_location_id); return loc?.practices?.name || getPracticeName(loc?.practice_id) || ''; })();
      const city = (() => { const asgn = physicianAssignments[p.id]; if (!asgn || !asgn.length) return ''; const loc = asgn[0].practice_locations || practiceLocations.find(l => l.id === asgn[0].practice_location_id); return loc?.city || ''; })();
      const isTarget = !!p.is_target;
      const btnStyle = isTarget ? 'background:#10b981;color:white;border:2px solid #10b981;' : 'background:#f3f4f6;color:#9ca3af;border:2px solid #e5e7eb;';
      const btnLabel = isTarget ? '✓ TARGET' : '✗ SKIP';
      html += `<div style="display:flex;align-items:center;gap:0.75rem;padding:0.7rem 1rem;border-bottom:1px solid #f5f5f5;${!isTarget ? 'opacity:0.65;' : ''}">
<div style="flex:1;min-width:0;">
<div style="font-weight:700;font-size:0.9rem;color:#1e3a8a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${fmtName(p)}</div>
<div style="font-size:0.75rem;color:#666;margin-top:0.1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.specialty || ''}${pracName ? ' · ' + pracName : ''}${city ? ' · ' + city : ''}</div>
</div>
<button id="trBtn-${p.id}" onclick="toggleReviewTarget('${p.id}')" style="flex-shrink:0;padding:0.45rem 0.8rem;border-radius:8px;font-size:0.78rem;font-weight:800;cursor:pointer;min-width:80px;text-align:center;touch-action:manipulation;-webkit-tap-highlight-color:transparent;${btnStyle}">${btnLabel}</button>
</div>`;
    });
  });
  if (!html) html = '<div style="padding:2rem;text-align:center;color:#999;">No providers match this filter.</div>';
  list.innerHTML = html;
}

async function toggleReviewTarget(id) {
  const p = physicians.find(ph => ph.id === id);
  if (!p) return;
  const newVal = !p.is_target;
  const btn = $('trBtn-' + id);
  if (btn) {
    btn.style.background = newVal ? '#10b981' : '#f3f4f6';
    btn.style.color = newVal ? 'white' : '#9ca3af';
    btn.style.borderColor = newVal ? '#10b981' : '#e5e7eb';
    btn.textContent = newVal ? '✓ TARGET' : '✗ SKIP';
    btn.parentElement.style.opacity = newVal ? '1' : '0.65';
  }
  const { error } = await db.from('providers').update({ is_target: newVal }).eq('id', id);
  if (error) {
    showToast('Error: ' + error.message, 'error');
    if (btn) {
      btn.style.background = p.is_target ? '#10b981' : '#f3f4f6';
      btn.style.color = p.is_target ? 'white' : '#9ca3af';
      btn.style.borderColor = p.is_target ? '#10b981' : '#e5e7eb';
      btn.textContent = p.is_target ? '✓ TARGET' : '✗ SKIP';
      btn.parentElement.style.opacity = p.is_target ? '1' : '0.65';
    }
    return;
  }
  p.is_target = newVal;
  const idx = physicians.findIndex(ph => ph.id === id);
  if (idx >= 0) physicians[idx].is_target = newVal;
  saveCrmCache();
  const statsEl = $('targetReviewStats');
  if (statsEl) { const t = physicians.filter(ph => ph.is_target).length; statsEl.textContent = `${t} of ${physicians.length} marked as targets`; }
}

// ============================================================
// === CARD / SCREENSHOT SCAN (Claude vision API) ===
// ============================================================

function openCardScan() {
  const inp = $('cardScanInput');
  if (!inp) return;
  inp.value = '';
  inp.click();
}

async function handleCardScan(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';
  if (!getAnthropicKey()) {
    showToast('Set your Anthropic API key in Admin → Scan Settings first', 'error');
    return;
  }
  showToast('Scanning — this takes a few seconds…', 'info');
  try {
    const { base64, type } = await _compressScanImage(file);
    const extracted = await _callScanAPI(base64, type);
    _openScanReview(extracted);
  } catch(e) {
    console.error('Card scan error:', e);
    showToast('Scan failed: ' + e.message, 'error');
  }
}

async function _compressScanImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1400;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w >= h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => {
        const reader = new FileReader();
        reader.onload = e => resolve({ base64: e.target.result.split(',')[1], type: 'image/jpeg' });
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      }, 'image/jpeg', 0.88);
    };
    img.onerror = reject;
    img.src = url;
  });
}

async function _callScanAPI(base64, mimeType) {
  const prompt = `Extract provider/practitioner information from this business card or medical website screenshot for a wound care CRM. Return ONLY a JSON object — no markdown, no extra text, no explanation.

Required fields (use empty string "" for anything not visible):
{"first_name":"","last_name":"","degree":"","title":"","specialty":"","email":"","mobile_phone":"","practice_name":"","address":"","city":"","zip":"","phone":"","fax":"","website":""}

Rules:
- degree: MD, DO, DPM, PA-C, NP, RN, PhD, or other credential after the name
- specialty: choose one of Podiatry, Wound Care, Dermatology, Other, or Staff
- title: role/position (e.g. "Wound Care Specialist", "Mohs Surgeon", "Office Manager")
- phone/fax/mobile: digits and dashes only, no parens
- address: street only, no city/state/zip
- If multiple phone numbers, put office line in phone and mobile in mobile_phone`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': getAnthropicKey(),
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-calls': 'true'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
        { type: 'text', text: prompt }
      ]}]
    })
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || 'API error ' + resp.status);
  }
  const data = await resp.json();
  const raw = (data.content[0]?.text || '').trim();
  const clean = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
  return JSON.parse(clean);
}

function _openScanReview(d) {
  const set = (id, val) => { const el = $(id); if (el) el.value = val || ''; };
  set('scanFirstName', d.first_name);
  set('scanLastName', d.last_name);
  set('scanTitle', d.title);
  set('scanEmail', d.email);
  set('scanMobile', d.mobile_phone);
  set('scanPracticeName', d.practice_name);
  set('scanAddress', normalizeAddr(d.address));
  set('scanCity', d.city);
  set('scanZip', d.zip);
  set('scanPhone', d.phone);
  set('scanFax', d.fax);
  set('scanWebsite', d.website);
  const deg = $('scanDegree');
  if (deg) { const opts = Array.from(deg.options); const match = opts.find(o => o.value.toLowerCase() === (d.degree||'').toLowerCase()); deg.value = match ? match.value : ''; }
  const spec = $('scanSpecialty');
  if (spec) { const opts = Array.from(spec.options); const match = opts.find(o => o.value.toLowerCase() === (d.specialty||'').toLowerCase()); spec.value = match ? match.value : ''; }
  if ($('scanSaveStatus')) $('scanSaveStatus').textContent = '';
  $('cardScanModal').classList.add('active');
}

async function saveScanResult() {
  const firstName = ($('scanFirstName').value || '').trim();
  const lastName = ($('scanLastName').value || '').trim();
  if (!firstName && !lastName) { showToast('First or last name required', 'error'); return; }
  const statusEl = $('scanSaveStatus');
  const status = s => { if (statusEl) statusEl.textContent = s; };
  status('Saving…');
  updateSyncIndicators('syncing');
  try {
    const practiceName = ($('scanPracticeName').value || '').trim();
    const address = normalizeAddr($('scanAddress').value);
    const city = ($('scanCity').value || '').trim();
    const zip = ($('scanZip').value || '').trim();
    const phone = ($('scanPhone').value || '').trim();
    const fax = ($('scanFax').value || '').trim();
    const website = ($('scanWebsite').value || '').trim();
    let practiceId = null;
    if (practiceName) {
      const { data: ex } = await db.from('practices').select('id').ilike('name', practiceName).limit(1);
      if (ex && ex.length > 0) { practiceId = ex[0].id; }
      else {
        const { data: np, error: pe } = await db.from('practices').insert({ name: practiceName, website }).select().single();
        if (pe) throw pe;
        practiceId = np.id; practices.push(np);
      }
    }
    let locationId = null;
    if (practiceId || address || city) {
      let existLoc = null;
      if (practiceId && address) {
        const { data: el } = await db.from('practice_locations').select('id').eq('practice_id', practiceId).ilike('address', address).limit(1);
        if (el && el.length > 0) existLoc = el[0];
      }
      if (!existLoc) {
        const { data: nl, error: le } = await db.from('practice_locations').insert({
          practice_id: practiceId, label: city || practiceName || 'Office',
          address, city, zip, phone, fax
        }).select().single();
        if (le) throw le;
        locationId = nl.id; practiceLocations.push(nl);
      } else { locationId = existLoc.id; }
    }
    const { data: newProv, error: provErr } = await db.from('providers').insert({
      first_name: firstName, last_name: lastName,
      degree: ($('scanDegree').value || '').trim(),
      title: ($('scanTitle').value || '').trim(),
      specialty: ($('scanSpecialty').value || '').trim(),
      email: ($('scanEmail').value || '').trim(),
      mobile_phone: ($('scanMobile').value || '').trim(),
      is_target: true
    }).select().single();
    if (provErr) throw provErr;
    physicians.push(newProv);
    if (locationId) {
      await db.from('provider_location_assignments').insert({
        provider_id: newProv.id, practice_location_id: locationId, is_primary: true
      });
    }
    saveCrmCache(); renderList(); updateSyncIndicators('synced');
    closeModal('cardScanModal');
    showToast(`${firstName} ${lastName} added to CRM ✓`, 'success');
    setTimeout(() => { setView('physicians'); viewPhysician(newProv.id); }, 350);
  } catch(e) {
    console.error('Scan save error:', e);
    status('Error: ' + e.message);
    showToast('Save failed: ' + e.message, 'error');
    updateSyncIndicators('error');
  }
}
