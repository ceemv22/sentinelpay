const { createClient } = require('@supabase/supabase-js');
const prisma = require('../services/db');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

async function requireSupabaseAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid token', code: 401 });
    }

    const token = authHeader.split(' ')[1];

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid or expired token', code: 401 });
        }

        // OAuth providers (google, twitter) are always considered verified
        const isOAuth = user.app_metadata?.provider && user.app_metadata.provider !== 'email';
        const isVerified = isOAuth || Boolean(user.email_confirmed_at || user.confirmed_at || user.phone_confirmed_at);
        if (!isVerified) {
            return res.status(403).json({ error: 'Account verification required', code: 403 });
        }

        // Twitter/X OAuth may not provide an email — generate a stable fallback
        const userEmail = user.email || `${user.id}@oauth.sentinelpay.org`;

        // Atomic S-Tier Sync: Use upsert to handle race conditions during first-time sync
        const dbUser = await prisma.user.upsert({
            where: { supabaseId: user.id },
            update: { email: userEmail }, // Keep email in sync
            create: {
                supabaseId: user.id,
                email: userEmail,
                credits: 5 // Default for verified accounts
            }
        });

        if (!dbUser) {
             throw new Error('failed to synchronize user data');
        }

        req.user = dbUser;
        next();
    } catch (err) {
        console.error('[auth error]', err);
        res.status(500).json({ error: 'Authentication failed', code: 500 });
    }
}

module.exports = requireSupabaseAuth;
