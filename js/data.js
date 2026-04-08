// === js/data.js === Data loading, migrations, contact log fetching
function isStaffSpecialty(s){return s==='Staff'||s==='Administrative Staff';}

// --- Local cache helpers ---
const _CRM_CACHE_KEY='crmCache_v1';
function saveCrmCache(){try{localStorage.setItem(_CRM_CACHE_KEY,JSON.stringify({physicians,practices,locations:practiceLocations,assignments:physicianAssignments,ts:Date.now()}));}catch(e){}}
// Re-fetch a single provider's assignments (1 query vs 4) and update in-memory + cache
async function refreshAssignments(providerId){try{const{data,error}=await db.from('provider_location_assignments').select('*, practice_locations(*, practices(name))').eq('provider_id',providerId);if(!error&&data){physicianAssignments[providerId]=data;saveCrmCache();}}catch(e){console.warn('refreshAssignments error:',e);}}

async function loadAllData(){
// Fast path: render from localStorage cache immediately (eliminates cold-start blank screen)
try{
const raw=localStorage.getItem(_CRM_CACHE_KEY);
if(raw){const c=JSON.parse(raw);if(c&&c.ts&&(Date.now()-c.ts)<3600000){physicians=c.physicians||[];practices=c.practices||[];practiceLocations=c.locations||[];physicianAssignments=c.assignments||{};renderList();}}
}catch(e){}
// Always refresh from network — updates cache when done
try{
updateSyncIndicators('syncing');
const[physRes,practRes,locRes,assignRes]=await Promise.all([
  db.from('providers').select('*').order('last_name',{ascending:true}),
  db.from('practices').select('*').order('name',{ascending:true}),
  db.from('practice_locations').select('*, practices(name)').order('city',{ascending:true}),
  db.from('provider_location_assignments').select('*, practice_locations(*, practices(name))'),
]);
if(physRes.error)throw physRes.error;
physicians=physRes.data||[];
if(!practRes.error)practices=practRes.data||[];
if(!locRes.error)practiceLocations=locRes.data||[];
if(!assignRes.error){physicianAssignments={};(assignRes.data||[]).forEach(a=>{if(!physicianAssignments[a.provider_id])physicianAssignments[a.provider_id]=[];physicianAssignments[a.provider_id].push(a);});}
saveCrmCache();
territoryMapCache=null;
renderList();
updateSyncIndicators('synced');
updateConnectionStatus('connected');
fixEncodingCorruptions().catch(e=>console.warn('Encoding fix error:',e));
}catch(error){
console.error('Error loading data:',error);
updateSyncIndicators('error');
showToast('Error loading data: '+error.message,'error');
}
}

// Silently repairs common encoding corruptions in provider/practice names.
// Runs after each loadAllData() call; no-ops when nothing is broken.
async function fixEncodingCorruptions() {
function repair(s) {
  if (!s || !/[^\x00-\x7F]/.test(s)) return s;
  let r = s;
  // UTF-8 double-encoded as Latin-1 (Ã-prefix sequences)
  r = r.replace(/Ã©/g,'é').replace(/Ã¨/g,'è').replace(/Ã§/g,'ç').replace(/Ã¡/g,'á')
       .replace(/Ã³/g,'ó').replace(/Ã±/g,'ñ').replace(/Ã­/g,'í').replace(/Ãº/g,'ú')
       .replace(/Ã /g,'à').replace(/Ã¢/g,'â').replace(/Ã´/g,'ô').replace(/Ã»/g,'û')
       .replace(/Ãª/g,'ê').replace(/Ã®/g,'î').replace(/Ã«/g,'ë').replace(/Ã¯/g,'ï')
       .replace(/Ã¼/g,'ü').replace(/Ã¶/g,'ö').replace(/Ã¤/g,'ä').replace(/Ã /g,'Ã');
  // Uppercase-accented letter sandwiched between lowercase = corruption (e.g. FranÁois → François)
  // Á (U+00C1) mid-word in French/Spanish context → ç
  r = r.replace(/([a-z])Á([a-z])/g, (m,a,b) => a+'ç'+b);
  // É mid-word (not at start) → é
  r = r.replace(/([a-z])É([a-z])/g, (m,a,b) => a+'é'+b);
  return r;
}
const provFixes = physicians.filter(p => {
  const fn=repair(p.first_name), ln=repair(p.last_name);
  return fn!==p.first_name || ln!==p.last_name;
});
const pracFixes = practices.filter(p => repair(p.name)!==p.name);
for (const p of provFixes) {
  const fn=repair(p.first_name), ln=repair(p.last_name);
  const {error} = await db.from('providers').update({first_name:fn,last_name:ln}).eq('id',p.id);
  if (!error) { p.first_name=fn; p.last_name=ln; console.log(`Fixed name: ${fn} ${ln}`); }
}
for (const p of pracFixes) {
  const nm=repair(p.name);
  const {error} = await db.from('practices').update({name:nm}).eq('id',p.id);
  if (!error) { p.name=nm; console.log(`Fixed practice: ${nm}`); }
}
if (provFixes.length+pracFixes.length > 0) renderList();
}

async function loadContactLogs(physicianId) {
try {
const { data, error } = await db
.from('contact_logs')
.select('*')
.eq('provider_id', physicianId)
.order('contact_date', { ascending: false })
.order('created_at', { ascending: false });
if (error) throw error;
contactLogs[physicianId] = data || [];
} catch (error) {
console.error('Error loading contact logs:', error);
}
}
