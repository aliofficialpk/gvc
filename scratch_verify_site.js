const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function runVerification() {
  const outputDir = path.join(__dirname, 'evidence_data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('=== GVC WORLD EMPIRICAL VERIFICATION ===');
  
  // Test 1: Standard Chromium launch (headless)
  console.log('\n--- TEST 1: Launching Standard Playwright Chromium (headless) ---');
  let browser = await chromium.launch({ headless: true });
  let context = await browser.newContext();
  let page = await context.newPage();

  const networkLogs = [];
  page.on('request', req => {
    networkLogs.push({
      event: 'request',
      url: req.url(),
      method: req.method(),
      resourceType: req.resourceType()
    });
  });

  page.on('response', async res => {
    let bodySnippet = '';
    try {
      if (res.headers()['content-type']?.includes('text') || res.headers()['content-type']?.includes('json')) {
        const text = await res.text();
        bodySnippet = text.substring(0, 300);
      }
    } catch(e){}
    networkLogs.push({
      event: 'response',
      url: res.url(),
      status: res.status(),
      contentType: res.headers()['content-type'] || '',
      bodySnippet
    });
  });

  const targetUrl = 'https://pk-gr-services.gvcworld.eu/login/PK/en?lang=en_US';
  console.log(`Navigating to ${targetUrl}...`);

  let response1;
  try {
    response1 = await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('Response status:', response1 ? response1.status() : 'None');
    console.log('Final Page URL:', page.url());
    console.log('Page Title:', await page.title());

    await page.screenshot({ path: path.join(outputDir, 'test1_headless.png') });
    fs.writeFileSync(path.join(outputDir, 'test1_content.html'), await page.content());
  } catch (err) {
    console.error('Test 1 navigation failed:', err.message);
  } finally {
    await browser.close();
  }

  // Test 2: Checking claimed URLs directly
  console.log('\n--- TEST 2: Probing Claimed URLs ---');
  const urlsToTest = [
    'https://pk-gr-services.gvcworld.eu/login/PK/en?lang=en_US',
    'https://pk-gr-services.gvcworld.eu/register/PK/en',
    'https://pk-gr-services.gvcworld.eu/forgot-password',
    'https://pk-gr-services.gvcworld.eu/dashboard',
    'https://pk-gr-services.gvcworld.eu/profiles',
    'https://pk-gr-services.gvcworld.eu/appointment/select-centre',
    'https://pk-gr-services.gvcworld.eu/appointment/applicant-info',
    'https://pk-gr-services.gvcworld.eu/appointment/documents',
    'https://pk-gr-services.gvcworld.eu/appointment/select-slot',
    'https://pk-gr-services.gvcworld.eu/appointment/review',
    'https://pk-gr-services.gvcworld.eu/appointment/confirmation'
  ];

  browser = await chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled'] });
  context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const urlResults = [];

  for (const url of urlsToTest) {
    const testPage = await context.newPage();
    try {
      console.log(`Navigating to ${url}...`);
      const res = await testPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await testPage.waitForTimeout(3000);
      const title = await testPage.title();
      const finalUrl = testPage.url();
      const status = res ? res.status() : 'N/A';
      const content = await testPage.content();
      const isIncapsula = content.includes('_Incapsula_Resource') || content.includes('Request unsuccessful');

      urlResults.push({
        requestedUrl: url,
        status,
        finalUrl,
        title,
        isIncapsulaChallenge: isIncapsula,
        contentLength: content.length
      });
      console.log(`Result: Status=${status}, Title="${title}", FinalURL=${finalUrl}, WAFBlock=${isIncapsula}`);
    } catch (err) {
      urlResults.push({
        requestedUrl: url,
        error: err.message
      });
      console.log(`Result: Error=${err.message}`);
    } finally {
      await testPage.close();
    }
  }

  await browser.close();

  fs.writeFileSync(path.join(outputDir, 'network_logs.json'), JSON.stringify(networkLogs, null, 2));
  fs.writeFileSync(path.join(outputDir, 'url_results.json'), JSON.stringify(urlResults, null, 2));

  console.log('\nVerification script execution complete.');
}

runVerification();
