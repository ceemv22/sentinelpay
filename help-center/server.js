const express = require('express');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));

// Fallback for single-page routing (if needed)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Explicitly bind to 0.0.0.0 to ensure Railway proxy can reach it
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Help Center running on http://0.0.0.0:${PORT}`);
});
