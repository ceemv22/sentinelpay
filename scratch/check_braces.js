const fs = require('fs');
const content = fs.readFileSync('api/index.js', 'utf8');
let open = 0;
const lines = content.split('\n');
lines.forEach((line, i) => {
    const opening = (line.match(/{/g) || []).length;
    const closing = (line.match(/}/g) || []).length;
    open += opening - closing;
    if (open < 0) console.log(`Line ${i + 1} has too many closing braces. Current balance: ${open}`);
});
console.log(`Final balance: ${open}`);
