const fs = require('fs');
const content = fs.readFileSync('api/index.js', 'utf8');
let open = 0;
const lines = content.split('\n');
lines.forEach((line, i) => {
    const opening = (line.match(/{/g) || []).length;
    const closing = (line.match(/}/g) || []).length;
    const prevOpen = open;
    open += opening - closing;
    if (open !== prevOpen) {
        // console.log(`Line ${i + 1}: ${open}`);
    }
});
console.log(`Final balance: ${open}`);

// Let's find the function that isn't closed.
// We'll track the names of open functions if possible.
let stack = [];
lines.forEach((line, i) => {
    if (line.includes('{')) {
        stack.push(i + 1);
    }
    if (line.includes('}')) {
        stack.pop();
    }
});
console.log('Unclosed braces started at lines:', stack);
