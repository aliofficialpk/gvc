const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function analyzeGVCWebsite() {
  const outputDir = path.join(__dirname, 'gvc_analysis');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('Launching browser...');
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
    });
  } catch (err) {
    console.log('Default chromium launch failed, trying msedge channel...', err.message);
    browser = await chromium.launch({
      channel: 'msedge',
      headless: true,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
    });
  }

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US'
  });

  const page = await context.newPage();

  const networkRequests = [];
  const consoleLogs = [];

  page.on('request', req => {
    networkRequests.push({
      type: 'request',
      url: req.url(),
      method: req.method(),
      headers: req.headers(),
      postData: req.postData()
    });
  });

  page.on('response', async res => {
    let body = '';
    try {
      if (res.headers()['content-type']?.includes('application/json') || res.headers()['content-type']?.includes('text')) {
        body = await res.text();
      }
    } catch (e) {}

    networkRequests.push({
      type: 'response',
      url: res.url(),
      status: res.status(),
      statusText: res.statusText(),
      headers: res.headers(),
      bodyPreview: body ? body.substring(0, 500) : ''
    });
  });

  page.on('console', msg => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });

  const targetUrl = 'https://pk-gr-services.gvcworld.eu/login/PK/en?lang=en_US';
  console.log(`Navigating to ${targetUrl}...`);

  try {
    const response = await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('Navigation status:', response ? response.status() : 'No response');

    // Wait a bit for any dynamic scripts / Incapsula challenges to complete
    await page.waitForTimeout(5000);

    const title = await page.title();
    const currentUrl = page.url();
    console.log('Page Title:', title);
    console.log('Final URL:', currentUrl);

    // Save screenshot
    await page.screenshot({ path: path.join(outputDir, 'landing_page.png'), fullPage: true });

    // Save HTML content
    const content = await page.content();
    fs.writeFileSync(path.join(outputDir, 'page_content.html'), content);

    // Inspect elements, forms, links, buttons
    const forms = await page.evaluate(() => {
      const formEls = Array.from(document.querySelectorAll('form'));
      return formEls.map((f, i) => {
        const inputs = Array.from(f.querySelectorAll('input, select, textarea, button')).map(el => ({
          tag: el.tagName,
          name: el.name || '',
          id: el.id || '',
          type: el.getAttribute('type') || '',
          placeholder: el.getAttribute('placeholder') || '',
          required: el.hasAttribute('required'),
          value: el.value || '',
          labelText: el.labels ? Array.from(el.labels).map(l => l.innerText.trim()).join(' ') : ''
        }));
        return {
          index: i,
          id: f.id,
          action: f.action,
          method: f.method,
          inputs: inputs
        };
      });
    });

    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a')).map(a => ({
        text: a.innerText.trim(),
        href: a.href
      })).filter(l => l.text || l.href);
    });

    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).map(b => ({
        text: b.innerText.trim(),
        id: b.id,
        class: b.className,
        type: b.type
      }));
    });

    const cookies = await context.cookies();
    const localStorageData = await page.evaluate(() => JSON.stringify(localStorage));
    const sessionStorageData = await page.evaluate(() => JSON.stringify(sessionStorage));

    const analysisData = {
      title,
      currentUrl,
      forms,
      links,
      buttons,
      cookies: cookies.map(c => ({ name: c.name, domain: c.domain, path: c.path, secure: c.secure, httpOnly: c.httpOnly })),
      localStorage: localStorageData,
      sessionStorage: sessionStorageData,
      consoleLogs,
      networkSummary: networkRequests.map(n => n.type === 'request' ? `REQ [${n.method}] ${n.url}` : `RES [${n.status}] ${n.url}`)
    };

    fs.writeFileSync(path.join(outputDir, 'analysis_result.json'), JSON.stringify(analysisData, null, 2));
    fs.writeFileSync(path.join(outputDir, 'network_requests.json'), JSON.stringify(networkRequests, null, 2));

    console.log('Analysis complete. Results saved to scratch/gvc_analysis directory.');
  } catch (err) {
    console.error('Browser navigation failed:', err.message);
    const content = await page.content();
    fs.writeFileSync(path.join(outputDir, 'page_content_error.html'), content);
    await page.screenshot({ path: path.join(outputDir, 'error_page.png') });
  } finally {
    await browser.close();
  }
}

analyzeGVCWebsite();
