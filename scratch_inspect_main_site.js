const fs = require('fs');

async function inspectMainSite() {
  try {
    const res = await fetch('https://www.gvcworld.eu/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      }
    });

    const html = await res.text();
    fs.writeFileSync('main_site.html', html);

    // Extract links related to Pakistan, booking, login, services
    const linkMatches = Array.from(html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi));
    const links = linkMatches.map(m => ({ href: m[1], text: m[2].replace(/<[^>]+>/g, '').trim() }));

    const pakLinks = links.filter(l => l.href.toLowerCase().includes('pk') || l.text.toLowerCase().includes('pakistan') || l.href.toLowerCase().includes('book') || l.href.toLowerCase().includes('appointment'));

    console.log('Found Pakistan/Appointment related links on main site:');
    console.log(JSON.stringify(pakLinks, null, 2));

  } catch (err) {
    console.error('Error fetching main site:', err);
  }
}

inspectMainSite();
