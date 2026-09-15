const fs = require('fs');

const urls = [
  'https://pk-gr-services.gvcworld.eu/login/PK/en?lang=en_US',
  'https://pk-gr-services.gvcworld.eu/',
  'https://www.gvcworld.eu/',
  'https://services.gvcworld.eu/'
];

async function probe() {
  for (const url of urls) {
    try {
      console.log(`\n--- Probing ${url} ---`);
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1'
        }
      });
      console.log('Status:', res.status, res.statusText);
      console.log('Location header:', res.headers.get('location'));
      console.log('Server header:', res.headers.get('server'));
      const text = await res.text();
      console.log('Body length:', text.length);
      console.log('Title match:', text.match(/<title>(.*?)<\/title>/i)?.[1] || 'No title');
    } catch (e) {
      console.error('Error:', e.message);
    }
  }
}

probe();
