// SentinelPay Auth Core (v16.0 - SURGICAL STABILITY)
// Features: Closure-Safe Supabase, Atomic Resend, Restored Tab Logic

document.addEventListener('DOMContentLoaded', () => {
    console.log('[sentinel-auth] initializing stabilized logic v16.0...');

    // 1. SUPABASE CORE CONFIG
    const supabaseUrl = 'https://aivqwkgjdpklxxuvkxpy.supabase.co';
    const supabaseKey = 'sb_publishable_bRfAssaGT6D8oFDQtPARbw_5fyYGWM6';
    let supabase = null;

    // Helper to ensure supabase is always ready
    const getSupabase = () => {
        if (supabase) return supabase;
        if (window.supabase) {
            supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
            console.log('[auth] supabase client initialized.');
            return supabase;
        }
        console.error('[auth] supabase library not found in window.');
        return null;
    };

    // Initial check
    getSupabase();

    // 2. TAB SYSTEM (Restored & Stabilized)
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const panelLogin = document.getElementById('panel-login');
    const panelRegister = document.getElementById('panel-register');
    const authPanel = document.getElementById('auth-panel');
    const successState = document.getElementById('auth-success-state');
    const verifiedState = document.getElementById('auth-verified-state');

    let currentTab = 'login';
    let isTransitioning = false;

    window.switchManual = (target) => {
        if (isTransitioning || !panelLogin || !panelRegister) return;
        if (currentTab === target) return;
        
        isTransitioning = true;
        const outgoing = currentTab === 'login' ? panelLogin : panelRegister;
        const incoming = target === 'login' ? panelLogin : panelRegister;

        outgoing.style.display = 'none';
        outgoing.classList.remove('active');
        
        incoming.style.display = 'block';
        tabLogin.classList.toggle('active', target === 'login');
        tabRegister.classList.toggle('active', target === 'register');

        setTimeout(() => {
            incoming.classList.add('active');
            currentTab = target;
            isTransitioning = false;
            sessionStorage.setItem('sentinel_auth_tab', target);
        }, 10);
    };

    // 3. ENHANCED RESEND HANDSHAKE (The Fix)
    let resendTimer = null;
    const startResendCooldown = (remainingSec) => {
        const resendBtn = document.getElementById('resend-btn');
        if (!resendBtn) return;
        
        clearInterval(resendTimer);
        resendBtn.disabled = true;
        resendBtn.style.opacity = '0.35';
        resendBtn.style.cursor = 'not-allowed';
        
        let timeLeft = remainingSec;
        resendBtn.textContent = `available again in ${timeLeft}s`;

        resendTimer = setInterval(() => {
            timeLeft--;
            if (timeLeft <= 0) {
                clearInterval(resendTimer);
                resendBtn.disabled = false;
                resendBtn.style.opacity = '1';
                resendBtn.style.cursor = 'pointer';
                resendBtn.textContent = 'resend email';
                localStorage.removeItem('sentinel_resend_unlock');
            } else {
                resendBtn.textContent = `available again in ${timeLeft}s`;
            }
        }, 1000);
    };

    window.handleResend = async () => {
        console.log('[auth] resend handshake starting...');
        const s = getSupabase();
        const resendBtn = document.getElementById('resend-btn');
        const email = sessionStorage.getItem('sentinel_pending_email') || (document.getElementById('reg-email') ? document.getElementById('reg-email').value : null);

        if (!email) {
            console.error('[auth] resend failed: email session lost.');
            alert('Session expired. Please register again.');
            return;
        }

        if (!s) {
            console.error('[auth] resend failed: supabase client unavailable.');
            return;
        }

        if (resendBtn.disabled) return;

        resendBtn.disabled = true;
        resendBtn.textContent = 'dispatching...';

        try {
            const { error } = await s.auth.resend({
                type: 'signup',
                email: email,
                options: { emailRedirectTo: window.location.origin + '/auth?verified=true' }
            });

            if (error) {
                console.error('[auth] resend error:', error.message);
                resendBtn.textContent = 'error: security lock';
                setTimeout(() => {
                    resendBtn.disabled = false;
                    resendBtn.textContent = 'resend email';
                }, 3000);
            } else {
                console.log('[auth] resend successful.');
                resendBtn.textContent = 'email sent!';
                const unlockTimestamp = Date.now() + 60000;
                localStorage.setItem('sentinel_resend_unlock', unlockTimestamp);
                setTimeout(() => startResendCooldown(60), 1500);
            }
        } catch (err) {
            console.error('[auth] terminal error:', err);
            resendBtn.disabled = false;
            resendBtn.textContent = 'resend email';
        }
    };

    // 4. RESTORED STATE & FORMS
    const unlockAt = localStorage.getItem('sentinel_resend_unlock');
    if (unlockAt) {
        const remaining = Math.ceil((parseInt(unlockAt) - Date.now()) / 1000);
        if (remaining > 0) startResendCooldown(remaining);
        else localStorage.removeItem('sentinel_resend_unlock');
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('verified') === 'true') {
        if (authPanel) authPanel.style.display = 'none';
        if (verifiedState) verifiedState.style.display = 'flex';
    } else if (sessionStorage.getItem('sentinel_auth_tab') === 'register') {
        window.switchManual('register');
    }

    // Forms
    const regForm = document.getElementById('register-form');
    if (regForm) {
        regForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const s = getSupabase();
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;
            const btn = document.getElementById('register-submit-btn');
            const errorMsg = document.getElementById('register-error-msg');

            btn.disabled = true;
            btn.textContent = 'creating account...';
            errorMsg.style.display = 'none';

            const { error } = await s.auth.signUp({ email, password });
            if (error) {
                errorMsg.textContent = 'error: ' + error.message.toLowerCase();
                errorMsg.style.display = 'block';
                btn.disabled = false;
                btn.textContent = 'create account';
            } else {
                sessionStorage.setItem('sentinel_pending_email', email);
                successState.style.display = 'flex';
                if (authPanel) authPanel.style.display = 'none';
                const centerLogo = document.querySelector('.auth-center-logo');
                if (centerLogo) centerLogo.style.display = 'none';
                window.scrollTo({ top: 0, behavior: 'smooth' });
                const unlockTimestamp = Date.now() + 60000;
                localStorage.setItem('sentinel_resend_unlock', unlockTimestamp);
                startResendCooldown(60);
            }
        });
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const s = getSupabase();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const btn = document.getElementById('login-submit-btn');
            const errorMsg = document.getElementById('login-error-msg');

            btn.disabled = true;
            btn.textContent = 'verifying identity...';
            errorMsg.style.display = 'none';

            const { error } = await s.auth.signInWithPassword({ email, password });
            if (error) {
                let msg = error.message.toLowerCase();
                if (msg.includes('confirm')) msg = 'verify your identity first.';
                errorMsg.textContent = 'error: ' + msg;
                errorMsg.style.display = 'block';
                btn.disabled = false;
                btn.textContent = 'login';
            } else {
                window.location.href = '/dashboard';
            }
        });
    }

    // Toggles & Socials (Restored)
    document.querySelectorAll('.pw-eye-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = document.getElementById(btn.getAttribute('data-target'));
            const eyeOn = btn.querySelector('.eye-on');
            const eyeOff = btn.querySelector('.eye-off');
            if (input.type === 'password') {
                input.type = 'text';
                eyeOn.style.display = 'block';
                eyeOff.style.display = 'none';
            } else {
                input.type = 'password';
                eyeOn.style.display = 'none';
                eyeOff.style.display = 'block';
            }
        });
    });

    const redirectUrl = window.location.origin + '/dashboard';
    ['btn-google', 'btn-google-reg', 'btn-x', 'btn-x-reg'].forEach(id => {
        const b = document.getElementById(id);
        if (b) {
            b.addEventListener('click', async () => {
                const s = getSupabase();
                const provider = id.includes('google') ? 'google' : 'twitter';
                await s.auth.signInWithOAuth({ provider, options: { redirectTo: redirectUrl } });
            });
        }
    });

    // Password Rules
    const regPw = document.getElementById('reg-password');
    if (regPw) {
        regPw.addEventListener('input', (e) => {
            const val = e.target.value;
            const validate = (id, cond) => {
                const el = document.getElementById(id);
                if (el) {
                    el.classList.toggle('met', cond);
                    el.textContent = cond ? '✓' : '✕';
                    el.style.color = cond ? 'var(--color-green)' : 'var(--color-red)';
                }
            };
            validate('rule-len', val.length >= 8);
            validate('rule-upper', /[A-Z]/.test(val));
            validate('rule-num', /[0-9]/.test(val));
        });
    }

    console.log('[auth] stabilized logic v16.0 ready.');
});
