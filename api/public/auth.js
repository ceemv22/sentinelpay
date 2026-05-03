// SentinelPay Auth Core (v17.5 - S-TIER STABILITY)
// Features: Centralized Turnstile Management, Atomic Submission Locks, ID-Safe Rendering

// 1. SUPABASE SUBSYSTEM
const supabaseUrl = 'https://aivqwkgjdpklxxuvkxpy.supabase.co';
const supabaseKey = 'sb_publishable_bRfAssaGT6D8oFDQtPARbw_5fyYGWM6';
let supabaseClient = null;

const getSupabase = () => {
    if (supabaseClient) return supabaseClient;
    if (window.supabase) {
        supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey, {
            auth: {
                flowType: 'pkce',
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true
            }
        });
        return supabaseClient;
    }
    return null;
};

// 2. CENTRALIZED TURNSTILE MANAGER
const turnstileState = {
    login: { widgetId: null, token: null, targetId: 'turnstile-login' },
    register: { widgetId: null, token: null, targetId: 'turnstile-register' },
    forgot: { widgetId: null, token: null, targetId: 'turnstile-forgot' }
};

window.getTurnstileToken = async (scope) => {
    const state = turnstileState[scope];
    if (!state) return null;

    if (state.token) {
        const t = state.token;
        // Do NOT clear here, let the submission logic clear it after use
        return t;
    }

    // If no token, we must (re)render or reset
    if (!window.turnstile) {
        console.error('[auth] turnstile library not loaded');
        return null;
    }

    if (state.widgetId === null) {
        console.log(`[auth] first render for ${scope}`);
        state.widgetId = window.turnstile.render(state.targetId, {
            sitekey: '0x4AAAAAADGpMozD1QOtWPkP',
            theme: 'dark',
            // NO 'action' parameter to maximize compatibility with Supabase default settings
            callback: (token) => {
                console.log(`[auth] turnstile solved for ${scope}`);
                state.token = token;
                // Auto-trigger the button that requested the captcha
                const btn = document.querySelector(`[data-captcha-trigger="${scope}"]`);
                if (btn) {
                    btn.disabled = false;
                    btn.click();
                }
            }
        });
    } else {
        console.log(`[auth] resetting widget for ${scope}`);
        state.token = null;
        window.turnstile.reset(state.widgetId);
    }

    return null; // Must wait for callback
};

window.consumeTurnstileToken = (scope) => {
    const t = turnstileState[scope].token;
    turnstileState[scope].token = null;
    if (window.turnstile && turnstileState[scope].widgetId !== null) {
        window.turnstile.reset(turnstileState[scope].widgetId);
    }
    return t;
};

// 3. GLOBAL UI HANDLERS
window.switchManual = (target) => {
    const panelLogin = document.getElementById('panel-login');
    const panelRegister = document.getElementById('panel-register');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');

    if (!panelLogin || !panelRegister) return;

    if (target === 'login') {
        panelRegister.style.display = 'none';
        panelLogin.style.display = 'block';
    } else {
        panelLogin.style.display = 'none';
        panelRegister.style.display = 'block';
    }

    if (tabLogin && tabRegister) {
        tabLogin.classList.toggle('active', target === 'login');
        tabRegister.classList.toggle('active', target === 'register');
    }
    sessionStorage.setItem('sentinel_auth_tab', target);
};

// 4. COOLDOWN SUBSYSTEM
let resendTimer = null;
let forgotResendTimer = null;

const startCooldown = (btnId, type, unlockKey, remainingSec) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    
    if (type === 'signup') clearInterval(resendTimer);
    else clearInterval(forgotResendTimer);

    btn.disabled = true;
    btn.style.opacity = '0.35';
    let timeLeft = remainingSec;
    btn.textContent = `available in ${timeLeft}s`;

    const tick = () => {
        timeLeft--;
        if (timeLeft <= 0) {
            if (type === 'signup') clearInterval(resendTimer);
            else clearInterval(forgotResendTimer);
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.textContent = 'resend email';
            localStorage.removeItem(unlockKey);
        } else {
            btn.textContent = `available in ${timeLeft}s`;
        }
    };

    if (type === 'signup') resendTimer = setInterval(tick, 1000);
    else forgotResendTimer = setInterval(tick, 1000);
};

