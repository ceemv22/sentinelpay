const fs = require('fs');
const content = fs.readFileSync('c:/Users/dzord/sentinelpay/api/public/dashboard.html', 'utf8');
const lines = content.split('\n');

let stack = [];

for (let i = 1090; i < 1400; i++) {
    const line = lines[i];
    if (!line) continue;
    
    // Find all tags
    const tags = line.match(/<div[^>]*>|<\/div>/g) || [];
    for (const tag of tags) {
        if (tag.startsWith('</')) {
            if (stack.length === 0) {
                console.log(`ERROR: Extra closing div at line ${i + 1}: ${line.trim()}`);
            } else {
                const last = stack.pop();
            }
        } else {
            stack.push({ tag: tag.substring(0, 50), line: i + 1 });
        }
    }
}

if (stack.length > 0) {
    console.log("UNCLOSED DIVS:");
    for (const s of stack) {
        console.log(`Line ${s.line}: ${s.tag}`);
    }
} else {
    console.log("All divs balanced in range.");
}
