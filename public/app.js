// Dynamic Visa Appointment Assistant & Auto-Apply Client Controller

let state = {
  activeTab: 'monitor',
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
    <div class="p-3 rounded-md bg-gray-50 border border-gray-200 space-y-1 hover:border-emerald-300 transition">
      <div class="flex items-center justify-between">
        <span class="font-bold text-gray-900 text-xs">${escapeHtml(f.label)}</span>
        ${f.required ? '<span class="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">REQUIRED</span>' : '<span class="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">OPTIONAL</span>'}
      </div>
      <div class="text-[11px] font-mono text-emerald-700 font-semibold truncate">
        Key: ${escapeHtml(f.fieldKey)}
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

function renderHistory(list) {
  const container = document.getElementById('historyTableBody');
  const badge = document.getElementById('badgeHistoryCount');
  if (!container) return;

  if (badge) badge.innerText = list.length;

  if (list.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-8 text-gray-500 bg-gray-50 border-b border-gray-200">
          No applications recorded yet. Go to <strong>"Applicants & Auto-Apply Profiles"</strong> tab and click <strong>"Auto-Apply Test Run"</strong>!
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = list.map(h => `
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
        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white uppercase tracking-wider">
          ${escapeHtml(h.status)}
        </span>
      </td>
      <td class="p-3 text-gray-500 font-mono text-[11px]">
        ${new Date(h.applied_at).toLocaleString()}
      </td>
      <td class="p-3 text-right">
        <button onclick="deleteHistoryItem('${h.id}')" class="text-gray-400 hover:text-rose-600 p-1 transition" title="Delete Log">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </td>
    </tr>
  `).join('');

  if (window.lucide) lucide.createIcons();
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

function openApplicantModal() {
  document.getElementById('applicantModal').classList.remove('hidden');
}

function closeApplicantModal() {
  document.getElementById('applicantModal').classList.add('hidden');
}

async function saveApplicant(e) {
  e.preventDefault();
  const payload = {
    username: document.getElementById('inputUsername')?.value || 'Account01',
    password: document.getElementById('inputPassword')?.value || 'Swift@001',
    givenName: document.getElementById('inputGivenName').value,
    surname: document.getElementById('inputSurname').value,
    dob: document.getElementById('inputDob')?.value || '1992-05-12',
    gender: document.getElementById('selectGender')?.value || 'Male',
    nationality: document.getElementById('inputNationality')?.value || 'Pakistan',
    passportNumber: document.getElementById('inputPassportNumber').value,
    passportIssue: document.getElementById('inputPassportIssue')?.value || '2020-01-01',
    passportExpiry: document.getElementById('inputPassportExpiry').value,
    passportPlace: document.getElementById('inputPassportPlace')?.value || 'Islamabad',
    vac: document.getElementById('selectVac').value,
    category: document.getElementById('selectCategory').value,
    phone: document.getElementById('inputPhone').value,
    email: document.getElementById('inputEmail').value
  };

  try {
    const res = await fetch('/api/applicants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      closeApplicantModal();
      document.getElementById('formApplicant').reset();
      refreshAll();
    }
  } catch(err) {}
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
