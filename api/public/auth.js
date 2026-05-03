// SentinelPay Auth Core (v17.7 - S-TIER STABILITY)
// Features: Exception-Safe Handlers, Centralized Turnstile, Robust State Management

// 1. SUPABASE SUBSYSTEM
const supabaseUrl = 'https://aivqwkgjdpklxxuvkxpy.supabase.co';
const supabaseKey = 'sb_publishable_bRfAssaGT6D8oFDQtPARbw_5fyYGWM6';
let supabaseClient = null;

const getSupabase = () => {
    try {
        if (supabaseClient) return supabaseClient;
        if (window.supabase) {
            supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey, {
                auth: { flowType: 'pkce', autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
            });
            return supabaseClient;
        }
    } catch (e) { console.error('[auth] supabase init failed', e); }
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

    if (state.token) return state.token;

    if (!window.turnstile) {
        console.error('[auth] turnstile missing');
        return null;
    }

    if (state.widgetId === null) {
        state.widgetId = window.turnstile.render(state.targetId, {
            sitekey: '0x4AAAAAADGpMozD1QOtWPkP',
            theme: 'dark',
            callback: (token) => {
                state.token = token;
                const btn = document.querySelector(`[data-captcha-trigger="${scope}"]`);
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'solved! click again';
                    setTimeout(() => { if (btn.textContent.includes('solved')) btn.textContent = 'send reset link'; }, 2000);
                }
            }
        });
    } else {
        state.token = null;
        setTimeout(() => {
            try { window.turnstile.reset(state.widgetId); } catch(e){}
        }, 250);
    }
    return null;
};

window.consumeTurnstileToken = (scope) => {
    const t = turnstileState[scope].token;
    turnstileState[scope].token = null;
    if (window.turnstile && turnstileState[scope].widgetId !== null) {
        try { window.turnstile.reset(turnstileState[scope].widgetId); } catch(e){}
    }
    // Clear trigger attribute
    document.querySelectorAll(`[data-captcha-trigger="${scope}"]`).forEach(el => el.removeAttribute('data-captcha-trigger'));
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
        panelRegister.classList.remove('active');
        panelLogin.style.display = 'block';
        setTimeout(() => panelLogin.classList.add('active'), 10);
    } else {
        panelLogin.style.display = 'none';
        panelLogin.classList.remove('active');
        panelRegister.style.display = 'block';
        setTimeout(() => panelRegister.classList.add('active'), 10);
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

    try {
        btn.disabled = true;
        btn.textContent = 'sending...';
        const captchaToken = window.consumeTurnstileToken(scope);
        const { error } = type === 'signup' 
            ? await s.auth.resend({ type: 'signup', email, options: { captchaToken, emailRedirectTo: window.location.origin + '/auth?verified=true' } })
            : await s.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset', captchaToken });

        if (error) {
            btn.textContent = 'error: wait';
            setTimeout(() => { btn.disabled = false; btn.textContent = 'resend email'; }, 3000);
        } else {
            btn.textContent = 'sent!';
            localStorage.setItem(unlockKey, Date.now() + 60000);
            startCooldown(btnId, type, unlockKey, 60);
        }
    } catch (err) { 
        console.error(err); 
        btn.disabled = false;
        btn.textContent = 'resend email';
    }
};

