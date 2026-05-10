const express = require('express');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));

// Category routes
app.get('/getting-started', (req, res) => {
    res.sendFile(path.join(__dirname, 'getting-started', 'index.html'));
});

app.get('/getting-started/:article', (req, res) => {
    const articlePath = path.join(__dirname, 'getting-started', req.params.article, 'index.html');
    res.sendFile(articlePath, (err) => {
        if (err) res.sendFile(path.join(__dirname, 'getting-started', 'index.html'));
    });
});

// Fallback to index
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Explicitly bind to 0.0.0.0 to ensure Railway proxy can reach it
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Help Center running on http://0.0.0.0:${PORT}`);
});
