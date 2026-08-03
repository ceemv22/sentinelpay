'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

// One place for outbound mail. Everything the site sends goes through here so the
// sender, the styling and the failure behaviour stay identical across endpoints.

const MAIL_FROM = process.env.MAIL_FROM || 'sentinelpay <noreply@sentinelpay.org>';
const MAIL_TO = process.env.MAIL_TO || 'support@sentinelpay.org';
const SITE = 'https://sentinelpay.org';

function isConfigured() {
    return Boolean(process.env.RESEND_API_KEY);
}

function esc(s) {
    return String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
}

// Email clients strip <style> blocks, ignore custom properties and mostly ignore
// flexbox, so the site's look is rebuilt here with tables and inline styles only.
// The palette is the site's: near-black panel, cyan-to-purple accent, lowercase.
const C = {
    page: '#050505',
    card: '#0b0e13',
    line: 'rgba(255,255,255,0.09)',
    text: '#f2f5f8',
    muted: '#8b93a1',
    cyan: '#00f0ff',
    purple: '#a020f0',
};

function row(label, value) {
    if (!value) return '';
    return '<tr>' +
        '<td width="1%" style="padding:11px 18px 11px 0;vertical-align:top;font-size:12px;line-height:18px;color:' + C.muted + ';white-space:nowrap;border-bottom:1px solid ' + C.line + ';">' + esc(label) + '</td>' +
        '<td style="padding:11px 0;vertical-align:top;font-size:14px;line-height:20px;color:' + C.text + ';border-bottom:1px solid ' + C.line + ';">' + esc(value) + '</td>' +
        '</tr>';
}

// Builds the full document. `rows` is already-escaped markup from row().
function layout({ eyebrow, title, intro, rows, footnote }) {
    const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,Helvetica,Arial,sans-serif";
    return '<!doctype html><html><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">' +
        '</head>' +
        '<body style="margin:0;padding:0;background:' + C.page + ';">' +
        // preheader: what the inbox list shows, kept out of the visible body
        '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">' + esc(intro) + '</div>' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:' + C.page + ';padding:32px 16px;">' +
        '<tr><td align="center">' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:' + C.card + ';border:1px solid ' + C.line + ';border-radius:16px;overflow:hidden;font-family:' + font + ';">' +

        // the gradient hairline the site uses on top of its cards
        '<tr><td style="height:3px;line-height:3px;font-size:0;background:' + C.cyan + ';background-image:linear-gradient(90deg,' + C.cyan + ' 0%,' + C.purple + ' 100%);">&nbsp;</td></tr>' +

        '<tr><td style="padding:28px 28px 0;">' +
        '<a href="' + SITE + '" style="text-decoration:none;color:' + C.text + ';font-size:16px;font-weight:700;letter-spacing:-0.01em;">sentinelpay</a>' +
        '</td></tr>' +

        '<tr><td style="padding:22px 28px 0;">' +
        '<div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:' + C.cyan + ';">' + esc(eyebrow) + '</div>' +
        '<div style="margin-top:8px;font-size:22px;line-height:30px;font-weight:700;color:' + C.text + ';">' + esc(title) + '</div>' +
        '<div style="margin-top:8px;font-size:14px;line-height:21px;color:' + C.muted + ';">' + esc(intro) + '</div>' +
        '</td></tr>' +

        '<tr><td style="padding:20px 28px 4px;">' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' + rows + '</table>' +
        '</td></tr>' +

        (footnote ? '<tr><td style="padding:18px 28px 0;">' +
            '<div style="padding:12px 14px;border:1px solid ' + C.line + ';border-radius:10px;font-size:12px;line-height:18px;color:' + C.muted + ';">' + esc(footnote) + '</div>' +
            '</td></tr>' : '') +

        '<tr><td style="padding:22px 28px 26px;">' +
        '<div style="border-top:1px solid ' + C.line + ';padding-top:14px;font-size:11px;line-height:17px;color:' + C.muted + ';">' +
        'sent automatically by sentinelpay.org. reply to this email to answer the sender directly.' +
        '</div></td></tr>' +

        '</table></td></tr></table></body></html>';
}

// Plain-text alternative. Without it, spam filters mark an html-only mail down and
// some clients render nothing at all.
function textVersion({ title, intro, pairs, footnote }) {
    const lines = [title, '', intro, ''];
    pairs.forEach(([k, v]) => { if (v) lines.push(k + ': ' + v); });
    if (footnote) lines.push('', footnote);
    lines.push('', 'sent automatically by sentinelpay.org');
    return lines.join('\n');
}

// Sends, or throws. It never resolves quietly when nothing was sent: an endpoint
// that answers "ok" while the inbox stays empty is the worst possible outcome.
async function send({ subject, replyTo, eyebrow, title, intro, pairs, footnote }) {
    const rows = pairs.map(([k, v]) => row(k, v)).join('');
    const html = layout({ eyebrow, title, intro, rows, footnote });
    const text = textVersion({ title, intro, pairs, footnote });

    if (!isConfigured()) {
        // in production a missing key is a hard failure: the form must not claim
        // success. locally there is no key by design, so write a preview instead.
        if (process.env.NODE_ENV === 'production') {
            const err = new Error('RESEND_API_KEY is not set, so no mail was sent');
            err.code = 'MAIL_NOT_CONFIGURED';
            throw err;
        }
        const file = path.join(os.tmpdir(), 'sentinelpay-mail-' + Date.now() + '.html');
        fs.writeFileSync(file, html);
        console.log('[mail preview] ' + subject + ' -> ' + file);
        return { preview: file };
    }

    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
        from: MAIL_FROM,
        to: MAIL_TO,
        replyTo: replyTo,
        subject: subject,
        html: html,
        text: text,
    });

    // the sdk reports api errors in the payload rather than by rejecting
    if (result && result.error) {
        const err = new Error(result.error.message || 'resend rejected the message');
        err.code = 'MAIL_REJECTED';
        throw err;
    }
    return result;
}

module.exports = { send, isConfigured, MAIL_FROM, MAIL_TO };
