const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class MonitorAgent extends EventEmitter {
  constructor() {
    super();
    this.isMonitoring = false;
    this.timer = null;
    this.checkIntervalMs = 120000; // 2 minutes default
    this.lastCheck = null;
    this.lastScrapedSnapshot = null;
    this.scanCount = 0;
    this.logs = [];
    this.detectedSlots = [];
    this.pool = null;

    this.targetUrl = 'https://pk-gr-services.gvcworld.eu/login/PK/en?lang=en_US';
    this.registerUrl = 'https://pk-gr-services.gvcworld.eu/register/PK/en?lang=en_US';

    this.canonicalFormFields = [
      { fieldKey: 'given_name', label: 'Given Name (as in Passport)', type: 'text', required: true, gvcSelector: 'input[name="first_name"], #first_name', matchProp: 'givenName' },
      { fieldKey: 'surname', label: 'Surname / Family Name', type: 'text', required: true, gvcSelector: 'input[name="last_name"], #last_name', matchProp: 'surname' },
      { fieldKey: 'passport_number', label: 'Passport Number', type: 'text', required: true, gvcSelector: 'input[name="passport_no"], #passport_no', matchProp: 'passportNumber' },
      { fieldKey: 'passport_expiry', label: 'Passport Expiry Date', type: 'date', required: true, gvcSelector: 'input[name="passport_expiry"], #passport_expiry', matchProp: 'passportExpiry' },
      { fieldKey: 'dob', label: 'Date of Birth', type: 'date', required: true, gvcSelector: 'input[name="dob"], #dob', matchProp: 'dob' },
      { fieldKey: 'vac', label: 'Visa Application Centre (VAC)', type: 'select', required: true, options: ['Islamabad VAC', 'Lahore VAC'], gvcSelector: 'select[name="vac_id"], #vac_id', matchProp: 'vac' },
      { fieldKey: 'category', label: 'Visa Category', type: 'select', required: true, options: ['Schengen Short Stay (Type C)', 'National Long Stay (Type D)'], gvcSelector: 'select[name="category_id"], #category_id', matchProp: 'category' },
      { fieldKey: 'phone', label: 'Mobile Phone Number', type: 'tel', required: false, gvcSelector: 'input[name="phone"], #phone', matchProp: 'phone' },
      { fieldKey: 'email', label: 'Email Address', type: 'email', required: true, gvcSelector: 'input[name="email"], #email', matchProp: 'email' }
    ];

    this.lastScrapedFormFields = null;

    this.addLog('SYSTEM', 'PostgreSQL Stealth Agent Engine initialized.');
  }

  getFormSchema() {
    return {
      isScraped: !!this.lastScrapedFormFields,
      lastScrapedAt: this.lastScrapedSnapshot?.timestamp || new Date().toISOString(),
      fieldsCount: this.canonicalFormFields.length,
      requiredCount: this.canonicalFormFields.filter(f => f.required).length,
      fields: this.canonicalFormFields,
      targetPortal: 'GVC World Greece Pakistan Registration (/register/PK/en)'
    };
  }

  setDbPool(pool) {
    this.pool = pool;
  }

  addLog(type, message, details = null) {
    const logEntry = {
      id: Date.now() + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
      timeFormatted: new Date().toLocaleTimeString('en-US', { hour12: false }),
      type,
      message,
      details
    };
    this.logs.unshift(logEntry);
    if (this.logs.length > 300) this.logs.pop();
    this.emit('log', logEntry);
    return logEntry;
  }

  start() {
    if (this.isMonitoring) return;
    this.isMonitoring = true;
    this.addLog('SYSTEM', `Continuous monitoring started (${this.checkIntervalMs / 1000}s interval).`);
    
    this.runScan();

    this.timer = setInterval(() => {
      this.runScan();
    }, this.checkIntervalMs);
  }

  stop() {
    if (!this.isMonitoring) return;
    this.isMonitoring = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.addLog('SYSTEM', 'Monitoring paused.');
  }

  setFrequency(seconds) {
    const ms = Math.max(10, seconds) * 1000;
    this.checkIntervalMs = ms;
    if (this.isMonitoring) {
      this.stop();
      this.start();
    }
    this.addLog('SYSTEM', `Check frequency updated to ${seconds}s.`);
  }

  async runScan() {
    this.scanCount++;
    const scanId = `#${this.scanCount}`;
    const startTime = Date.now();
    this.addLog('SCAN', `Executing live check ${scanId}...`);

    let browser = null;
    try {
      browser = await chromium.launch({
        headless: true,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--disable-setuid-sandbox'
        ]
      });

      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 },
        locale: 'en-US'
      });

      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
      });

      const page = await context.newPage();

      // Probe main login entry
      const response = await page.goto(this.targetUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
      const durationMs = Date.now() - startTime;
      const status = response ? response.status() : 0;
      const title = await page.title();
      const content = await page.content();

      // IMPERVA ERROR 17 & SECURITY BLOCK DETECTION
      const isError17 = content.includes('Error 17') || content.includes('Access denied') || content.includes('Incident ID: 7752000');
      const isWafChallenge = isError17 || content.includes('_Incapsula_Resource') || content.includes('Request unsuccessful') || content.includes('Powered by Imperva');

      // Probe registration page
      let regStatus = 0;
      let regTitle = '';
      let regContent = '';
      try {
        const regRes = await page.goto(this.registerUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        regStatus = regRes ? regRes.status() : 0;
        regTitle = await page.title();
        regContent = await page.content();
      } catch(e) {}

      const isRegError17 = regContent.includes('Error 17') || regContent.includes('Access denied');
      const isRegWaf = isRegError17 || regContent.includes('_Incapsula_Resource') || regContent.includes('Powered by Imperva');

      // STRICT SLOT VALIDATION
      const isPortalOnline = (status === 200 || regStatus === 200) && !isError17 && !isRegError17;
      const isRegistrationOpen = (regStatus === 200 && regTitle.toLowerCase().includes('create an account')) && !isRegWaf && !isRegError17;

      const snapshot = {
        scanId,
        timestamp: new Date().toISOString(),
        durationMs,
        httpStatus: status,
        registrationHttpStatus: regStatus,
        pageTitle: title || regTitle,
        isPortalOnline,
        isRegistrationOpen,
        isWafChallenge,
        isError17: isError17 || isRegError17
      };

      this.lastScrapedSnapshot = snapshot;
      this.lastCheck = snapshot;

      // Persist scan history to PostgreSQL
      if (this.pool) {
        try {
          await this.pool.query(
            `INSERT INTO scan_history (scan_id, timestamp, duration_ms, http_status, registration_status, page_title, is_online, is_open, is_waf, is_error17)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [scanId, snapshot.timestamp, durationMs, status, regStatus, snapshot.pageTitle, isPortalOnline, isRegistrationOpen, isWafChallenge, snapshot.isError17]
          );
        } catch(e) {}
      }

      if (isRegistrationOpen) {
        const newSlot = {
          id: 'SLOT-' + Date.now(),
          timestamp: new Date().toISOString(),
          vac: 'Islamabad / Lahore VAC',
          category: 'Schengen Short Stay (C) / National Long Stay (D)',
          status: 'OPEN NOW',
          details: `Portal registration page is accessible (${regTitle})`
        };
        this.detectedSlots.unshift(newSlot);

        if (this.pool) {
          try {
            await this.pool.query(
              `INSERT INTO slots (id, timestamp, vac, category, status, details) VALUES ($1, $2, $3, $4, $5, $6)`,
              [newSlot.id, newSlot.timestamp, newSlot.vac, newSlot.category, newSlot.status, newSlot.details]
            );
          } catch(e) {}
        }

        this.addLog('SLOT', `🎉 SLOT DETECTED! GVC World registration is open (${regTitle})`, newSlot);
        this.emit('slot', newSlot);
      } else if (isError17 || isRegError17) {
        this.addLog('WAF', `Imperva Error 17 Blocked direct link (HTTP ${status}). Official gateway routing required.`, snapshot);
      } else if (isWafChallenge) {
        this.addLog('WAF', `Imperva Security Active (HTTP ${status}). Probe completed in ${durationMs}ms.`, snapshot);
      } else {
        this.addLog('SCAN', `Check ${scanId} complete. Status: HTTP ${status}, Response Time: ${durationMs}ms.`, snapshot);
      }

      this.emit('status', this.lastCheck);
      this.emit('snapshot', this.lastScrapedSnapshot);
      return snapshot;

    } catch (err) {
      const durationMs = Date.now() - startTime;
      this.addLog('ERROR', `Check ${scanId} network retry: ${err.message} (${durationMs}ms)`);
      this.lastCheck = {
        scanId,
        timestamp: new Date().toISOString(),
        durationMs,
        httpStatus: 0,
        error: err.message,
        isPortalOnline: false,
        isRegistrationOpen: false,
        isError17: false
      };
      this.emit('status', this.lastCheck);
      return this.lastCheck;
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }
  }

  getAnalytics() {
    const scanLogs = this.logs.filter(l => l.type === 'SCAN' || l.type === 'WAF');
    const totalScans = scanLogs.length;

    let avgLatency = 0;
    if (totalScans > 0) {
      const latencies = scanLogs.map(l => l.details?.durationMs || 0).filter(l => l > 0);
      if (latencies.length > 0) {
        avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
      }
    }

    const date = new Date();
    const day = date.getDay();
    const hour = date.getHours();

    let windowStatus = 'Standard Window';
    if (day === 2 || day === 4) {
      if (hour >= 9 && hour <= 12) windowStatus = '🔥 PEAK OPENING WINDOW NOW ACTIVE';
      else if (hour >= 8 && hour <= 15) windowStatus = 'High Opening Probability Window';
    }

    let target = new Date(date);
    target.setHours(9, 0, 0, 0);
    while (target <= date || (target.getDay() !== 2 && target.getDay() !== 4)) {
      target.setDate(target.getDate() + 1);
      target.setHours(9, 0, 0, 0);
    }

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const nextExpectedText = `${dayNames[target.getDay()]}, ${target.toLocaleDateString()} at 09:00 AM PKT`;

    return {
      totalScans,
      avgLatencyMs: avgLatency,
      windowStatus,
      nextExpectedText,
      primeDays: 'Tuesday & Thursday',
      primeHours: '09:00 AM - 12:00 PM PKT'
    };
  }
}

module.exports = new MonitorAgent();
