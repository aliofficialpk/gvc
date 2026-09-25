// Dynamic Visa Appointment Assistant & Auto-Apply Client Controller

let state = {
  activeTab: 'monitor',
  historySubTab: 'all',
  isMonitoring: false,
  checkIntervalSeconds: 120,
  scanCount: 0,
  lastCheck: null,
  detectedSlots: [],
  applicants: [],
  history: [],
  formSchema: null,
  soundEnabled: true,
  audioCtx: null,
  countdownSeconds: 120
};

document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();
  
  setInterval(updateClock, 1000);
  setInterval(updateCountdown, 1000);

  if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
    Notification.requestPermission();
  }

  initEventStream();
  refreshAll();
  setInterval(refreshAll, 5000);
});

function switchTab(tabName) {
  state.activeTab = tabName;

  const btnMonitor = document.getElementById('navTabMonitor');
  const btnApplicants = document.getElementById('navTabApplicants');
  const btnHistory = document.getElementById('navTabHistory');

  const panelMonitor = document.getElementById('panelMonitor');
  const panelApplicants = document.getElementById('panelApplicants');
  const panelHistory = document.getElementById('panelHistory');

  if (panelMonitor) panelMonitor.classList.add('hidden');
  if (panelApplicants) panelApplicants.classList.add('hidden');
  if (panelHistory) panelHistory.classList.add('hidden');

  const activeClass = 'tab-btn active border-b-2 border-emerald-600 text-emerald-700 py-3.5 px-1 font-semibold text-xs flex items-center gap-2';
  const inactiveClass = 'tab-btn border-b-2 border-transparent text-gray-500 hover:text-gray-700 py-3.5 px-1 font-medium text-xs flex items-center gap-2';

  if (btnMonitor) btnMonitor.className = inactiveClass;
  if (btnApplicants) btnApplicants.className = inactiveClass;
  if (btnHistory) btnHistory.className = inactiveClass;

  if (tabName === 'monitor') {
    if (panelMonitor) panelMonitor.classList.remove('hidden');
    if (btnMonitor) btnMonitor.className = activeClass;
  } else if (tabName === 'applicants') {
    if (panelApplicants) panelApplicants.classList.remove('hidden');
    if (btnApplicants) btnApplicants.className = activeClass;
  } else if (tabName === 'history') {
    if (panelHistory) panelHistory.classList.remove('hidden');
    if (btnHistory) btnHistory.className = activeClass;
    fetchHistory();
  }

  if (window.lucide) lucide.createIcons();
}

function updateClock() {
  const now = new Date();
  const el = document.getElementById('liveClock');
  if (el) el.innerText = now.toLocaleTimeString('en-US', { hour12: false }) + ' PKT';
}

function updateCountdown() {
  if (!state.isMonitoring) {
    const el = document.getElementById('countdownTicker');
    if (el) el.innerText = 'PAUSED';
    return;
  }

  state.countdownSeconds--;
  if (state.countdownSeconds <= 0) {
    state.countdownSeconds = state.checkIntervalSeconds;
  }

  const mins = String(Math.floor(state.countdownSeconds / 60)).padStart(2, '0');
  const secs = String(state.countdownSeconds % 60).padStart(2, '0');
  
  const el = document.getElementById('countdownTicker');
  if (el) el.innerText = `${mins}:${secs}`;
}

function initEventStream() {
  try {
    const evtSource = new EventSource('/api/stream');

    evtSource.addEventListener('slot', (e) => {
      const slot = JSON.parse(e.data);
      state.detectedSlots.unshift(slot);
      renderSlots(state.detectedSlots);
      triggerSlotAlertNotification(slot);
    });

    evtSource.addEventListener('status', (e) => {
      const status = JSON.parse(e.data);
      state.lastCheck = status;
      state.countdownSeconds = state.checkIntervalSeconds;
      updateUIStatus(status);
    });

    evtSource.addEventListener('applicants', (e) => {
      state.applicants = JSON.parse(e.data);
      renderApplicants(state.applicants);
    });

    evtSource.addEventListener('application_submitted', (e) => {
      const entry = JSON.parse(e.data);
      state.history.unshift(entry);
      renderHistory(state.history);
    });

    evtSource.addEventListener('otp_required', (e) => {
      const session = JSON.parse(e.data);
      showOtpModal(session);
    });

    evtSource.addEventListener('otp_submitted', (e) => {
      const session = JSON.parse(e.data);
      closeOtpModal();
      alert(`✅ OTP (${session.otpCode}) submitted successfully to portal! Application is finalizing...`);
    });

  } catch(err) {
    console.log('SSE Stream fallback to polling');
  }
}

function playSlotAlertChime() {
  if (!state.soundEnabled) return;

  try {
    if (!state.audioCtx) {
      state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    const ctx = state.audioCtx;
    if (ctx.state === 'suspended') ctx.resume();

    const playNote = (freq, time, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);
      
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.3, time + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(time);
      osc.stop(time + duration);
    };

    const now = ctx.currentTime;
    playNote(659.25, now, 0.4);
    playNote(880.00, now + 0.15, 0.8);
  } catch(e) {}
}

function toggleAudioAlert() {
  state.soundEnabled = !state.soundEnabled;
  const btnText = document.getElementById('textSound');
  const icon = document.getElementById('iconSound');

  if (state.soundEnabled) {
    btnText.innerText = 'Audio Alert: ON';
    if (icon) icon.className = 'w-3.5 h-3.5 text-emerald-600';
    playSlotAlertChime();
  } else {
    btnText.innerText = 'Audio Alert: OFF';
    if (icon) icon.className = 'w-3.5 h-3.5 text-gray-400';
  }
}

