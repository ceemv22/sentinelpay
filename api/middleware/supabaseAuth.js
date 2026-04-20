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

        // Check if user exists in our local Prisma DB
        let dbUser = await prisma.user.findUnique({
            where: { supabaseId: user.id }
        });

        if (!dbUser) {
            // First time this user makes an API call, sync them to our db
            dbUser = await prisma.user.create({
                data: {
                    supabaseId: user.id,
                    email: user.email,
                    credits: 5 // Default for verified accounts
                }
            });
            console.log(`[auth] Synced new user from Supabase: ${user.email}`);
        }

        req.user = dbUser;
        next();
    } catch (err) {
        console.error('[auth error]', err);
        res.status(500).json({ error: 'Authentication failed', code: 500 });
    }
}

module.exports = requireSupabaseAuth;
