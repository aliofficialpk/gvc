require('dotenv').config();
const { Pool } = require('pg');
const agent = require('../agent/stealthAgent');

const dbUrl = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_BaZGFe5oOuK8@ep-fragrant-silence-b4jg7g4v-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
agent.setDbPool(pool);

const officialFullFormData = {
  username: 'Account01',
  password: 'Swift@001',
  phone: '+923001234567',
  email: 'account01@gvcworld-portal.com',

  surname: 'Ali',
  surnameAtBirth: 'Ali',
  givenName: 'Muhammad',
  dob: '1992-05-12',
  placeOfBirth: 'Islamabad',
  countryOfBirth: 'Pakistan',
  nationality: 'Pakistan',
  nationalityAtBirth: 'Pakistan',
  gender: 'Male',
  civilStatus: 'Single',

  legalGuardian: 'N/A',

  cnicNumber: '61101-1234567-1',
  travelDocumentType: 'Ordinary Passport',
  passportNumber: 'PK9842104',
  passportIssue: '2021-08-15',
  passportExpiry: '2031-08-15',
  passportPlace: 'Islamabad, Pakistan',

  euFamilyMember: 'N/A',

  residenceCountry: 'PAKISTAN',
  residenceCity: 'Islamabad',
  residenceAddress: 'House 123, Street 45, Sector F-8/2',
  residencePostal: '44000',
  residenceEmail: 'account01@gvcworld-portal.com',
  residencePhone: '+92511234567',
  residenceMobile: '+923001234567',
  courierSameAddress: 'Yes',
  residenceOtherCountryName: 'N/A',

  occupation: 'SOFTWARE ENGINEER',
  employerName: 'Tech Solutions Ltd',
  employerStreet: 'Blue Area, Jinnah Avenue',
  employerPostal: '44000',
  employerCity: 'Islamabad',
  employerCountry: 'PAKISTAN',

  vac: 'Islamabad VAC',
  category: 'Schengen Visa (Short Stay Type C)',
  travelPurpose: 'TOURISM',
  otherPurpose: 'Other',
  purposeAdditionalInfo: 'Sightseeing & Tourist Visit',
  destinationState1: 'GREECE',
  destinationState2: '',
  firstEntryState: 'GREECE',
  entriesRequested: 'SINGLE',
  intendedArrivalDate: '2026-10-15',
  intendedDepartureDate: '2026-10-30',
  durationOfStayDays: '15',

  fingerprintsCollected: 'No',
  entryPermitFinal: 'N/A',

  hostInfo: 'Hotel Royal Olympic, Athanasiou Diakou 28, Athens, Greece, Tel: +302109288400',

  hotelName: 'Royal Olympic Hotel Athens',
  hotelStreet: '28 Athanasiou Diakou Street',
  hotelCity: 'Athens',
  hotelPostal: '11743',
  hotelEmail: 'info@royalolympic.gr',
  hotelCountryPrefix: 'GREECE +30',
  hotelPhone: '2109288400',

  travelCostCoveredBy: 'Applicant himself',

  personFilling: 'Applicant Himself',
  insuranceDeclaration: 'Yes - 100% Compliant Schengen Insurance (Min 30,000 EUR Coverage)',
  accuracyConfirmation: true
};

async function runTest() {
  console.log('=== SEEDING & VERIFYING FULL SUB-NUMBERED APPLICANT PROFILE & AUTO-APPLY ===');
  
  try {
    await pool.query("ALTER TABLE applicants ADD COLUMN IF NOT EXISTS full_form_data TEXT");

    const jsonStr = JSON.stringify(officialFullFormData);
    await pool.query(`
      INSERT INTO applicants (id, given_name, surname, passport_number, passport_expiry, passport_issue, passport_place, dob, gender, nationality, vac, category, sub_category, phone, email, username, password, full_form_data)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      ON CONFLICT (id) DO UPDATE SET
        given_name = EXCLUDED.given_name,
        surname = EXCLUDED.surname,
        passport_number = EXCLUDED.passport_number,
        vac = EXCLUDED.vac,
        category = EXCLUDED.category,
        username = EXCLUDED.username,
        password = EXCLUDED.password,
        full_form_data = EXCLUDED.full_form_data
    `, ['APP-OFFICIAL-01', 'Muhammad', 'Ali', 'PK9842104', '2031-08-15', '2021-08-15', 'Islamabad', '1992-05-12', 'Male', 'Pakistan', 'Islamabad VAC', 'Schengen Visa (Short Stay Type C)', 'TOURISM', '+923001234567', 'account01@gvcworld-portal.com', 'Account01', 'Swift@001', jsonStr]);
    
    console.log('[PostgreSQL] APP-OFFICIAL-01 updated with complete sub-numbered full_form_data JSON!');

    const res = await pool.query("SELECT * FROM applicants WHERE id = 'APP-OFFICIAL-01'");
    const applicant = res.rows[0];

    console.log('\nExecuting Playwright portal application run...');
    const result = await agent.executeRealPortalApplication(applicant, 'SLOT-VERIFICATION-SUBFIELDS');
    
    console.log('\n=== AUTO-APPLY EXECUTION RESULT ===');
    console.log(`- History Log ID: ${result.entry.id}`);
    console.log(`- Status: ${result.entry.status}`);
    console.log(`- Autofill Match Rate: ${result.entry.autofill_match_rate}%`);
    console.log(`- Total Mapped Fields: ${result.matchedFields.length}`);
    
    const prefilled = result.matchedFields.filter(f => f.isPrefilled);
    console.log(`- Prefilled Fields Count: ${prefilled.length}/${result.matchedFields.length}`);
    
    console.log('\nStage Audit Clearance Checklist:');
    result.stageBreakdown.forEach(s => {
      console.log(`  [Stage ${s.id}] ${s.name} -> ${s.status} (${s.note})`);
    });

  } catch(e) {
    console.error('Test error:', e);
  } finally {
    await pool.end();
    console.log('\nTest completed successfully.');
  }
}

runTest();
