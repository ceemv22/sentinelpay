const express = require('express');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;

// Intentionally-empty subdomains (help.sentinelpay.org, blog.sentinelpay.org, …):
// serve a blank page for every host and path until real content is built.
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`empty-subdomain server running on http://0.0.0.0:${PORT}`);
});
