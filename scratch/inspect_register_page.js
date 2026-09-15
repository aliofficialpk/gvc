const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function inspectRegisterPage() {
  console.log('Launching stealth browser for registration page inspection...');
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const page = await context.newPage();
  const regUrl = 'https://pk-gr-services.gvcworld.eu/register/PK/en?lang=en_US';

  try {
    await page.goto(regUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    const title = await page.title();
    console.log('Title:', title);

    // Save screenshot
    await page.screenshot({ path: path.join(__dirname, 'register_page.png'), fullPage: true });

    // Extract forms and fields
    const formData = await page.evaluate(() => {
      const forms = Array.from(document.querySelectorAll('form'));
      return forms.map((f, i) => {
        const inputs = Array.from(f.querySelectorAll('input, select, textarea, button')).map(el => {
          let labelText = '';
          if (el.id) {
            const l = document.querySelector(`label[for="${el.id}"]`);
            if (l) labelText = l.innerText.trim();
          }
          if (!labelText && el.closest('label')) {
            labelText = el.closest('label').innerText.trim();
          }
          return {
            tag: el.tagName,
            id: el.id || '',
            name: el.name || '',
            type: el.getAttribute('type') || '',
            placeholder: el.getAttribute('placeholder') || '',
            required: el.hasAttribute('required'),
            labelText,
            class: el.className
          };
        });
        return {
          index: i,
          id: f.id || '',
          action: f.action || '',
          method: f.method || '',
          inputs
        };
      });
    });

    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a')).map(a => ({
        text: a.innerText.trim(),
        href: a.href
      })).filter(l => l.text);
    });

    console.log('Form Data Extracted:');
    console.log(JSON.stringify(formData, null, 2));
    console.log('Links Extracted:');
    console.log(JSON.stringify(links, null, 2));

    fs.writeFileSync(path.join(__dirname, 'register_form_data.json'), JSON.stringify({ title, formData, links }, null, 2));

  } catch (err) {
    console.error('Error inspecting registration page:', err.message);
  } finally {
    await browser.close();
  }
}

inspectRegisterPage();
