const fs = require('fs');
const content = fs.readFileSync('c:/Users/dzord/sentinelpay/api/public/dashboard.html', 'utf8');
const lines = content.split('\n');

let openDivs = 0;
let closeDivs = 0;

for (let i = 1090; i < 1330; i++) {
    const line = lines[i];
    if (!line) continue;
    const opens = (line.match(/<div/g) || []).length;
    const closes = (line.match(/<\/div>/g) || []).length;
    openDivs += opens;
    closeDivs += closes;
    console.log(`${i + 1}: ${opens} | ${closes} | Total: ${openDivs - closeDivs} | ${line.trim().substring(0, 50)}`);
}

console.log(`Final Open: ${openDivs}, Final Close: ${closeDivs}, Diff: ${openDivs - closeDivs}`);
