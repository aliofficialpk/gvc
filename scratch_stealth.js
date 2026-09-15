const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testStealth() {
  const outputDir = path.join(__dirname, 'gvc_stealth_analysis');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('Launching browser with stealth parameters...');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: false, // Headful mode bypasses basic headless bot detection
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1366,768'
    ]
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1
  });

  // Mask navigator.webdriver
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const page = await context.newPage();

  const targetUrl = 'https://pk-gr-services.gvcworld.eu/login/PK/en?lang=en_US';
  console.log(`Navigating to ${targetUrl}...`);

  try {
    const res = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 40000 });
    console.log('Initial Response Status:', res ? res.status() : 'N/A');

    // Wait up to 15s to observe if Incapsula JS challenge redirects to actual login page
    for (let i = 1; i <= 15; i++) {
      await page.waitForTimeout(1000);
      const title = await page.title();
      const url = page.url();
      console.log(`Second ${i}: Title="${title}" URL="${url}"`);
      if (title && !title.includes('Incident') && !title.includes('Forbidden')) {
        console.log('Page loaded successfully!');
        break;
      }
    }

    const title = await page.title();
    const currentUrl = page.url();

    await page.screenshot({ path: path.join(outputDir, 'page_screenshot.png'), fullPage: true });
    const content = await page.content();
    fs.writeFileSync(path.join(outputDir, 'page_content.html'), content);

    const forms = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('form')).map((f, i) => ({
        index: i,
        id: f.id,
        name: f.name,
        action: f.action,
        method: f.method,
        inputs: Array.from(f.querySelectorAll('input, select, textarea, button')).map(el => ({
          tag: el.tagName,
          name: el.name || el.id || '',
          type: el.getAttribute('type') || '',
          placeholder: el.getAttribute('placeholder') || '',
          required: el.hasAttribute('required'),
          class: el.className
        }))
      }));
    });

    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button, a.btn, input[type="submit"]')).map(b => ({
        text: b.innerText.trim(),
        id: b.id,
        class: b.className,
        href: b.href || ''
      }));
    });

    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a')).map(a => ({
        text: a.innerText.trim(),
        href: a.href
      })).filter(l => l.text);
    });

    const data = {
      title,
      currentUrl,
      forms,
      buttons,
      links,
      cookies: await context.cookies()
    };

    fs.writeFileSync(path.join(outputDir, 'stealth_result.json'), JSON.stringify(data, null, 2));
    console.log('Saved stealth result to scratch/gvc_stealth_analysis');

  } catch (err) {
    console.error('Error during stealth navigation:', err.message);
  } finally {
    await browser.close();
  }
}

testStealth();
