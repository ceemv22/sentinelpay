// Consolidated Auth Logic (v9.0)
// Features: Persistent Tab State, Clean URL, Sync'd Layouts, Fade Animations, Bulletproof Resend Cooldown

document.addEventListener('DOMContentLoaded', () => {
    console.log('[sentinel-auth] initializing logic v9.0...');

    // DOM Elements
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const panelLogin = document.getElementById('panel-login');
    const panelRegister = document.getElementById('panel-register');
    const authPanel = document.getElementById('auth-panel');
    const successState = document.getElementById('auth-success-state');
    const verifiedState = document.getElementById('auth-verified-state');

    if (!tabLogin || !tabRegister || !panelLogin || !panelRegister) {
        console.error('[sentinel-auth] critical elements missing');
        return;
    }

    // Supabase Init
    const supabaseUrl = 'https://aivqwkgjdpklxxuvkxpy.supabase.co';
    const supabaseKey = 'sb_publishable_bRfAssaGT6D8oFDQtPARbw_5fyYGWM6';
    let supabase = null;

    try {
        if (window.supabase) {
            supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
        }
    } catch(e) { console.warn('[auth] supabase init failed:', e); }

    let currentTab = 'login';
    let isTransitioning = false;

    // GLOBAL FALLBACK for Tab Switching
    window.switchManual = (target) => {
        if (isTransitioning) return;
        switchPanel(target);
    };

    function switchPanel(target, persist = true) {
        if (currentTab === target && persist) return;
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
            if (persist) sessionStorage.setItem('sentinel_auth_tab', target);
        }, 10);
    }

    // Attach Listeners
    tabLogin.addEventListener('click', () => switchPanel('login'));
    tabRegister.addEventListener('click', () => switchPanel('register'));

    // Handle Initial State
    const params = new URLSearchParams(window.location.search);
    const storedTab = sessionStorage.getItem('sentinel_auth_tab');
    
    if (params.get('verified') === 'true') {
        if (authPanel) authPanel.style.display = 'none';
        if (verifiedState) verifiedState.style.display = 'flex';
    } else if (params.get('tab') === 'register') {
        switchPanel('register', true);
    } else if (storedTab === 'register') {
        panelLogin.style.display = 'none';
        panelLogin.classList.remove('active');
        panelRegister.style.display = 'block';
        panelRegister.classList.add('active');
        tabLogin.classList.remove('active');
        tabRegister.classList.add('active');
        currentTab = 'register';
    }

    // Password Rules Live Validation
    const regPw = document.getElementById('reg-password');
    if (regPw) {
        const rules = {
            len: document.getElementById('rule-len'),
            upper: document.getElementById('rule-upper'),
            num: document.getElementById('rule-num')
        };
        regPw.addEventListener('input', (e) => {
            const val = e.target.value;
            const validate = (el, condition) => {
                if (el) {
                    el.classList.toggle('met', condition);
                    el.textContent = condition ? '✓' : '✕';
                    el.style.color = condition ? 'var(--color-green)' : 'var(--color-red)';
                }
            };
            validate(rules.len, val.length >= 8);
            validate(rules.upper, /[A-Z]/.test(val));
            validate(rules.num, /[0-9]/.test(val));
        });
    }

    // Password Eye Toggles
    document.querySelectorAll('.pw-eye-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
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

    // --- BULLETPROOF RESEND PROTECTION ---
    let resendTimer = null;
    const startResendCooldown = (remainingSec) => {
        const resendBtn = document.getElementById('resend-btn');
        const timerWrap = document.getElementById('resend-timer');
        const secondsEl = document.getElementById('cooldown-seconds');
        
        if (!resendBtn || !timerWrap || !secondsEl) return;

        clearInterval(resendTimer);
        resendBtn.disabled = true;
        resendBtn.style.opacity = '0.3';
        resendBtn.style.cursor = 'not-allowed';
        timerWrap.style.display = 'block';
        
        let timeLeft = remainingSec;
        secondsEl.textContent = timeLeft;

        resendTimer = setInterval(() => {
            timeLeft--;
            secondsEl.textContent = timeLeft;
            if (timeLeft <= 0) {
                clearInterval(resendTimer);
                resendBtn.disabled = false;
                resendBtn.style.opacity = '1';
                resendBtn.style.cursor = 'pointer';
                timerWrap.style.display = 'none';
                localStorage.removeItem('sentinel_resend_unlock');
            }
        }, 1000);
    };

    // Check for existing cooldown on load
    const unlockAt = localStorage.getItem('sentinel_resend_unlock');
    if (unlockAt) {
        const remaining = Math.ceil((parseInt(unlockAt) - Date.now()) / 1000);
        if (remaining > 0) startResendCooldown(remaining);
        else localStorage.removeItem('sentinel_resend_unlock');
    }

    window.handleResend = async () => {
        const email = document.getElementById('reg-email').value;
        const resendBtn = document.getElementById('resend-btn');
        if (!email || !supabase || resendBtn.disabled) return;

        resendBtn.disabled = true;
        resendBtn.textContent = 'sending...';

        const { error } = await supabase.auth.resend({
            type: 'signup',
            email: email,
            options: { emailRedirectTo: window.location.origin + '/auth?verified=true' }
        });

        if (error) {
            alert('Error: ' + error.message);
            resendBtn.disabled = false;
            resendBtn.textContent = 'resend email';
        } else {
            resendBtn.textContent = 'resend email';
            // Lock for 60 seconds
            const unlockTimestamp = Date.now() + 60000;
            localStorage.setItem('sentinel_resend_unlock', unlockTimestamp);
            startResendCooldown(60);
        }
    };

    // Sign In Logic
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!supabase) return alert('Auth unavailable');
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const btn = document.getElementById('login-submit-btn');
            const errorMsg = document.getElementById('login-error-msg');

            btn.disabled = true;
            btn.textContent = 'authenticating...';
            errorMsg.style.display = 'none';

            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                let msg = error.message.toLowerCase();
                if (msg.includes('confirm')) msg = 'please verify your email first.';
                errorMsg.textContent = 'error: ' + msg;
                errorMsg.style.display = 'block';
                btn.disabled = false;
                btn.textContent = 'login';
            } else {
                window.location.href = '/dashboard';
            }
        });
    }

    // Sign Up Logic
    const regForm = document.getElementById('register-form');
    if (regForm) {
        regForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!supabase) return alert('Auth unavailable');
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;
            const btn = document.getElementById('register-submit-btn');
            const errorMsg = document.getElementById('register-error-msg');

            btn.disabled = true;
            btn.textContent = 'creating account...';
            errorMsg.style.display = 'none';

            const { error } = await supabase.auth.signUp({ email, password });
            if (error) {
                errorMsg.textContent = 'error: ' + error.message.toLowerCase();
                errorMsg.style.display = 'block';
                btn.disabled = false;
                btn.textContent = 'create account';
            } else {
                successState.style.display = 'flex';
                if (authPanel) authPanel.style.display = 'none';
                const centerLogo = document.querySelector('.auth-center-logo');
                if (centerLogo) centerLogo.style.display = 'none';
                window.scrollTo({ top: 0, behavior: 'smooth' });
                
                // Initialize cooldown on first send too (to prevent instant spam)
                const unlockTimestamp = Date.now() + 60000;
                localStorage.setItem('sentinel_resend_unlock', unlockTimestamp);
                startResendCooldown(60);
            }
        });
    }

    // Socials
    const redirectUrl = window.location.origin + '/dashboard';
    ['btn-google', 'btn-google-reg', 'btn-x', 'btn-x-reg'].forEach(id => {
        const b = document.getElementById(id);
        if (b) {
            b.addEventListener('click', async () => {
                if (!supabase) return alert('Auth unavailable');
                const provider = id.includes('google') ? 'google' : 'twitter';
                await supabase.auth.signInWithOAuth({
                    provider,
                    options: { redirectTo: redirectUrl }
                });
            });
        }
    });

    console.log('[sentinel-auth] initialization complete.');
});
