const { createClient } = require('@supabase/supabase-js');
const prisma = require('../services/db');
const crypto = require('crypto');
const { encrypt } = require('../services/crypto');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const generateApiKey = () => `sp_live_${crypto.randomBytes(24).toString('hex')}`;

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

        const authProvider = user.app_metadata?.provider || 'email';
        const username = user.user_metadata?.user_name || user.user_metadata?.full_name || null;
        const isOAuth = authProvider !== 'email';
        const isEmailVerified = Boolean(user.email_confirmed_at || user.confirmed_at || user.phone_confirmed_at) || isOAuth;

        if (!isEmailVerified) {
            return res.status(403).json({ error: 'Account verification required', code: 403 });
        }

        const userEmail = user.email || null;

        let dbUser = null;
        if (userEmail) {
            dbUser = await prisma.user.findUnique({ where: { email: userEmail } });
        }

        if (dbUser) {
            // Prevent account hijacking: reject if a different Supabase ID is trying to claim this email
            if (dbUser.supabaseId && dbUser.supabaseId !== user.id) {
                console.error(`[sentinel-auth] identity conflict: email ${userEmail} bound to different supabase id`);
                return res.status(403).json({ error: 'Account conflict detected', code: 403 });
            }
            dbUser = await prisma.user.update({
                where: { id: dbUser.id },
                data: {
                    supabaseId: user.id,
                    username,
                    authProvider,
                    isEmailVerified
                }
            });
        } else {
            const rawKeyInitial = generateApiKey();
            const keyHashInitial = crypto.createHash('sha256').update(rawKeyInitial).digest('hex');

            dbUser = await prisma.user.upsert({
                where: { supabaseId: user.id },
                update: {
                    email: userEmail,
                    username,
                    authProvider,
                    isEmailVerified
                },
                create: {
                    supabaseId: user.id,
                    email: userEmail,
                    username,
                    authProvider,
                    isEmailVerified,
                    credits: 10,
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
        }

        if (!dbUser) {
            throw new Error('failed to synchronize user data');
        }

        const existingKey = await prisma.apiKey.findFirst({
            where: { userId: dbUser.id, active: true }
        });

        if (!existingKey) {
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
    } catch (error) {
        console.error('[sentinel-auth-middleware] critical error:', error.message);
        return res.status(500).json({ error: 'authentication_sync_failed', code: 500 });
    }
}

module.exports = requireSupabaseAuth;
