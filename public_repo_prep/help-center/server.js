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

app.get('/api-integration', (req, res) => {
    res.sendFile(path.join(__dirname, 'api-integration', 'index.html'));
});

app.get('/risk-engine', (req, res) => {
    res.sendFile(path.join(__dirname, 'risk-engine', 'index.html'));
});

app.get('/account-billing', (req, res) => {
    res.sendFile(path.join(__dirname, 'account-billing', 'index.html'));
});

app.get('/:category/:article', (req, res) => {
    const category = req.params.category;
    const article = req.params.article;
    const articlePath = path.join(__dirname, category, article, 'index.html');
    res.sendFile(articlePath, (err) => {
        if (err) res.sendFile(path.join(__dirname, category, 'index.html'), (err2) => {
            if (err2) res.sendFile(path.join(__dirname, 'index.html'));
        });
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