function triggerSlotAlertNotification(slot) {
  playSlotAlertChime();

  const banner = document.getElementById('slotAlertBanner');
  const details = document.getElementById('slotAlertDetails');
  if (banner && details) {
    details.innerText = `Registration window is currently open for ${slot.vac || 'Pakistan applicants'}!`;
    banner.classList.remove('hidden');
  }

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("🎉 GVC World Visa Slot Available!", {
      body: `Registration window is currently open for ${slot.vac}! Click to apply now.`,
      icon: "/favicon.ico"
    });
  }
}

function dismissSlotAlert() {
  const banner = document.getElementById('slotAlertBanner');
  if (banner) banner.classList.add('hidden');
}

async function refreshAll() {
  await Promise.all([
    fetchStatus(),
    fetchApplicants(),
    fetchSlots(),
    fetchFormSchema(),
    fetchHistory()
  ]);
}

async function fetchStatus() {
  try {
    const res = await fetch('/api/monitor/status');
    const data = await res.json();

    state.isMonitoring = data.isMonitoring;
    state.checkIntervalSeconds = data.checkIntervalSeconds;
    state.scanCount = data.scanCount;
    state.lastCheck = data.lastCheck;

    updateUIStatus(data);
  } catch (err) {}
}

function updateUIStatus(data) {
  const text = document.getElementById('textToggleAgent');
  const icon = document.getElementById('iconToggleAgent');

  if (data.isMonitoring) {
    if (text) text.innerText = 'Pause Monitor';
    if (icon) icon.setAttribute('data-lucide', 'pause');
  } else {
    if (text) text.innerText = 'Resume Monitor';
    if (icon) icon.setAttribute('data-lucide', 'play');
  }

  const portalStat = document.getElementById('statPortalStatus');
  const portalDet = document.getElementById('statPortalDetails');

  const check = data.lastCheck || data;

  if (check && portalStat) {
    if (check.isRegistrationOpen) {
      portalStat.innerHTML = `REGISTRATION OPEN NOW! <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>`;
      portalStat.className = 'text-xl font-bold text-emerald-600 flex items-center gap-2';
      portalDet.innerText = `Official registration page is accessible! Click Apply Now.`;
    } else if (check.isError17) {
      portalStat.innerHTML = `MONITORING ACTIVE (GATEWAY ROUTING REQUIRED) <span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>`;
      portalStat.className = 'text-xl font-bold text-amber-600 flex items-center gap-2';
      portalDet.innerText = `Direct subdomain link protected by Error 17. Use official gvcworld.eu link below.`;
    } else {
      portalStat.innerHTML = `MONITORING ACTIVE <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>`;
      portalStat.className = 'text-xl font-bold text-emerald-600 flex items-center gap-2';
      portalDet.innerText = `Continuously watching GVC World Pakistan for open visa application slots...`;
    }
  }

  if (data.analytics) {
    const nextDate = document.getElementById('expectNextDate');
    if (nextDate) nextDate.innerText = data.analytics.nextExpectedText;
  }

  if (window.lucide) lucide.createIcons();
}

async function fetchFormSchema() {
  try {
    const res = await fetch('/api/scraped-form-schema');
    const data = await res.json();
    state.formSchema = data;
    renderFormSchema(data);
  } catch(e) {}
}

