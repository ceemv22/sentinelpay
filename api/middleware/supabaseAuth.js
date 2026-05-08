const { createClient } = require('@supabase/supabase-js');
const prisma = require('../services/db');
const crypto = require('crypto');
const { encrypt } = require('../services/crypto');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// S-Tier API Key Generator
const generateApiKey = () => {
    return `sp_live_${crypto.randomBytes(24).toString('hex')}`;
};

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
        const rawKeyInitial = generateApiKey();
        const keyHashInitial = crypto.createHash('sha256').update(rawKeyInitial).digest('hex');

        const dbUser = await prisma.user.upsert({
            where: { supabaseId: user.id },
            update: { 
                email: userEmail,
                username: username,
                authProvider,
                isEmailVerified
            },
            create: {
                supabaseId: user.id,
                email: userEmail,
                username: username,
                authProvider,
                isEmailVerified,
                credits: 5,
                apiKeys: {
                    create: {
                        keyHash: keyHashInitial,
                        rawKey: encrypt(rawKeyInitial),
                        plan: 'starter',
                        active: true
                    }
                }
            }
        });

        if (!dbUser) {
             throw new Error('failed to synchronize user data');
        }

        // S-Tier Auto-Heal: Ensure user has at least one API Key
        const existingKey = await prisma.apiKey.findFirst({
            where: { userId: dbUser.id, active: true }
        });

        if (!existingKey) {
            console.log(`[auth] auto-generating missing API key for user: ${dbUser.id}`);
            const rawKeyHeal = generateApiKey();
            const keyHashHeal = crypto.createHash('sha256').update(rawKeyHeal).digest('hex');
            
            await prisma.apiKey.create({
                data: {
                    userId: dbUser.id,
                    keyHash: keyHashHeal,
                    rawKey: encrypt(rawKeyHeal),
                    plan: 'starter',
                    active: true
                }
            });
        }

        req.user = dbUser;
        next();
    } catch (err) {
        console.error('[auth error]', err);
        res.status(500).json({ error: 'Authentication failed', code: 500 });
    }
}

module.exports = requireSupabaseAuth;
