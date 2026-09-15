const fs = require('fs');
const html = fs.readFileSync('main_site.html', 'utf8');

const selectMatches = Array.from(html.matchAll(/<select[^>]*id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/select>/gi));
selectMatches.forEach((s) => {
  console.log(`Select ID: ${s[1]}`);
  const options = Array.from(s[2].matchAll(/<option[^>]+value=["']([^"']+)["'][^>]*>(.*?)<\/option>/gi));
  options.forEach(o => console.log(`  value=${o[1]} text=${o[2].trim()}`));
});
