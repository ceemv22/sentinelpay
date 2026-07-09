const { createClient } = require('@supabase/supabase-js');
const prisma = require('../services/db');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { encrypt } = require('../services/crypto');
require('dotenv').config();

// Endpoints an MFA-enabled user must be able to reach with only an aal1
// (password) session: the login-time factor reconcile, and the locked-out
// recovery-seed path (which itself validates the seed before disabling MFA).
const AAL1_ALLOWED_PATHS = new Set([
    '/v1/user/mfa/reconcile',
    '/v1/user/mfa/recovery-codes/recover',
]);

function tokenAal(token) {
    try {
        const payload = jwt.decode(token);
        return (payload && payload.aal) ? payload.aal : 'aal1';
    } catch (e) {
        return 'aal1';
    }
}

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const generateApiKey = () => `sp_live_${crypto.randomBytes(24).toString('hex')}`;
const VALID_USERNAME_RE = /^[a-zA-Z0-9]+$/;
const sanitizeUsername = (u) => (u && VALID_USERNAME_RE.test(u)) ? u : null;

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
        const oauthUsername = sanitizeUsername(user.user_metadata?.user_name)
            || sanitizeUsername(user.user_metadata?.preferred_username)
            || null;
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
            if (dbUser.supabaseId && dbUser.supabaseId !== user.id) {
                console.error(`[sentinel-auth] identity conflict: email ${userEmail} bound to different supabase id`);
                return res.status(403).json({ error: 'Account conflict detected', code: 403 });
            }
            dbUser = await prisma.user.update({
                where: { id: dbUser.id },
                data: {
                    supabaseId: user.id,
                    username: sanitizeUsername(dbUser.username) || oauthUsername,
                    authProvider,
                    isEmailVerified
                }
            });
        } else {
            const rawKeyInitial = generateApiKey();
            const keyHashInitial = crypto.createHash('sha256').update(rawKeyInitial).digest('hex');

            const buildCreate = (uname) => ({
                supabaseId: user.id,
                email: userEmail,
                username: uname,
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
            });

            try {
                dbUser = await prisma.user.upsert({
                    where: { supabaseId: user.id },
                    update: { email: userEmail, authProvider, isEmailVerified },
                    create: buildCreate(oauthUsername)
                });
            } catch (syncErr) {
                if (syncErr && syncErr.code === 'P2002') {
                    dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } });
                    if (!dbUser) {
                        dbUser = await prisma.user.create({ data: buildCreate(null) });
                    }
                } else {
                    throw syncErr;
                }
            }
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
        req.accessToken = token;
        req.hasMfa = Array.isArray(user.factors) && user.factors.some(f => f && f.status === 'verified');

        // Strict MFA gate: when the account has MFA, an aal1 (password-only)
        // session cannot reach ANY authenticated endpoint except the allowlisted
        // login-recovery paths. Sensitive actions still keep their own aal2
        // checks; this closes password-only viewing of account data.
        const accountHasMfa = dbUser.mfaEnabled === true || req.hasMfa === true;
        if (accountHasMfa && !AAL1_ALLOWED_PATHS.has(req.path) && tokenAal(token) !== 'aal2') {
            return res.status(403).json({ error: 'mfa verification required', code: 'mfa_required' });
        }
        next();
    } catch (error) {
        console.error('[sentinel-auth-middleware] critical error:', error.code || '', error.message, error.meta || '');
        return res.status(500).json({ error: 'authentication_sync_failed', code: 500 });
    }
}

module.exports = requireSupabaseAuth;
