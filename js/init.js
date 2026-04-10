// === js/init.js === Constants, DB client, global state, core utilities, DOMContentLoaded
const SUPABASE_URL = 'https://kpozqhksfynpfsrbroih.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_fPHW4v5YAE5-kwY3mWQSQA_2W0zaMAm';
// Anthropic key stored in localStorage (set once via admin panel — never committed to git)
function getAnthropicKey() { return localStorage.getItem('anthropic_api_key') || ''; }
const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $=id=>document.getElementById(id);
async function withSave(btnId,label,fn){const btn=$(btnId);if(btn.classList.contains('saving')){showToast('Save in progress…','error');return;}btn.textContent='Saving...';btn.classList.add('saving');const _reset=()=>{btn.textContent=label;btn.classList.remove('saving');updateSyncIndicators('error');};const _timeout=setTimeout(()=>{if(btn.classList.contains('saving')){_reset();showToast('Save timed out — check connection','error');}},12000);try{updateSyncIndicators('syncing');await fn();clearTimeout(_timeout);btn.textContent='Saved!';btn.classList.remove('saving');btn.classList.add('saved');updateSyncIndicators('synced');}catch(e){clearTimeout(_timeout);console.error('Save error:',e);showToast('Error: '+e.message,'error');_reset();throw e;}}
async function dbDel(table,id,msg,after){if(!confirm(msg))return;try{updateSyncIndicators('syncing');const{error}=await db.from(table).delete().eq('id',id);if(error)throw error;await after();showToast('Deleted','success');updateSyncIndicators('synced');}catch(e){console.error('Delete error:',e);showToast('Error: '+e.message,'error');updateSyncIndicators('error');}}
function setFields(map){for(const[id,val]of Object.entries(map))$(id).value=val;}

// --- Global state ---
let physicians = [];
let practices = [];
let practiceLocations = [];
let physicianAssignments = {};
let contactLogs = {};
let currentPhysician = null;
let currentPractice = null;
let currentView = 'physicians';
let _prevView = null;
let sortBy = 'name';
let filterTier = null;
let filterTarget = false;
let currentLocationId = null;
let editMode = false;
let editingContactId = null;
let editingLocationId = null;
let editingPracticeId = null;
let selectedPracticeId = null;
let selectedLocationIds = [];
let cachedLatestActivity = {};

document.addEventListener('DOMContentLoaded', async () => {
setToday();
initDemoUserName();
await loadAllData();
setupRealtimeSubscription();
initCallLogInterceptor();
// Deep-link routing: ?goto=practice&id=UUID (used by db_audit.html Edit Profile buttons)
const _goto = new URLSearchParams(window.location.search);
if (_goto.get('goto') === 'practice' && _goto.get('id')) {
  setView('practices');
  viewPractice(_goto.get('id'));
} else if (_goto.get('goto') === 'provider' && _goto.get('id')) {
  setView('physicians');
  viewPhysician(_goto.get('id'));
} else {
  setView('physicians'); // HCP list in sidebar
  renderEmptyState();    // tasks/reminders in main content
}
// iOS body scroll lock — prevents background scroll when any modal is open
// On iOS Safari (especially standalone/Home Screen), position:fixed modals
// still allow the body to scroll behind them unless the body is locked.
let _iosScrollY = 0;
let _iosBodyLocked = false;
function _lockBodyScroll() {
  if (_iosBodyLocked) return;
  _iosBodyLocked = true;
  _iosScrollY = window.scrollY;
  document.body.style.position = 'fixed';
  document.body.style.top = `-${_iosScrollY}px`;
  document.body.style.width = '100%';
  document.body.style.overflow = 'hidden';
}
function _unlockBodyScroll() {
  if (!_iosBodyLocked) return;
  _iosBodyLocked = false;
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.width = '';
  document.body.style.overflow = '';
  window.scrollTo(0, _iosScrollY);
}
// Watch all modals for active class changes
const _modalObserver = new MutationObserver(() => {
  const anyOpen = !!document.querySelector('.modal.active');
  if (anyOpen) _lockBodyScroll(); else _unlockBodyScroll();
});
document.querySelectorAll('.modal').forEach(m => {
  _modalObserver.observe(m, { attributes: true, attributeFilter: ['class'] });
});
// DPM ↔ Podiatry auto-set (main provider modal)
$('degree').addEventListener('change', function() {
if (this.value === 'DPM' && !$('specialty').value) $('specialty').value = 'Podiatry';
});
$('specialty').addEventListener('change', function() {
if (this.value === 'Podiatry' && !$('degree').value) $('degree').value = 'DPM';
});
// DPM ↔ Podiatry auto-set (quick-add modal)
$('quickPhysDegree').addEventListener('change', function() {
if (this.value === 'DPM' && !$('quickPhysSpecialty').value) $('quickPhysSpecialty').value = 'Podiatry';
});
$('quickPhysSpecialty').addEventListener('change', function() {
if (this.value === 'Podiatry' && !$('quickPhysDegree').value) $('quickPhysDegree').value = 'DPM';
});
});

