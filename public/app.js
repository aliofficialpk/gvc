// Simplified Non-Technical Client Controller

let state = {
  isMonitoring: false,
  checkIntervalSeconds: 120,
  scanCount: 0,
  lastCheck: null,
  detectedSlots: [],
  applicants: [],
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
    fetchSlots()
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

  const scanCountEl = document.getElementById('statScanCount');
  if (scanCountEl) scanCountEl.innerText = `${data.scanCount || state.scanCount} checks completed`;

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
  if (!container) return;

  if (list.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-xs text-gray-500 text-center py-6 border border-dashed border-gray-200 rounded-lg bg-gray-50">
        No applicants added yet. Click <strong>"Add Applicant"</strong> to save a profile.
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(a => `
    <div class="p-3.5 rounded-lg bg-white border border-gray-200 shadow-sm flex items-center justify-between hover:border-gray-300 transition">
      <div class="space-y-1">
        <div class="font-bold text-gray-900 text-sm flex items-center gap-1.5">
          <i data-lucide="user" class="w-3.5 h-3.5 text-emerald-600"></i>
          ${escapeHtml(a.givenName)} ${escapeHtml(a.surname)}
        </div>
        <div class="text-xs text-gray-600 font-mono">
          Pass: <strong class="text-gray-900">${escapeHtml(a.passportNumber)}</strong> • VAC: <strong class="text-emerald-700">${escapeHtml(a.vac)}</strong>
        </div>
        <div class="text-[11px] text-gray-500">Category: ${escapeHtml(a.category)}</div>
      </div>
      <div class="flex items-center space-x-1.5">
        <button onclick="copyApplicantInfo('${a.id}')" class="px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium transition border border-gray-300 flex items-center gap-1" title="Copy Applicant Details">
          <i data-lucide="copy" class="w-3 h-3 text-gray-500"></i>
          <span>Copy</span>
        </button>
        <button onclick="deleteApplicant('${a.id}')" class="p-1 rounded text-gray-400 hover:text-rose-600 transition" title="Delete">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
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
    givenName: document.getElementById('inputGivenName').value,
    surname: document.getElementById('inputSurname').value,
    passportNumber: document.getElementById('inputPassportNumber').value,
    passportExpiry: document.getElementById('inputPassportExpiry').value,
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

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
