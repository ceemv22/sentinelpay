const express = require('express');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;

// help.sentinelpay.org is intentionally empty — serve a blank page for every path.
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Help Center running on http://0.0.0.0:${PORT}`);
});
