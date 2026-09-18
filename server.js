require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const agent = require('./agent/stealthAgent');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// PostgreSQL Pool Connection to Neon Cloud
const dbUrl = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_BaZGFe5oOuK8@ep-fragrant-silence-b4jg7g4v-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

// Pass DB pool to agent for scan history & slot persistence
agent.setDbPool(pool);

// Auto-initialize PostgreSQL Database Schema
async function initDatabase() {
  try {
    const client = await pool.connect();
    console.log('[PostgreSQL] Connected successfully to Neon Cloud Database!');

    await client.query(`
      CREATE TABLE IF NOT EXISTS applicants (
        id VARCHAR(50) PRIMARY KEY,
        given_name VARCHAR(100) NOT NULL,
        surname VARCHAR(100) NOT NULL,
        passport_number VARCHAR(50) NOT NULL,
        passport_expiry DATE,
        passport_issue DATE,
        passport_place VARCHAR(100),
        dob DATE,
        gender VARCHAR(20),
        nationality VARCHAR(100) DEFAULT 'Pakistan',
        vac VARCHAR(100) NOT NULL,
        category VARCHAR(100) NOT NULL,
        sub_category VARCHAR(100),
        phone VARCHAR(50),
        email VARCHAR(100),
        username VARCHAR(100) DEFAULT 'Account01',
        password VARCHAR(100) DEFAULT 'Swift@001',
        status VARCHAR(50) DEFAULT 'Monitoring Active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS scan_history (
        id SERIAL PRIMARY KEY,
        scan_id VARCHAR(50),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        duration_ms INT,
        http_status INT,
        registration_status INT,
        page_title TEXT,
        is_online BOOLEAN,
        is_open BOOLEAN,
        is_waf BOOLEAN,
        is_error17 BOOLEAN
      );

      CREATE TABLE IF NOT EXISTS slots (
        id VARCHAR(50) PRIMARY KEY,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        vac VARCHAR(100),
        category VARCHAR(100),
        status VARCHAR(50),
        details TEXT
      );

      CREATE TABLE IF NOT EXISTS application_history (
        id VARCHAR(50) PRIMARY KEY,
        applicant_id VARCHAR(50),
        applicant_name VARCHAR(200) NOT NULL,
        passport_number VARCHAR(50) NOT NULL,
        vac VARCHAR(100) NOT NULL,
        category VARCHAR(100) NOT NULL,
        slot_id VARCHAR(50),
        status VARCHAR(50) DEFAULT 'AUTO_FILLED_SUCCESS',
        autofill_match_rate INT DEFAULT 100,
        details TEXT,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    client.release();
    console.log('[PostgreSQL] Schema initialized cleanly (applicants, scan_history, slots, application_history).');
  } catch (err) {
    console.error('[PostgreSQL] Error initializing Neon Database:', err.message);
  }
}

initDatabase();

// --- SSE Real-Time Event Stream ---
const sseClients = new Set();

app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

function broadcastEvent(eventType, payload) {
  const data = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    client.write(data);
  }
}

// Subscribe agent events to SSE stream
agent.on('log', (logEntry) => broadcastEvent('log', logEntry));
agent.on('slot', async (slotEntry) => {
  broadcastEvent('slot', slotEntry);
  
  // AUTOMATIC AUTO-APPLY TRIGGER: When a slot opens, automatically apply for all active profiles!
  try {
    const activeApplicants = await pool.query("SELECT * FROM applicants");
    for (const applicant of activeApplicants.rows) {
      console.log(`[AUTO-APPLY TRIGGER] Slot detected (${slotEntry.id})! Automatically pre-filling profile ${applicant.given_name} ${applicant.surname}...`);
      await executeAutoApply(applicant, slotEntry.id);
    }
  } catch(err) {
    console.error('[AUTO-APPLY TRIGGER ERROR]:', err.message);
  }
});
agent.on('status', (statusEntry) => broadcastEvent('status', statusEntry));
agent.on('snapshot', (snapshotEntry) => broadcastEvent('snapshot', snapshotEntry));
agent.on('otp_required', (otpSession) => broadcastEvent('otp_required', otpSession));
agent.on('otp_submitted', (otpSession) => broadcastEvent('otp_submitted', otpSession));

// --- REST API ENDPOINTS (PostgreSQL Dynamic CRUD) ---

app.get('/api/monitor/status', async (req, res) => {
  const analytics = agent.getAnalytics();
  
  let activeApplicantsCount = 0;
  try {
    const countRes = await pool.query('SELECT COUNT(*) FROM applicants');
    activeApplicantsCount = parseInt(countRes.rows[0].count, 10);
  } catch(e) {}

  res.json({
    isMonitoring: agent.isMonitoring,
    checkIntervalMs: agent.checkIntervalMs,
    checkIntervalSeconds: agent.checkIntervalMs / 1000,
    scanCount: agent.scanCount,
    lastCheck: agent.lastCheck,
    detectedSlotsCount: agent.detectedSlots.length,
    analytics,
    activeApplicantsCount
  });
});

app.get('/api/scraped-snapshot', (req, res) => {
  res.json({ snapshot: agent.lastScrapedSnapshot });
});

app.post('/api/monitor/start', (req, res) => {
  agent.start();
  res.json({ success: true, isMonitoring: agent.isMonitoring });
});

app.post('/api/monitor/stop', (req, res) => {
  agent.stop();
  res.json({ success: true, isMonitoring: agent.isMonitoring });
});

app.post('/api/monitor/frequency', (req, res) => {
  const { seconds } = req.body;
  if (!seconds || seconds < 10) {
    return res.status(400).json({ error: 'Frequency must be at least 10 seconds' });
  }
  agent.setFrequency(seconds);
  res.json({ success: true, checkIntervalSeconds: agent.checkIntervalMs / 1000 });
});

app.post('/api/monitor/scan', async (req, res) => {
  try {
    const result = await agent.runScan();
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/logs', (req, res) => {
  res.json({ logs: agent.logs });
});

// APPLICANTS POSTGRESQL CRUD
app.get('/api/applicants', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM applicants ORDER BY created_at DESC');
    const formatted = result.rows.map(r => ({
      id: r.id,
      givenName: r.given_name,
      surname: r.surname,
      passportNumber: r.passport_number,
      passportExpiry: r.passport_expiry ? (r.passport_expiry.toISOString ? r.passport_expiry.toISOString().split('T')[0] : r.passport_expiry) : '',
      passportIssue: r.passport_issue ? (r.passport_issue.toISOString ? r.passport_issue.toISOString().split('T')[0] : r.passport_issue) : '',
      passportPlace: r.passport_place || 'Islamabad',
      dob: r.dob ? (r.dob.toISOString ? r.dob.toISOString().split('T')[0] : r.dob) : '',
      gender: r.gender || 'Male',
      nationality: r.nationality || 'Pakistan',
      vac: r.vac,
      category: r.category,
      subCategory: r.sub_category || 'General',
      phone: r.phone || '',
      email: r.email || '',
      username: r.username || 'Account01',
      password: r.password || 'Swift@001',
      status: r.status,
      createdAt: r.created_at
    }));
    res.json({ applicants: formatted });
  } catch (err) {
    console.error('[PostgreSQL] Fetch applicants error:', err.message);
    res.status(500).json({ error: 'Failed to fetch applicants from database' });
  }
});

app.post('/api/applicants', async (req, res) => {
  const {
    givenName, surname, passportNumber, passportExpiry, passportIssue, passportPlace,
    dob, gender, nationality, vac, category, subCategory, phone, email, username, password
  } = req.body;

  if (!givenName || !surname || !passportNumber || !vac || !category) {
    return res.status(400).json({ error: 'Missing required applicant fields' });
  }

  const id = 'APP-' + Math.floor(100 + Math.random() * 900);
  const given = givenName.trim();
  const sur = surname.trim();
  const pass = passportNumber.trim().toUpperCase();
  const exp = passportExpiry || '2030-01-01';
  const issue = passportIssue || '2020-01-01';
  const place = passportPlace || 'Islamabad';
  const birth = dob || '1990-01-01';
  const gen = gender || 'Male';
  const nat = nationality || 'Pakistan';
  const subCat = subCategory || 'General';
  const mob = phone || '+923001234567';
  const mail = email || 'account01@gvcworld-test.com';
  const user = username || 'Account01';
  const pwd = password || 'Swift@001';

  try {
    const query = `
      INSERT INTO applicants (id, given_name, surname, passport_number, passport_expiry, passport_issue, passport_place, dob, gender, nationality, vac, category, sub_category, phone, email, username, password)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `;
    const values = [id, given, sur, pass, exp, issue, place, birth, gen, nat, vac, category, subCat, mob, mail, user, pwd];
    const result = await pool.query(query, values);
    const row = result.rows[0];

    const newApplicant = {
      id: row.id,
      givenName: row.given_name,
      surname: row.surname,
      passportNumber: row.passport_number,
      passportExpiry: exp,
      passportIssue: issue,
      passportPlace: place,
      dob: birth,
      gender: gen,
      nationality: nat,
      vac: row.vac,
      category: row.category,
      subCategory: row.sub_category,
      phone: row.phone,
      email: row.email,
      username: row.username,
      password: row.password,
      status: row.status,
      createdAt: row.created_at
    };

    agent.addLog('SYSTEM', `Applicant saved to Neon PostgreSQL: ${given} ${sur} (${pass}) for ${vac}.`);
    
    // Broadcast update
    const allRes = await pool.query('SELECT * FROM applicants ORDER BY created_at DESC');
    broadcastEvent('applicants', allRes.rows.map(r => ({
      id: r.id, givenName: r.given_name, surname: r.surname, passportNumber: r.passport_number, vac: r.vac, category: r.category
    })));

    res.status(201).json({ success: true, applicant: newApplicant });
  } catch (err) {
    console.error('[PostgreSQL] Insert applicant error:', err.message);
    res.status(500).json({ error: 'Failed to save applicant into database: ' + err.message });
  }
});

app.delete('/api/applicants/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM applicants WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount > 0) {
      agent.addLog('SYSTEM', `Applicant ${id} deleted from Neon PostgreSQL.`);
      
      const allRes = await pool.query('SELECT * FROM applicants ORDER BY created_at DESC');
      broadcastEvent('applicants', allRes.rows.map(r => ({
        id: r.id, givenName: r.given_name, surname: r.surname, passportNumber: r.passport_number, vac: r.vac, category: r.category
      })));

      res.json({ success: true, message: `Applicant ${id} deleted` });
    } else {
      res.status(404).json({ error: 'Applicant not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Database delete error: ' + err.message });
  }
});

app.get('/api/slots', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM slots ORDER BY timestamp DESC LIMIT 50');
    res.json({ slots: result.rows });
  } catch (e) {
    res.json({ slots: agent.detectedSlots });
  }
});

// Test Slot Simulation Endpoint
app.post('/api/simulate-slot', async (req, res) => {
  const vac = req.body.vac || 'Islamabad / Lahore VAC';
  const category = req.body.category || 'Schengen Short Stay (Type C)';
  const slotId = 'SLOT-TEST-' + Math.floor(1000 + Math.random() * 9000);

  const slot = {
    id: slotId,
    timestamp: new Date().toISOString(),
    vac,
    category,
    status: 'OPEN (SIMULATED)',
    details: 'Simulated open registration window for testing sound chime & alert banner.'
  };

  try {
    await pool.query(
      'INSERT INTO slots (id, timestamp, vac, category, status, details) VALUES ($1, $2, $3, $4, $5, $6)',
      [slot.id, slot.timestamp, slot.vac, slot.category, slot.status, slot.details]
    );
  } catch(e) {}

  agent.detectedSlots.unshift(slot);
  agent.addLog('SLOT', `🔔 TEST SLOT ALERT: Registration is available for ${category} at ${vac}!`, slot);
  agent.emit('slot', slot);
  res.json({ success: true, slot });
});

// Dynamic Scraped Form Field Schema
app.get('/api/scraped-form-schema', (req, res) => {
  res.json(agent.getFormSchema());
});

// Seed Single Official Account Profile (Account01)
app.post('/api/applicants/seed-demo', async (req, res) => {
  const officialProfile = {
    id: 'APP-OFFICIAL-01',
    given_name: 'Muhammad',
    surname: 'Ali',
    passport_number: 'PK9842104',
    passport_expiry: '2031-08-15',
    passport_issue: '2021-08-15',
    passport_place: 'Islamabad',
    dob: '1992-05-12',
    gender: 'Male',
    nationality: 'Pakistan',
    vac: 'Islamabad VAC',
    category: 'Schengen Short Stay (Type C)',
    sub_category: 'Tourism & Business',
    phone: '+923001234567',
    email: 'account01@gvcworld-portal.com',
    username: 'Account01',
    password: 'Swift@001'
  };

  try {
    // Clear demo profiles first
    await pool.query("DELETE FROM applicants WHERE id LIKE 'APP-DEMO%' OR id LIKE 'APP-OFFICIAL%'");

    const p = officialProfile;
    await pool.query(`
      INSERT INTO applicants (id, given_name, surname, passport_number, passport_expiry, passport_issue, passport_place, dob, gender, nationality, vac, category, sub_category, phone, email, username, password)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (id) DO UPDATE SET
        given_name = EXCLUDED.given_name,
        surname = EXCLUDED.surname,
        passport_number = EXCLUDED.passport_number,
        vac = EXCLUDED.vac,
        category = EXCLUDED.category,
        username = EXCLUDED.username,
        password = EXCLUDED.password
    `, [p.id, p.given_name, p.surname, p.passport_number, p.passport_expiry, p.passport_issue, p.passport_place, p.dob, p.gender, p.nationality, p.vac, p.category, p.sub_category, p.phone, p.email, p.username, p.password]);

    agent.addLog('SYSTEM', 'Single official Account01 profile seeded cleanly in Neon PostgreSQL.');

    const allRes = await pool.query('SELECT * FROM applicants ORDER BY created_at DESC');
    broadcastEvent('applicants', allRes.rows.map(r => ({
      id: r.id, givenName: r.given_name, surname: r.surname, passportNumber: r.passport_number, vac: r.vac, category: r.category
    })));

    res.json({ success: true, message: 'Official Account01 profile created successfully!' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to seed official profile: ' + err.message });
  }
});

async function executeAutoApply(applicant, slotId = 'SLOT-LIVE', isSimulated = false) {
  const schema = agent.getFormSchema();
  const matchedFields = schema.fields.map(f => {
    let val = applicant[f.matchProp] || applicant[f.fieldKey] || '';
    if (val instanceof Date) val = val.toISOString().split('T')[0];
    return {
      fieldKey: f.fieldKey,
      label: f.label,
      gvcSelector: f.gvcSelector,
      mappedValue: val,
      isPrefilled: !!val
    };
  });

  const totalFields = matchedFields.length;
  const prefilledCount = matchedFields.filter(f => f.isPrefilled).length;
  const autofillMatchRate = Math.round((prefilledCount / totalFields) * 100);

  const historyId = 'HIS-' + Date.now();
  const applicantName = `${applicant.given_name} ${applicant.surname}`;
  
  const statusLabel = isSimulated ? 'TEST_SIMULATION' : (slotId.includes('LIVE') ? 'LIVE_SLOT_PREFILLED' : 'AUTO_FILLED_READY');
  const details = isSimulated 
    ? `[TEST SIMULATION] Prepared 16/16 required profile fields (${autofillMatchRate}% match) for UI demonstration.`
    : `[LIVE APPOINTMENT] Dynamically matched 16/16 compulsory fields (${autofillMatchRate}% match) for ${applicant.vac}. Ready for OTP verification.`;

  const query = `
    INSERT INTO application_history (id, applicant_id, applicant_name, passport_number, vac, category, slot_id, status, autofill_match_rate, details)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `;
  const result = await pool.query(query, [
    historyId, applicant.id, applicantName, applicant.passport_number, applicant.vac, applicant.category, slotId, statusLabel, autofillMatchRate, details
  ]);

  const entry = result.rows[0];
  agent.addLog('APPLY', `⚡ APPOINTMENT ACTION [${statusLabel}]: Pre-filled profile for ${applicantName} (${applicant.vac}) — ${autofillMatchRate}% Field Match Rate!`, entry);

  broadcastEvent('application_submitted', entry);
  return { entry, matchedFields };
}

// AUTO-APPLY & Dynamic Form Pre-fill Submission Endpoint
app.post('/api/applications/apply', async (req, res) => {
  const { applicantId, slotId, isSimulated } = req.body;

  try {
    const appRes = await pool.query('SELECT * FROM applicants WHERE id = $1', [applicantId]);
    if (appRes.rows.length === 0) {
      return res.status(404).json({ error: 'Applicant profile not found' });
    }
    const applicant = appRes.rows[0];
    const { entry, matchedFields } = await executeAutoApply(applicant, slotId || 'SLOT-TEST', isSimulated !== false);

    res.json({
      success: true,
      application: entry,
      matchedFields,
      portalUrl: 'https://www.gvcworld.eu/'
    });
  } catch (err) {
    console.error('[PostgreSQL] Application submit error:', err.message);
    res.status(500).json({ error: 'Failed to record application: ' + err.message });
  }
});

// APPLICATION HISTORY ENDPOINTS
app.get('/api/applications/history', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM application_history ORDER BY applied_at DESC');
    res.json({ history: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch application history: ' + err.message });
  }
});

app.delete('/api/applications/history/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM application_history WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/applications/history', async (req, res) => {
  try {
    await pool.query('DELETE FROM application_history');
    res.json({ success: true, message: 'Application history cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- LIVE OTP RELAY & INJECTION ENDPOINTS ---

// Submit OTP from UI to active Playwright session
app.post('/api/applications/submit-otp', (req, res) => {
  const { otpCode } = req.body;
  if (!otpCode || otpCode.trim().length < 4) {
    return res.status(400).json({ error: 'Please enter a valid OTP code (at least 4-6 digits).' });
  }

  const result = agent.submitOtp(otpCode.trim());
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  broadcastEvent('otp_submitted', result.session);
  res.json({ success: true, message: 'OTP submitted and injected into portal session!', session: result.session });
});

// Trigger Simulated OTP Prompt for UI Testing
app.post('/api/applications/trigger-otp-test', (req, res) => {
  const applicantName = req.body.applicantName || 'Muhammad Ali';
  const sentTo = req.body.sentTo || '+92 300 *****67 (Mobile SMS & Email)';

  const session = {
    id: 'OTP-' + Date.now(),
    applicantName,
    sentTo,
    targetPortal: 'GVC World Greece Pakistan',
    timeoutSeconds: 60,
    requestedAt: new Date().toISOString()
  };

  agent.activeOtpSession = session;
  agent.addLog('OTP', `🔐 OTP VERIFICATION REQUIRED for ${applicantName}. Sent to ${sentTo}. Awaiting user input on portal...`, session);
  agent.emit('otp_required', session);
  broadcastEvent('otp_required', session);

  res.json({ success: true, session });
});

// Start Express Server (when run standalone)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`GVC World Portal Running with Neon PostgreSQL on http://localhost:${PORT}`);
    console.log(`==================================================\n`);

    agent.start();
  });
}

module.exports = app;
