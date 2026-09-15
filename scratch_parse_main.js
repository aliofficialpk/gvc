const fs = require('fs');

const html = fs.readFileSync('main_site.html', 'utf8');

// Find all hrefs containing .gvcworld.eu or country codes
const hrefs = Array.from(html.matchAll(/href=["']([^"']+)["']/gi)).map(m => m[1]);
console.log('Unique domains / URLs found:');
const uniqueHrefs = Array.from(new Set(hrefs));
console.log(uniqueHrefs.filter(h => h.includes('gvcworld') || h.includes('login') || h.includes('services') || h.includes('pk')));

// Find select options (country dropdown)
const selectMatches = Array.from(html.matchAll(/<select[^>]*>([\s\S]*?)<\/select>/gi));
selectMatches.forEach((s, idx) => {
  console.log(`Select ${idx}:`, s[1].substring(0, 300));
});