window.handleResendHandshake = async (type = 'signup') => {
    const s = getSupabase();
    if (!s) return;
    
    const scope = type === 'signup' ? 'register' : 'forgot';
    const btnId = type === 'signup' ? 'resend-btn' : 'forgot-resend-btn';
    const emailKey = type === 'signup' ? 'sentinel_pending_email' : 'sentinel_forgot_email';
    const unlockKey = type === 'signup' ? 'sentinel_resend_unlock' : 'sentinel_forgot_resend_unlock';
    const email = sessionStorage.getItem(emailKey);
    const btn = document.getElementById(btnId);

    if (!email || (btn && btn.disabled)) return;

    const token = await window.getTurnstileToken(scope);
    if (!token) {
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'solve captcha...';
            btn.setAttribute('data-captcha-trigger', scope);
        }
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.textContent = 'sending...';
    }

    try {
        const captchaToken = window.consumeTurnstileToken(scope);
        const { error } = type === 'signup' 
            ? await s.auth.resend({ type: 'signup', email, options: { captchaToken, emailRedirectTo: window.location.origin + '/auth?verified=true' } })
            : await s.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset', captchaToken });

        if (error) {
            console.error('[auth] resend error:', error);
            if (btn) {
                btn.textContent = 'error: wait';
                setTimeout(() => { btn.disabled = false; btn.textContent = 'resend email'; }, 3000);
            }
        } else {
            if (btn) btn.textContent = 'sent!';
            const unlockTimestamp = Date.now() + 60000;
            localStorage.setItem(unlockKey, unlockTimestamp);
            setTimeout(() => startCooldown(btnId, type, unlockKey, 60), 1000);
        }
    } catch (err) { console.error('[auth] resend failed', err); }
};

