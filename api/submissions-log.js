'use strict';

// An append-only record of everything the forms receive. Mail can bounce, a
// provider can be down, and an inbox can be missed; the log is the copy that
// survives all three, so a lead is never lost silently.

const fs = require('fs');
const path = require('path');
const os = require('os');

// Railway's filesystem is ephemeral: a redeploy wipes it. Point LOG_DIR at a
// mounted volume to keep the history across deploys. Without one the file still
// works, it just resets on deploy, which is why every entry is also written to
// stdout where the platform's own log retention picks it up.
const LOG_DIR = process.env.LOG_DIR || path.join(os.tmpdir(), 'sentinelpay-logs');

let ready = false;
function ensureDir() {
    if (ready) return true;
    try {
        fs.mkdirSync(LOG_DIR, { recursive: true });
        ready = true;
    } catch (err) {
        console.error('[submissions] cannot create ' + LOG_DIR + ': ' + err.message);
    }
    return ready;
}

// one file per month, so it stays greppable by hand and never grows unbounded
function currentFile(when) {
    const stamp = when.toISOString().slice(0, 7);
    return path.join(LOG_DIR, 'submissions-' + stamp + '.jsonl');
}

// Writing is deliberately synchronous and best effort. It runs once per form
// submission, so the cost is irrelevant, and a logging failure must never take
// down the request it is describing.
function record(kind, req, fields, outcome) {
    const when = new Date();
    const entry = Object.assign({
        ts: when.toISOString(),
        kind: kind,
        outcome: outcome,
        ip: req && req.realIp ? req.realIp : null,
        country: req && req.headers ? (req.headers['cf-ipcountry'] || null) : null,
        ua: req && req.headers ? String(req.headers['user-agent'] || '').slice(0, 200) : null,
    }, fields);

    // stdout first: this is the copy that survives a wiped filesystem
    console.log('[submission] ' + JSON.stringify(entry));

    if (!ensureDir()) return;
    try {
        fs.appendFileSync(currentFile(when), JSON.stringify(entry) + '\n');
    } catch (err) {
        console.error('[submissions] write failed: ' + err.message);
    }
}

// Newest first, across however many monthly files it takes to fill the limit.
function recent(limit) {
    const max = Math.min(Math.max(Number(limit) || 50, 1), 500);
    if (!ensureDir()) return [];
    let files;
    try {
        files = fs.readdirSync(LOG_DIR).filter((f) => /^submissions-\d{4}-\d{2}\.jsonl$/.test(f)).sort().reverse();
    } catch (err) {
        return [];
    }
    const out = [];
    for (const file of files) {
        let lines;
        try {
            lines = fs.readFileSync(path.join(LOG_DIR, file), 'utf8').split('\n').filter(Boolean);
        } catch (err) {
            continue;
        }
        for (let i = lines.length - 1; i >= 0 && out.length < max; i--) {
            try { out.push(JSON.parse(lines[i])); } catch (err) { /* skip a torn line */ }
        }
        if (out.length >= max) break;
    }
    return out;
}

module.exports = { record, recent, LOG_DIR };
