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

        // Detect Provider, Username, and Verification status
        const authProvider = user.app_metadata?.provider || 'email';
        const username = user.user_metadata?.user_name || user.user_metadata?.full_name || null;
        const isOAuth = authProvider !== 'email';
        const isEmailVerified = Boolean(user.email_confirmed_at || user.confirmed_at || user.phone_confirmed_at) || isOAuth;

        if (!isEmailVerified) {
            return res.status(403).json({ error: 'Account verification required', code: 403 });
        }

        // Handle Email (X/Twitter might not provide one)
        // We still provide a fallback for DB consistency if needed, but we mark it as unverified internally if it's the fallback
        const userEmail = user.email || null;

        // Atomic S-Tier Sync: Use upsert to handle race conditions during first-time sync
        const dbUser = await prisma.user.upsert({
            where: { supabaseId: user.id },
            update: { 
                email: userEmail,
                username: username, // Update username if it changed on social profile
                authProvider,
                isEmailVerified
            },
            create: {
                supabaseId: user.id,
                email: userEmail,
                username: username,
                authProvider,
                isEmailVerified,
                credits: 5 
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