// 5. CORE INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    console.log('[sentinel-auth] initializing v17.5...');
    
    const s = getSupabase();
    const scrubHash = () => {
        if (window.location.href.indexOf('#') > -1) {
            window.history.replaceState(null, document.title, window.location.href.split('#')[0]);
        }
    };

    if (s) {
        s.auth.onAuthStateChange((event, session) => {
            if (session) setTimeout(scrubHash, 1500);
        });
    }

    // Bindings
    const bind = (id, func) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', func);
    };

    bind('tab-login', () => window.switchManual('login'));
    bind('tab-register', () => window.switchManual('register'));
    bind('resend-btn', () => window.handleResendHandshake('signup'));
    bind('forgot-resend-btn', () => window.handleResendHandshake('forgot'));
    bind('verified-dashboard-btn', () => window.location.href = '/dashboard');

    // Register Form
    const regForm = document.getElementById('register-form');
    if (regForm) {
        let isSubmitting = false;
        regForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (isSubmitting) return;

            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;
            const btn = document.getElementById('register-submit-btn');
            const errorMsg = document.getElementById('register-error-msg');

            const token = await window.getTurnstileToken('register');
            if (!token) {
                btn.disabled = true;
                btn.textContent = 'solve captcha...';
                btn.setAttribute('data-captcha-trigger', 'register');
                return;
            }

            isSubmitting = true;
            btn.disabled = true;
            btn.textContent = 'processing...';
            errorMsg.style.display = 'none';

            const captchaToken = window.consumeTurnstileToken('register');
            const { data, error } = await s.auth.signUp({ email, password, options: { captchaToken } });
            
            const isExisting = !error && data?.user && data.user.identities?.length === 0;
            if (error || isExisting) {
                errorMsg.textContent = isExisting ? 'error: email already registered' : 'error: ' + error.message.toLowerCase();
                errorMsg.style.display = 'block';
                btn.disabled = false;
                btn.textContent = 'create account';
                isSubmitting = false;
            } else {
                sessionStorage.setItem('sentinel_pending_email', email);
                document.getElementById('auth-panel').style.display = 'none';
                document.getElementById('auth-success-state').style.display = 'flex';
                localStorage.setItem('sentinel_resend_unlock', Date.now() + 60000);
                startCooldown('resend-btn', 'signup', 'sentinel_resend_unlock', 60);
                isSubmitting = false;
            }
        });
    }

    // Login Form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        let isSubmitting = false;
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (isSubmitting) return;

            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const btn = document.getElementById('login-submit-btn');
            const errorMsg = document.getElementById('login-error-msg');

            const token = await window.getTurnstileToken('login');
            if (!token) {
                btn.disabled = true;
                btn.textContent = 'solve captcha...';
                btn.setAttribute('data-captcha-trigger', 'login');
                return;
            }

            isSubmitting = true;
            btn.disabled = true;
            btn.textContent = 'verifying...';
            errorMsg.style.display = 'none';

            const captchaToken = window.consumeTurnstileToken('login');
            const { error } = await s.auth.signInWithPassword({ email, password, options: { captchaToken } });
            
            if (error) {
                errorMsg.textContent = 'error: wrong credentials';
                errorMsg.style.display = 'block';
                btn.disabled = false;
                btn.textContent = 'login';
                isSubmitting = false;
            } else {
                window.location.href = '/dashboard';
            }
        });
    }

    // Forgot Password Modal & Form
    const trigger = document.getElementById('forgot-pw-trigger');
    const modal = document.getElementById('forgot-pw-modal');
    const closeBtn = document.getElementById('close-forgot-pw-btn');
    const forgotForm = document.getElementById('forgot-pw-form');

    if (trigger && modal && closeBtn) {
        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            window.consumeTurnstileToken('forgot');
            document.getElementById('forgot-pw-state-form').style.display = 'block';
            document.getElementById('forgot-pw-state-success').style.display = 'none';
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
        });

        const hideModal = () => {
            modal.classList.remove('active');
            window.consumeTurnstileToken('forgot');
            setTimeout(() => { modal.style.display = 'none'; }, 300);
        };

        closeBtn.addEventListener('click', hideModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) hideModal(); });

        if (forgotForm) {
            let isSubmitting = false;
            forgotForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (isSubmitting) return;

                const email = document.getElementById('forgot-pw-email').value;
                const btn = document.getElementById('forgot-pw-submit-btn');
                const errorMsg = document.getElementById('forgot-pw-error-msg');

                const token = await window.getTurnstileToken('forgot');
                if (!token) {
                    btn.disabled = true;
                    btn.textContent = 'solve captcha...';
                    btn.setAttribute('data-captcha-trigger', 'forgot');
                    return;
                }

                isSubmitting = true;
                btn.disabled = true;
                btn.textContent = 'sending...';
                errorMsg.style.display = 'none';

                const captchaToken = window.consumeTurnstileToken('forgot');
                const { error } = await s.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset', captchaToken });
                
                if (error) {
                    errorMsg.textContent = 'error: ' + error.message.toLowerCase();
                    errorMsg.style.display = 'block';
                    btn.disabled = false;
                    btn.textContent = 'send reset link';
                    isSubmitting = false;
                } else {
                    sessionStorage.setItem('sentinel_forgot_email', email);
                    document.getElementById('forgot-pw-state-form').style.display = 'none';
                    document.getElementById('forgot-pw-state-success').style.display = 'flex';
                    localStorage.setItem('sentinel_forgot_resend_unlock', Date.now() + 60000);
                    startCooldown('forgot-resend-btn', 'forgot', 'sentinel_forgot_resend_unlock', 60);
                    isSubmitting = false;
                }
            });
        }
    }

    // Password Eye Toggles
    document.querySelectorAll('.pw-eye-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = document.getElementById(btn.getAttribute('data-target'));
            const eyeOn = btn.querySelector('.eye-on');
            const eyeOff = btn.querySelector('.eye-off');
            if (input.type === 'password') {
                input.type = 'text';
                eyeOn.style.setProperty('display', 'block', 'important');
                eyeOff.style.setProperty('display', 'none', 'important');
            } else {
                input.type = 'password';
                eyeOn.style.setProperty('display', 'none', 'important');
                eyeOff.style.setProperty('display', 'block', 'important');
            }
        });
    });

    // Socials
    const redirectUrl = window.location.origin + '/dashboard';
    ['btn-google', 'btn-google-reg', 'btn-x', 'btn-x-reg'].forEach(id => {
        const b = document.getElementById(id);
        if (b) {
            b.addEventListener('click', async () => {
                b.disabled = true;
                b.textContent = 'connecting...';
                await s.auth.signInWithOAuth({ provider: id.includes('google') ? 'google' : 'twitter', options: { redirectTo: redirectUrl } });
            });
        }
    });

    // Password Rules Tooltip
    const rulesToggle = document.getElementById('pw-rules-toggle');
    const rulesTooltip = document.getElementById('pw-rules-tooltip');
    if (rulesToggle && rulesTooltip) {
        rulesToggle.addEventListener('mouseenter', () => rulesTooltip.classList.add('visible'));
        rulesToggle.addEventListener('mouseleave', () => rulesTooltip.classList.remove('visible'));
    }

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
});