// ── Demo: user name prompt ────────────────────────────────────────────────────
function saveUserName() {
  const val = ($('namePromptInput').value || '').trim();
  if (!val) { $('namePromptInput').style.border = '2px solid #dc2626'; return; }
  localStorage.setItem('lastCallLogAuthor', val);
  $('namePromptModal').classList.remove('active');
}
function initDemoUserName() {
  const saved = localStorage.getItem('lastCallLogAuthor');
  if (saved) {
    $('namePromptModal').classList.remove('active');
  } else {
    $('namePromptModal').classList.add('active');
    setTimeout(() => $('namePromptInput').focus(), 300);
  }
  // Pre-fill both author inputs whenever they're empty
  const fill = () => {
    const n = localStorage.getItem('lastCallLogAuthor') || '';
    if ($('authorName') && !$('authorName').value) $('authorName').value = n;
    // addTaskAuthor is a <select> populated at modal-open time — no prefill needed here
  };
  document.addEventListener('click', fill);
  fill();
}
// Enter key submits name prompt
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && $('namePromptModal')?.classList.contains('active')) saveUserName();
});

// ── Demo: reset all data and re-seed ─────────────────────────────────────────
async function resetDemoData() {
  if (!confirm('Reset demo to original 50 providers? This clears all activity logs and contact notes.')) return;
  window.location.href = '/CRMtool/demo-seed.html?autorun=true';
}

// Returns YYYY-MM-DD in the user's LOCAL timezone (not UTC)
function localDate(d) { const dt=d||new Date(); return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0'); }

function setToday() {
const now = new Date();
$('contactDate').value = localDate(now);
$('contactTime').value = String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
}

function showToast(message, type = 'info') {
const container = $('toastContainer');
const toast = document.createElement('div');
toast.className = `toast ${type}`;
toast.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:0.5rem;';
const msg = document.createElement('span');
msg.textContent = message;
toast.appendChild(msg);
if (type === 'error') {
const closeBtn = document.createElement('button');
closeBtn.textContent = '\u00d7';
closeBtn.style.cssText = 'background:none;border:none;color:white;font-size:1.5rem;cursor:pointer;padding:0 0.25rem;flex-shrink:0;';
closeBtn.onclick = () => toast.remove();
toast.appendChild(closeBtn);
}
container.appendChild(toast);
const duration = type === 'error' ? 10000 : 3000;
setTimeout(() => toast.remove(), duration);
}

function updateConnectionStatus(status) {
const el = $('connectionStatus');
el.className = `connection-status ${status}`;
el.textContent = status === 'connected' ? 'Connected - Real-time sync active' :
status === 'syncing' ? 'Syncing...' : 'Disconnected - Working offline';
el.classList.remove('hidden');
if (status === 'connected') {
setTimeout(() => el.classList.add('hidden'), 2000);
}
}

function updateSyncIndicators(status) {
const classes = { synced: 'synced', syncing: 'syncing', error: 'error' };
$('mobileSyncIndicator').className = `sync-indicator ${classes[status] || 'synced'}`;
$('desktopSyncIndicator').className = `sync-indicator ${classes[status] || 'synced'}`;
}