// 5. CORE INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    console.log('[sentinel-auth] initializing v17.7...');
    
    const scrubHash = () => {
        if (window.location.href.indexOf('#') > -1) {
            window.history.replaceState(null, document.title, window.location.href.split('#')[0]);
        }
    };

    const s = getSupabase();
    if (s) {
        s.auth.onAuthStateChange((event, session) => {
            if (session) setTimeout(scrubHash, 1500);
        });
    }

    // Bindings
    const bind = (id, func) => {
        const el = document.getElementById(id);
        if (el) el.onclick = func;
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
        regForm.onsubmit = async (e) => {
            e.preventDefault();
            if (isSubmitting) return;

            const s = getSupabase();
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

            try {
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
                } else {
                    sessionStorage.setItem('sentinel_pending_email', email);
                    document.getElementById('auth-panel').style.display = 'none';
                    document.getElementById('auth-success-state').style.display = 'flex';
                    localStorage.setItem('sentinel_resend_unlock', Date.now() + 60000);
                    startCooldown('resend-btn', 'signup', 'sentinel_resend_unlock', 60);
                }
            } catch (err) { console.error(err); btn.disabled = false; }
            finally { isSubmitting = false; }
        };
    }

    // Login Form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        let isSubmitting = false;
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            if (isSubmitting) return;

            const s = getSupabase();
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

            try {
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
                } else {
                    window.location.href = '/dashboard';
                }
            } catch (err) { console.error(err); btn.disabled = false; }
            finally { isSubmitting = false; }
        };
    }

    // Forgot Password
    const trigger = document.getElementById('forgot-pw-trigger');
    const modal = document.getElementById('forgot-pw-modal');
    const closeBtn = document.getElementById('close-forgot-pw-btn');
    const forgotForm = document.getElementById('forgot-pw-form');

    if (trigger && modal && closeBtn) {
        trigger.onclick = (e) => {
            e.preventDefault();
            window.consumeTurnstileToken('forgot');
            document.getElementById('forgot-pw-state-form').style.display = 'block';
            document.getElementById('forgot-pw-state-success').style.display = 'none';
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
        };

        const hideModal = () => {
            modal.classList.remove('active');
            window.consumeTurnstileToken('forgot');
            setTimeout(() => { modal.style.display = 'none'; }, 300);
        };

        closeBtn.onclick = hideModal;
        modal.onclick = (e) => { if (e.target === modal) hideModal(); };

        if (forgotForm) {
            let isSubmitting = false;
            forgotForm.onsubmit = async (e) => {
                e.preventDefault();
                if (isSubmitting) return;

                const s = getSupabase();
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

                try {
                    isSubmitting = true;
                    btn.disabled = true;
                    btn.textContent = 'sending...';
                    errorMsg.style.display = 'none';

                    const captchaToken = window.consumeTurnstileToken('forgot');
                    const { error } = await s.auth.resetPasswordForEmail(email, { 
                        redirectTo: window.location.origin + '/reset', 
                        captchaToken: captchaToken 
                    });
                    
                    if (error) {
                        errorMsg.textContent = 'error: ' + error.message.toLowerCase();
                        errorMsg.style.display = 'block';
                        btn.disabled = false;
                        btn.textContent = 'send reset link';
                    } else {
                        sessionStorage.setItem('sentinel_forgot_email', email);
                        document.getElementById('forgot-pw-state-form').style.display = 'none';
                        document.getElementById('forgot-pw-state-success').style.display = 'flex';
                        localStorage.setItem('sentinel_forgot_resend_unlock', Date.now() + 60000);
                        startCooldown('forgot-resend-btn', 'forgot', 'sentinel_forgot_resend_unlock', 60);
                    }
                } catch (err) { console.error(err); btn.disabled = false; }
                finally { isSubmitting = false; }
            };
        }
    }

    // Eye Toggles
    document.querySelectorAll('.pw-eye-toggle').forEach(btn => {
        btn.onclick = () => {
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
        };
    });

    // Socials
    const redirectUrl = window.location.origin + '/dashboard';
    ['btn-google', 'btn-google-reg', 'btn-x', 'btn-x-reg'].forEach(id => {
        const b = document.getElementById(id);
        if (b) {
            b.onclick = async () => {
                const s = getSupabase();
                b.disabled = true;
                b.textContent = 'connecting...';
                await s.auth.signInWithOAuth({ provider: id.includes('google') ? 'google' : 'twitter', options: { redirectTo: redirectUrl } });
            };
        }
    });

    // Tooltip
    const rulesToggle = document.getElementById('pw-rules-toggle');
    const rulesTooltip = document.getElementById('pw-rules-tooltip');
    if (rulesToggle && rulesTooltip) {
        rulesToggle.onmouseenter = () => rulesTooltip.classList.add('visible');
        rulesToggle.onmouseleave = () => rulesTooltip.classList.remove('visible');
    }

    const regPw = document.getElementById('reg-password');
    if (regPw) {
        regPw.oninput = (e) => {
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
        };
    }
});
