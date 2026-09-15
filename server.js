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
        dob DATE,
        vac VARCHAR(100) NOT NULL,
        category VARCHAR(100) NOT NULL,
        sub_category VARCHAR(100),
        phone VARCHAR(50),
        email VARCHAR(100),
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
    `);

    client.release();
    console.log('[PostgreSQL] Schema initialized cleanly (applicants, scan_history, slots).');
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
agent.on('slot', (slotEntry) => broadcastEvent('slot', slotEntry));
agent.on('status', (statusEntry) => broadcastEvent('status', statusEntry));
agent.on('snapshot', (snapshotEntry) => broadcastEvent('snapshot', snapshotEntry));

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
      passportExpiry: r.passport_expiry ? r.passport_expiry.toISOString().split('T')[0] : '',
      dob: r.dob ? r.dob.toISOString().split('T')[0] : '',
      vac: r.vac,
      category: r.category,
      subCategory: r.sub_category,
      phone: r.phone,
      email: r.email,
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
  const { givenName, surname, passportNumber, passportExpiry, dob, vac, category, subCategory, phone, email } = req.body;

  if (!givenName || !surname || !passportNumber || !vac || !category) {
    return res.status(400).json({ error: 'Missing required applicant fields' });
  }

  const id = 'APP-' + Math.floor(100 + Math.random() * 900);
  const given = givenName.trim();
  const sur = surname.trim();
  const pass = passportNumber.trim().toUpperCase();
  const exp = passportExpiry || '2030-01-01';
  const birth = dob || '1990-01-01';
  const subCat = subCategory || 'General';
  const mob = phone || '';
  const mail = email || '';

  try {
    const query = `
      INSERT INTO applicants (id, given_name, surname, passport_number, passport_expiry, dob, vac, category, sub_category, phone, email)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const values = [id, given, sur, pass, exp, birth, vac, category, subCat, mob, mail];
    const result = await pool.query(query, values);
    const row = result.rows[0];

    const newApplicant = {
      id: row.id,
      givenName: row.given_name,
      surname: row.surname,
      passportNumber: row.passport_number,
      passportExpiry: exp,
      dob: birth,
      vac: row.vac,
      category: row.category,
      subCategory: row.sub_category,
      phone: row.phone,
      email: row.email,
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