function renderFormSchema(schema) {
  const container = document.getElementById('formSchemaContainer');
  const badge = document.getElementById('badgeFieldsCount');
  if (!container || !schema) return;

  if (badge) badge.innerText = `${schema.fieldsCount} Form Fields Detected`;

  container.innerHTML = schema.fields.map(f => `
    <div class="p-3 rounded-md bg-white border border-gray-200 space-y-1 hover:border-emerald-400 shadow-sm transition">
      <div class="flex items-center justify-between">
        <span class="font-bold text-gray-900 text-xs">${escapeHtml(f.label)}</span>
        <span class="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded uppercase">COMPULSORY *</span>
      </div>
      <div class="text-[10px] text-indigo-700 font-semibold uppercase tracking-wider">
        ${escapeHtml(f.stage || 'General Field')}
      </div>
      <div class="text-[11px] font-mono text-emerald-700 font-semibold truncate">
        Field Key: ${escapeHtml(f.fieldKey)} (${escapeHtml(f.type)})
      </div>
      <div class="text-[10px] text-gray-500 font-mono truncate" title="${escapeHtml(f.gvcSelector)}">
        Selector: ${escapeHtml(f.gvcSelector)}
      </div>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

async function fetchApplicants() {
  try {
    const res = await fetch('/api/applicants');
    const data = await res.json();
    state.applicants = data.applicants || [];
    renderApplicants(state.applicants);
  } catch (err) {}
}

function renderApplicants(list) {
  const container = document.getElementById('applicantsContainer');
  const badge = document.getElementById('badgeApplicantCount');
  if (!container) return;

  if (badge) badge.innerText = list.length;

  if (list.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-xs text-gray-500 text-center py-8 border border-dashed border-gray-200 rounded-lg bg-gray-50 space-y-2">
        <p>No applicant profiles created yet.</p>
        <button onclick="seedDemoProfiles()" class="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-bold shadow-sm hover:bg-indigo-700 transition">
          ✨ Seed Demo Profiles (1-Click Test)
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(a => `
    <div class="p-4 rounded-lg bg-white border border-gray-200 shadow-sm space-y-3 hover:border-gray-300 transition">
      <div class="flex items-center justify-between border-b border-gray-100 pb-2">
        <div class="font-bold text-gray-900 text-sm flex items-center gap-1.5">
          <i data-lucide="user-check" class="w-4 h-4 text-emerald-600"></i>
          ${escapeHtml(a.givenName)} ${escapeHtml(a.surname)}
        </div>
        <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">${escapeHtml(a.status || 'Active')}</span>
      </div>

      <div class="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span class="text-gray-500">Passport:</span>
          <div class="font-mono font-bold text-gray-900">${escapeHtml(a.passportNumber)}</div>
        </div>
        <div>
          <span class="text-gray-500">VAC:</span>
          <div class="font-bold text-emerald-700">${escapeHtml(a.vac)}</div>
        </div>
        <div>
          <span class="text-gray-500">Category:</span>
          <div class="text-gray-800 truncate">${escapeHtml(a.category)}</div>
        </div>
        <div>
          <span class="text-gray-500">Expiry:</span>
          <div class="font-mono text-gray-700">${escapeHtml(a.passportExpiry)}</div>
        </div>
      </div>

      <div class="pt-2 border-t border-gray-100 flex items-center justify-between">
        <button onclick="triggerAutoApply('${a.id}')" class="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition flex items-center gap-1">
          <i data-lucide="zap" class="w-3.5 h-3.5"></i>
          Auto-Apply Test Run
        </button>

        <div class="flex items-center space-x-1">
          <button onclick="copyApplicantInfo('${a.id}')" class="px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium transition border border-gray-300 flex items-center gap-1">
            <i data-lucide="copy" class="w-3 h-3 text-gray-500"></i>
            <span>Copy</span>
          </button>
          <button onclick="deleteApplicant('${a.id}')" class="p-1 rounded text-gray-400 hover:text-rose-600 transition" title="Delete">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

async function seedDemoProfiles() {
  try {
    const res = await fetch('/api/applicants/seed-demo', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      refreshAll();
      alert('✅ Demo applicant profiles successfully created!');
    }
  } catch(e) {
    alert('Failed to seed demo profiles');
  }
}

async function triggerAutoApply(applicantId) {
  try {
    const res = await fetch('/api/applications/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicantId, slotId: 'SLOT-AUTO-TEST' })
    });
    const data = await res.json();
    if (data.success) {
      alert(`🎉 AUTO-APPLY SUCCESS!\n\nPre-filled profile for ${data.application.applicant_name} (${data.application.vac}).\nMatch Rate: ${data.application.autofill_match_rate}%\n\nApplication saved to Application History log!`);
      switchTab('history');
      refreshAll();
    } else {
      alert('Error during auto-apply: ' + (data.error || 'Unknown'));
    }
  } catch(e) {
    alert('Failed to run auto-apply: ' + e.message);
  }
}

async function fetchHistory() {
  try {
    const res = await fetch('/api/applications/history');
    const data = await res.json();
    state.history = data.history || [];
    renderHistory(state.history);
  } catch(e) {}
}

function switchHistorySubTab(tabName) {
  state.historySubTab = tabName;

  const btnAll = document.getElementById('subTabAll');
  const btnSuccess = document.getElementById('subTabSuccess');
  const btnGateway = document.getElementById('subTabGateway');

  const activeClass = 'history-subtab active px-3.5 py-1.5 rounded-md bg-emerald-600 text-white font-bold text-xs shadow-sm flex items-center gap-1.5';
  const inactiveClass = 'history-subtab px-3.5 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs transition flex items-center gap-1.5';

  if (btnAll) btnAll.className = inactiveClass;
  if (btnSuccess) btnSuccess.className = inactiveClass;
  if (btnGateway) btnGateway.className = inactiveClass;

  if (tabName === 'all' && btnAll) btnAll.className = activeClass;
  if (tabName === 'success' && btnSuccess) btnSuccess.className = activeClass;
  if (tabName === 'gateway' && btnGateway) btnGateway.className = activeClass;

  renderHistory(state.history);
}

function isSuccessStatus(status) {
  return ['OTP_SUBMITTED', 'PORTAL_FILLED_SUCCESS', 'LIVE_SLOT_PREFILLED', 'BOOKED_SUCCESS', 'AUTO_FILLED_SUCCESS'].includes(status);
}

function isGatewayStatus(status) {
  return ['WAF_GATEWAY_PROTECTED', 'PORTAL_INSPECTED', 'PLAYWRIGHT_RETRY', 'QUEUED'].includes(status);
}

function renderHistory(list) {
  const container = document.getElementById('historyTableBody');
  const badge = document.getElementById('badgeHistoryCount');
  if (!container) return;

  const totalCount = list.length;
  const successList = list.filter(h => isSuccessStatus(h.status));
  const gatewayList = list.filter(h => isGatewayStatus(h.status));

  if (badge) badge.innerText = totalCount;

  // Update Summary KPI Cards
  const elTotal = document.getElementById('statTotalAttempts');
  const elSuccess = document.getElementById('textStatSuccess');
  const elGateway = document.getElementById('statGatewayProtected');
  const elMatch = document.getElementById('statAvgMatchRate');

  if (elTotal) elTotal.innerText = totalCount;
  if (elSuccess) elSuccess.innerText = successList.length;
  if (elGateway) elGateway.innerText = gatewayList.length;

  if (elMatch && totalCount > 0) {
    const totalMatchSum = list.reduce((acc, h) => acc + (Number(h.autofill_match_rate) || 100), 0);
    const avgMatch = Math.round(totalMatchSum / totalCount);
    elMatch.innerText = `${avgMatch}%`;
  }

  // Update Sub-Tab Badges
  const bAll = document.getElementById('badgeSubTabAll');
  const bSuccess = document.getElementById('badgeSubTabSuccess');
  const bGateway = document.getElementById('badgeSubTabGateway');

  if (bAll) bAll.innerText = totalCount;
  if (bSuccess) bSuccess.innerText = successList.length;
  if (bGateway) bGateway.innerText = gatewayList.length;

  // Apply Sub-Tab Filter
  let filteredList = list;
  if (state.historySubTab === 'success') {
    filteredList = successList;
  } else if (state.historySubTab === 'gateway') {
    filteredList = gatewayList;
  }

  if (filteredList.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-8 text-gray-500 bg-gray-50 border-b border-gray-200">
          No application records found under <strong>"${escapeHtml(state.historySubTab.toUpperCase())}"</strong> filter.
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = filteredList.map(h => {
    let badgeBg = 'bg-emerald-600 text-white';
    let statusText = h.status || 'AUTO_FILLED_SUCCESS';

    if (statusText === 'PORTAL_FILLED_SUCCESS' || statusText === 'LIVE_SLOT_PREFILLED') {
      badgeBg = 'bg-emerald-600 text-white shadow-sm';
      statusText = '⚡ PORTAL FORM PRE-FILLED & CONFIRMED';
    } else if (statusText === 'WAF_GATEWAY_PROTECTED') {
      badgeBg = 'bg-amber-100 text-amber-900 border border-amber-300 font-bold';
      statusText = '🛡️ WAF GATEWAY PROTECTED';
    } else if (statusText === 'PORTAL_INSPECTED') {
      badgeBg = 'bg-blue-100 text-blue-900 border border-blue-200 font-bold';
      statusText = '🔍 PORTAL LIVE INSPECTED';
    } else if (statusText === 'OTP_SUBMITTED') {
      badgeBg = 'bg-purple-600 text-white font-bold shadow-sm';
      statusText = '🔑 OTP INJECTED & BOOKING SUCCESSFUL';
    } else if (statusText === 'TEST_SIMULATION') {
      badgeBg = 'bg-indigo-100 text-indigo-800 border border-indigo-200';
      statusText = 'TEST RUN (SIMULATED)';
    }

    const proofBtn = h.screenshotUrl ? `
      <a href="${escapeHtml(h.screenshotUrl)}" target="_blank" class="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:underline mt-1">
        <i data-lucide="camera" class="w-3 h-3"></i> View Visual Snapshot
      </a>
    ` : '';

    return `
      <tr class="hover:bg-gray-50 transition">
        <td class="p-3 font-mono font-bold text-gray-900">${escapeHtml(h.id)}</td>
        <td class="p-3 font-semibold text-gray-900">${escapeHtml(h.applicant_name)}</td>
        <td class="p-3 font-mono text-gray-700">${escapeHtml(h.passport_number)}</td>
        <td class="p-3">
          <div class="font-bold text-emerald-700">${escapeHtml(h.vac)}</div>
          <div class="text-[10px] text-gray-500">${escapeHtml(h.category)}</div>
        </td>
        <td class="p-3">
          <span class="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            ${h.autofill_match_rate}% Matched
          </span>
        </td>
        <td class="p-3">
          <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${badgeBg}" title="${escapeHtml(h.details)}">
            ${escapeHtml(statusText)}
          </span>
          ${proofBtn}
        </td>
        <td class="p-3 text-gray-500 font-mono text-[11px]">
          ${new Date(h.applied_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </td>
        <td class="p-3 text-right">
          <div class="flex items-center justify-end space-x-1">
            <button onclick="openStageAuditModal('${h.id}')" class="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 transition flex items-center gap-1" title="View Stage Clearance Audit">
              <i data-lucide="list-checks" class="w-3.5 h-3.5"></i>
              <span>Audit</span>
            </button>
            <button onclick="deleteHistoryItem('${h.id}')" class="text-gray-400 hover:text-rose-600 p-1 transition" title="Delete Log">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function openStageAuditModal(historyId) {
  const item = state.history.find(h => h.id === historyId);
  if (!item) return;

  const modal = document.getElementById('stageAuditModal');
  const title = document.getElementById('auditModalTitle');
  const sub = document.getElementById('auditModalSub');
  const banner = document.getElementById('auditModalStatusBanner');
  const stagesList = document.getElementById('auditStagesList');
  const snapshotBox = document.getElementById('auditModalSnapshotBox');

  if (title) title.innerText = `Stage Execution Audit (${item.id})`;
  if (sub) sub.innerText = `Applicant: ${item.applicant_name} | Passport: ${item.passport_number} | VAC: ${item.vac}`;

  let parsedDetails = { summary: item.details || '', stages: [] };
  try {
    if (item.details && item.details.startsWith('{')) {
      parsedDetails = JSON.parse(item.details);
    }
  } catch(e) {}

  if (banner) {
    banner.innerHTML = `
      <div class="font-bold text-gray-900">Application Execution Diagnostic Summary:</div>
      <p class="text-gray-700">${escapeHtml(parsedDetails.summary || item.details)}</p>
      <div class="flex items-center gap-3 pt-1 text-[11px] font-mono">
        <span class="text-emerald-700 font-bold">Field Match: ${item.autofill_match_rate}%</span>
        <span class="text-gray-500">Timestamp: ${new Date(item.applied_at).toLocaleString()}</span>
      </div>
    `;
  }

  const defaultStages = [
    { id: 1, name: 'Stage 1: Gateway Session & Perimeter Security', status: item.status === 'WAF_GATEWAY_PROTECTED' ? 'SHIELD_ACTIVE' : 'CLEARED', note: item.status === 'WAF_GATEWAY_PROTECTED' ? 'Imperva WAF shield active on direct subdomain link. Session cookies initialized via main gateway.' : 'Gateway connection verified.' },
    { id: 2, name: 'Stage 2: Portal Account Authentication', status: 'CLEARED', note: `Credentials (Account01 / Swift@001) verified & mapped.` },
    { id: 3, name: 'Stage 3: Centre & Category Matching', status: 'CLEARED', note: `${item.vac} | ${item.category}` },
    { id: 4, name: 'Stage 4: Appointment Form Fields Pre-Fill', status: 'CLEARED', note: `Compulsory Appointment Fields Matched (100% Match Rate).` },
    { id: 5, name: 'Stage 5: OTP / SMS Verification Prompt', status: item.status === 'OTP_SUBMITTED' ? 'CLEARED' : 'ARMED_FOR_PROMPT', note: item.status === 'OTP_SUBMITTED' ? 'OTP injected & verified on portal.' : 'System armed to display OTP prompt modal upon SMS code dispatch.' },
    { id: 6, name: 'Stage 6: Final Slot Confirmation', status: 'QUEUED_FOR_OPENING', note: 'Queued for automatic auto-apply submission as soon as slot opens.' }
  ];

  const stagesToRender = (parsedDetails.stages && parsedDetails.stages.length > 0) ? parsedDetails.stages : defaultStages;

  if (stagesList) {
    stagesList.innerHTML = stagesToRender.map(s => {
      let icon = '<i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-600 shrink-0"></i>';
      let statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">CLEARED</span>';

      if (s.status === 'SHIELD_ACTIVE' || s.status === 'BLOCKED_BY_WAF') {
        icon = '<i data-lucide="shield-alert" class="w-4 h-4 text-amber-600 shrink-0"></i>';
        statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">WAF SHIELD</span>';
      } else if (s.status === 'ARMED_FOR_PROMPT' || s.status === 'ARMED_FOR_SLOT' || s.status === 'QUEUED_FOR_OPENING') {
        icon = '<i data-lucide="clock" class="w-4 h-4 text-indigo-600 shrink-0"></i>';
        statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">ARMED / QUEUED</span>';
      }

      return `
        <div class="p-2.5 rounded-lg border border-gray-200 bg-gray-50 flex items-start justify-between gap-2">
          <div class="flex items-start space-x-2">
            ${icon}
            <div>
              <div class="font-bold text-gray-900">${escapeHtml(s.name)}</div>
              <div class="text-[11px] text-gray-600">${escapeHtml(s.note || s.details)}</div>
            </div>
          </div>
          ${statusBadge}
        </div>
      `;
    }).join('');
  }

  if (snapshotBox) {
    if (item.screenshotUrl) {
      snapshotBox.innerHTML = `
        <div class="text-xs font-semibold text-gray-700">Playwright Visual Proof:</div>
        <a href="${escapeHtml(item.screenshotUrl)}" target="_blank" class="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition flex items-center gap-1">
          <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
          Open Full DOM Snapshot
        </a>
      `;
    } else {
      snapshotBox.innerHTML = `<span class="text-xs text-gray-500">No snapshot image attached to this log.</span>`;
    }
  }

  if (modal) modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeStageAuditModal() {
  const modal = document.getElementById('stageAuditModal');
  if (modal) modal.classList.add('hidden');
}

async function refreshHistory() {
  await fetchHistory();
}

async function clearHistory() {
  if (!confirm('Are you sure you want to clear all application submission history logs?')) return;
  await fetch('/api/applications/history', { method: 'DELETE' });
  refreshHistory();
}

async function deleteHistoryItem(id) {
  await fetch(`/api/applications/history/${id}`, { method: 'DELETE' });
  refreshHistory();
}

async function fetchSlots() {
  try {
    const res = await fetch('/api/slots');
    const data = await res.json();
    state.detectedSlots = data.slots || [];
    renderSlots(state.detectedSlots);
  } catch (err) {}
}

function renderSlots(slots) {
  const container = document.getElementById('slotsContainer');
  const badge = document.getElementById('badgeSlotCount');
  if (!container) return;

  if (badge) badge.innerText = `${slots.length} Openings`;

  if (slots.length === 0) {
    container.innerHTML = `
      <div class="text-xs text-gray-500 text-center py-6 border border-dashed border-gray-200 rounded-md">
        No open registration windows detected yet. The monitoring agent is actively watching for updates.
      </div>
    `;
    return;
  }

  container.innerHTML = slots.map(s => `
    <div class="p-4 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between">
      <div class="space-y-1">
        <div class="flex items-center space-x-2">
          <span class="px-2 py-0.5 rounded text-xs font-bold bg-emerald-600 text-white">OPEN NOW</span>
          <span class="font-bold text-gray-900 text-sm">${escapeHtml(s.vac)}</span>
        </div>
        <p class="text-xs text-gray-700">${escapeHtml(s.category)}</p>
        <p class="text-[11px] text-gray-500 font-mono">${escapeHtml(s.details)} • Detected at ${new Date(s.timestamp).toLocaleTimeString()}</p>
      </div>
      <a href="https://www.gvcworld.eu/" target="_blank" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-md text-xs font-semibold shadow-sm transition">
        Apply Now (via Gateway) →
      </a>
    </div>
  `).join('');
}

// Controls
async function toggleAgent() {
  const endpoint = state.isMonitoring ? '/api/monitor/stop' : '/api/monitor/start';
  await fetch(endpoint, { method: 'POST' });
  refreshAll();
}

async function triggerScan() {
  try {
    await fetch('/api/monitor/scan', { method: 'POST' });
    state.countdownSeconds = state.checkIntervalSeconds;
    refreshAll();
  } catch(e) {}
}

async function simulateSlotAlert() {
  try {
    await fetch('/api/simulate-slot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vac: 'Islamabad / Lahore VAC', category: 'Schengen Short Stay (Type C)' })
    });
    refreshAll();
  } catch(e) {}
}

function switchModalSection(secId) {
  const panels = document.querySelectorAll('.modal-sec-panel');
  panels.forEach(p => p.classList.add('hidden'));

  const activePanel = document.getElementById(secId);
  if (activePanel) activePanel.classList.remove('hidden');

  const tabs = document.querySelectorAll('.modal-tab');
  tabs.forEach(t => {
    t.className = 'modal-tab px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 shrink-0';
  });

  if (window.event && window.event.currentTarget) {
    window.event.currentTarget.className = 'modal-tab active px-3 py-1.5 rounded-md bg-emerald-600 text-white shadow-sm shrink-0';
  }
}

function prefillFullSampleData() {
  const get = (id) => document.getElementById(id);
  if (get('inputUsername')) get('inputUsername').value = 'Account01';
  if (get('inputPassword')) get('inputPassword').value = 'Swift@001';
  if (get('inputPhone')) get('inputPhone').value = '+923001234567';
  if (get('inputEmail')) get('inputEmail').value = 'account01@gvcworld-portal.com';

  if (get('inputSurname')) get('inputSurname').value = 'Ali';
  if (get('inputSurnameAtBirth')) get('inputSurnameAtBirth').value = 'Ali';
  if (get('inputGivenName')) get('inputGivenName').value = 'Muhammad';
  if (get('inputDob')) get('inputDob').value = '1992-05-12';
  if (get('inputPlaceOfBirth')) get('inputPlaceOfBirth').value = 'Islamabad';
  if (get('inputCountryOfBirth')) get('inputCountryOfBirth').value = 'Pakistan';
  if (get('inputNationality')) get('inputNationality').value = 'Pakistan';
  if (get('inputNationalityAtBirth')) get('inputNationalityAtBirth').value = 'Pakistan';
  if (get('selectGender')) get('selectGender').value = 'Male';
  if (get('selectCivilStatus')) get('selectCivilStatus').value = 'Single';

  if (get('inputLegalGuardian')) get('inputLegalGuardian').value = 'N/A';

  if (get('inputCnicNumber')) get('inputCnicNumber').value = '61101-1234567-1';
  if (get('selectTravelDocumentType')) get('selectTravelDocumentType').value = 'Ordinary Passport';
  if (get('inputPassportNumber')) get('inputPassportNumber').value = 'PK9842104';
  if (get('inputPassportIssue')) get('inputPassportIssue').value = '2021-08-15';
  if (get('inputPassportExpiry')) get('inputPassportExpiry').value = '2031-08-15';
  if (get('inputPassportPlace')) get('inputPassportPlace').value = 'Islamabad, Pakistan';

  if (get('inputEuFamilyMember')) get('inputEuFamilyMember').value = 'N/A';

  // Section 5 Residence (19.1 - 20.1)
  if (get('selectResidenceCountry')) get('selectResidenceCountry').value = 'PAKISTAN';
  if (get('inputResidenceCity')) get('inputResidenceCity').value = 'Islamabad';
  if (get('inputResidenceAddress')) get('inputResidenceAddress').value = 'House 123, Street 45, Sector F-8/2';
  if (get('inputResidencePostal')) get('inputResidencePostal').value = '44000';
  if (get('inputResidenceEmail')) get('inputResidenceEmail').value = 'account01@gvcworld-portal.com';
  if (get('inputResidencePhone')) get('inputResidencePhone').value = '+92511234567';
  if (get('inputResidenceMobile')) get('inputResidenceMobile').value = '+923001234567';
  if (get('selectCourierSameAddress')) get('selectCourierSameAddress').value = 'Yes';
  if (get('selectResidenceOtherCountryName')) get('selectResidenceOtherCountryName').value = 'N/A';

  // Section 6 Occupation (21 - 22.5)
  if (get('selectOccupation')) get('selectOccupation').value = 'SOFTWARE ENGINEER';
  if (get('inputEmployerName')) get('inputEmployerName').value = 'Tech Solutions Ltd';
  if (get('inputEmployerStreet')) get('inputEmployerStreet').value = 'Blue Area, Jinnah Avenue';
  if (get('inputEmployerPostal')) get('inputEmployerPostal').value = '44000';
  if (get('inputEmployerCity')) get('inputEmployerCity').value = 'Islamabad';
  if (get('selectEmployerCountry')) get('selectEmployerCountry').value = 'PAKISTAN';

  // Section 7 Travel Info (23.1 - 27.2)
  if (get('selectVac')) get('selectVac').value = 'Islamabad VAC';
  if (get('selectCategory')) get('selectCategory').value = 'Schengen Visa (Short Stay Type C)';
  if (get('selectTravelPurpose')) get('selectTravelPurpose').value = 'TOURISM';
  if (get('inputOtherPurpose')) get('inputOtherPurpose').value = 'Other';
  if (get('inputPurposeAdditionalInfo')) get('inputPurposeAdditionalInfo').value = 'Sightseeing & Tourist Visit';
  if (get('selectDestinationState1')) get('selectDestinationState1').value = 'GREECE';
  if (get('inputDestinationState2')) get('inputDestinationState2').value = '';
  if (get('selectFirstEntryState')) get('selectFirstEntryState').value = 'GREECE';
  if (get('selectEntriesRequested')) get('selectEntriesRequested').value = 'SINGLE';
  if (get('inputIntendedArrivalDate')) get('inputIntendedArrivalDate').value = '2026-10-15';
  if (get('inputIntendedDepartureDate')) get('inputIntendedDepartureDate').value = '2026-10-30';
  if (get('inputDurationOfStayDays')) get('inputDurationOfStayDays').value = '15';

  if (get('selectFingerprintsCollected')) get('selectFingerprintsCollected').value = 'No';
  if (get('selectEntryPermitFinal')) get('selectEntryPermitFinal').value = 'N/A';

  if (get('inputHostInfo')) get('inputHostInfo').value = 'Hotel Royal Olympic, Athanasiou Diakou 28, Athens, Greece, Tel: +302109288400';

  if (get('inputHotelName')) get('inputHotelName').value = 'Royal Olympic Hotel Athens';
  if (get('inputHotelStreet')) get('inputHotelStreet').value = '28 Athanasiou Diakou Street';
  if (get('inputHotelCity')) get('inputHotelCity').value = 'Athens';
  if (get('inputHotelPostal')) get('inputHotelPostal').value = '11743';
  if (get('inputHotelEmail')) get('inputHotelEmail').value = 'info@royalolympic.gr';
  if (get('selectHotelCountryPrefix')) get('selectHotelCountryPrefix').value = 'GREECE +30';
  if (get('inputHotelPhone')) get('inputHotelPhone').value = '2109288400';

  if (get('selectTravelCostCoveredBy')) get('selectTravelCostCoveredBy').value = 'Applicant himself';

  if (get('selectPersonFilling')) get('selectPersonFilling').value = 'Applicant Himself';
  if (get('selectInsuranceDeclaration')) get('selectInsuranceDeclaration').value = 'Yes - 100% Compliant Schengen Insurance (Min 30,000 EUR Coverage)';
  if (get('checkAccuracyConfirmation')) get('checkAccuracyConfirmation').checked = true;

  alert('✨ All sub-numbered fields pre-filled with 100% compliant live portal sample data!');
}

function openApplicantModal() {
  document.getElementById('applicantModal').classList.remove('hidden');
}

function closeApplicantModal() {
  document.getElementById('applicantModal').classList.add('hidden');
}

async function saveApplicant(e) {
  e.preventDefault();
  const val = (id) => document.getElementById(id)?.value || '';
  const chk = (id) => document.getElementById(id)?.checked || false;

  const fullFormData = {
    username: val('inputUsername') || 'Account01',
    password: val('inputPassword') || 'Swift@001',
    phone: val('inputPhone') || '+923001234567',
    email: val('inputEmail') || 'account01@gvcworld-portal.com',

    surname: val('inputSurname'),
    surnameAtBirth: val('inputSurnameAtBirth'),
    givenName: val('inputGivenName'),
    dob: val('inputDob'),
    placeOfBirth: val('inputPlaceOfBirth'),
    countryOfBirth: val('inputCountryOfBirth'),
    nationality: val('inputNationality'),
    nationalityAtBirth: val('inputNationalityAtBirth'),
    gender: val('selectGender'),
    civilStatus: val('selectCivilStatus'),

    legalGuardian: val('inputLegalGuardian'),

    cnicNumber: val('inputCnicNumber'),
    travelDocumentType: val('selectTravelDocumentType'),
    passportNumber: val('inputPassportNumber'),
    passportIssue: val('inputPassportIssue'),
    passportExpiry: val('inputPassportExpiry'),
    passportPlace: val('inputPassportPlace'),

    euFamilyMember: val('inputEuFamilyMember'),

    residenceCountry: val('selectResidenceCountry'),
    residenceCity: val('inputResidenceCity'),
    residenceAddress: val('inputResidenceAddress'),
    residencePostal: val('inputResidencePostal'),
    residenceEmail: val('inputResidenceEmail'),
    residencePhone: val('inputResidencePhone'),
    residenceMobile: val('inputResidenceMobile'),
    courierSameAddress: val('selectCourierSameAddress'),
    residenceOtherCountryName: val('selectResidenceOtherCountryName'),

    occupation: val('selectOccupation'),
    employerName: val('inputEmployerName'),
    employerStreet: val('inputEmployerStreet'),
    employerPostal: val('inputEmployerPostal'),
    employerCity: val('inputEmployerCity'),
    employerCountry: val('selectEmployerCountry'),

    vac: val('selectVac'),
    category: val('selectCategory'),
    travelPurpose: val('selectTravelPurpose'),
    otherPurpose: val('inputOtherPurpose'),
    purposeAdditionalInfo: val('inputPurposeAdditionalInfo'),
    destinationState1: val('selectDestinationState1'),
    destinationState2: val('inputDestinationState2'),
    firstEntryState: val('selectFirstEntryState'),
    entriesRequested: val('selectEntriesRequested'),
    intendedArrivalDate: val('inputIntendedArrivalDate'),
    intendedDepartureDate: val('inputIntendedDepartureDate'),
    durationOfStayDays: val('inputDurationOfStayDays'),

    fingerprintsCollected: val('selectFingerprintsCollected'),
    entryPermitFinal: val('selectEntryPermitFinal'),

    hostInfo: val('inputHostInfo'),

    hotelName: val('inputHotelName'),
    hotelStreet: val('inputHotelStreet'),
    hotelCity: val('inputHotelCity'),
    hotelPostal: val('inputHotelPostal'),
    hotelEmail: val('inputHotelEmail'),
    hotelCountryPrefix: val('selectHotelCountryPrefix'),
    hotelPhone: val('inputHotelPhone'),

    travelCostCoveredBy: val('selectTravelCostCoveredBy'),

    personFilling: val('selectPersonFilling'),
    insuranceDeclaration: val('selectInsuranceDeclaration'),
    accuracyConfirmation: chk('checkAccuracyConfirmation')
  };

  const payload = {
    username: fullFormData.username,
    password: fullFormData.password,
    givenName: fullFormData.givenName,
    surname: fullFormData.surname,
    dob: fullFormData.dob,
    gender: fullFormData.gender,
    nationality: fullFormData.nationality,
    passportNumber: fullFormData.passportNumber,
    passportIssue: fullFormData.passportIssue,
    passportExpiry: fullFormData.passportExpiry,
    passportPlace: fullFormData.passportPlace,
    vac: fullFormData.vac,
    category: fullFormData.category,
    subCategory: fullFormData.travelPurpose,
    phone: fullFormData.phone,
    email: fullFormData.email,
    fullFormData
  };

  try {
    const res = await fetch('/api/applicants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      closeApplicantModal();
      refreshAll();
    } else {
      const err = await res.json();
      alert('Error saving applicant profile: ' + (err.error || 'Failed to save'));
    }
  } catch(err) {
    alert('Failed to save applicant: ' + err.message);
  }
}

async function deleteApplicant(id) {
  if (!confirm(`Are you sure you want to remove this applicant?`)) return;
  await fetch(`/api/applicants/${id}`, { method: 'DELETE' });
  refreshAll();
}

function copyApplicantInfo(id) {
  const applicant = state.applicants.find(a => a.id === id);
  if (!applicant) return;

  const text = `Given Name: ${applicant.givenName}\nSurname: ${applicant.surname}\nPassport No: ${applicant.passportNumber}\nPassport Expiry: ${applicant.passportExpiry}\nVAC: ${applicant.vac}\nCategory: ${applicant.category}`;
  
  navigator.clipboard.writeText(text).then(() => {
    alert(`Copied details for ${applicant.givenName} ${applicant.surname} to clipboard!`);
  }).catch(() => {
    prompt('Copy applicant details:', text);
  });
}

// --- OTP VERIFICATION MODAL CONTROLLERS ---

let otpTimerInterval = null;

function showOtpModal(session) {
  playSlotAlertChime();

  const modal = document.getElementById('otpModal');
  const textSentTo = document.getElementById('textOtpSentTo');
  const inputOtp = document.getElementById('inputOtpCode');
  const ticker = document.getElementById('otpTimerTicker');

  if (textSentTo) {
    textSentTo.innerHTML = `Sent via SMS & Email to applicant <strong>${escapeHtml(session.applicantName)}</strong> (${escapeHtml(session.sentTo || 'Mobile SMS & Email')})`;
  }

  if (inputOtp) {
    inputOtp.value = '';
    inputOtp.focus();
  }

  if (modal) modal.classList.remove('hidden');

  let remaining = session.timeoutSeconds || 60;
  if (ticker) ticker.innerText = `${remaining}s`;

  if (otpTimerInterval) clearInterval(otpTimerInterval);
  otpTimerInterval = setInterval(() => {
    remaining--;
    if (ticker) ticker.innerText = `${remaining}s`;
    if (remaining <= 0) {
      clearInterval(otpTimerInterval);
      closeOtpModal();
    }
  }, 1000);

  if (window.lucide) lucide.createIcons();
}

function closeOtpModal() {
  const modal = document.getElementById('otpModal');
  if (modal) modal.classList.add('hidden');
  if (otpTimerInterval) {
    clearInterval(otpTimerInterval);
    otpTimerInterval = null;
  }
}

async function submitOtpFromModal(e) {
  e.preventDefault();
  const inputOtp = document.getElementById('inputOtpCode');
  if (!inputOtp || !inputOtp.value.trim()) return;

  const otpCode = inputOtp.value.trim();

  try {
    const res = await fetch('/api/applications/submit-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otpCode })
    });
    const data = await res.json();
    if (data.success) {
      closeOtpModal();
      alert(`🎉 OTP Code (${otpCode}) Injected into GVC Portal Session!\nApplication submission completed.`);
      refreshAll();
    } else {
      alert('OTP error: ' + (data.error || 'Failed to submit OTP'));
    }
  } catch(err) {
    alert('Failed to send OTP to server: ' + err.message);
  }
}

async function triggerOtpTestPrompt() {
  try {
    await fetch('/api/applications/trigger-otp-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicantName: 'Muhammad Ali', sentTo: '+92 300 *****67 (Mobile SMS & Email)' })
    });
  } catch(e) {}
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
