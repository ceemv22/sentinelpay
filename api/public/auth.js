// SentinelPay Auth Core (v17.2 - ULTIMATE RECOVERY)
// Features: Zero-Trust Scripting, Explicit Scoping, Atomic Event Binding

// 1. GLOBAL UI HANDLERS
window.switchManual = (target) => {
    console.log('[auth] navigating to ->', target);
    const panelLogin = document.getElementById('panel-login');
    const panelRegister = document.getElementById('panel-register');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');

    if (!panelLogin || !panelRegister) return;

    if (target === 'login') {
        panelRegister.classList.remove('active');
        panelRegister.style.display = 'none';
        panelLogin.style.display = 'block';
        setTimeout(() => panelLogin.classList.add('active'), 10);
    } else {
        panelLogin.classList.remove('active');
        panelLogin.style.display = 'none';
        panelRegister.style.display = 'block';
        setTimeout(() => panelRegister.classList.add('active'), 10);
    }

    if (tabLogin && tabRegister) {
        tabLogin.classList.toggle('active', target === 'login');
        tabRegister.classList.toggle('active', target === 'register');
    }
    sessionStorage.setItem('sentinel_auth_tab', target);
};

// 2. SUPABASE SUBSYSTEM
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

// 3. COOLDOWN SUBSYSTEM
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
    
    const btnId = type === 'signup' ? 'resend-btn' : 'forgot-resend-btn';
    const emailKey = type === 'signup' ? 'sentinel_pending_email' : 'sentinel_forgot_email';
    const unlockKey = type === 'signup' ? 'sentinel_resend_unlock' : 'sentinel_forgot_resend_unlock';
    const email = sessionStorage.getItem(emailKey);
    const btn = document.getElementById(btnId);

    if (!email || (btn && btn.disabled)) return;

    // CAPTCHA Logic for Resend
    const tokenKey = type === 'signup' ? 'explicitRegToken' : 'explicitForgotToken';
    const token = window[tokenKey];

    if (!token) {
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'solve captcha...';
        }
        const targetId = type === 'signup' ? '#turnstile-register' : '#turnstile-forgot';
        
        // Show the panel if it was hidden (for forgot password)
        const forgotStateForm = document.getElementById('forgot-pw-state-form');
        const forgotStateSuccess = document.getElementById('forgot-pw-state-success');
        if (type === 'forgot' && forgotStateForm && forgotStateSuccess) {
            forgotStateSuccess.style.display = 'none';
            forgotStateForm.style.display = 'block';
        }

        if (window[`turnstile${type === 'signup' ? 'Reg' : 'Forgot'}WidgetId`] === undefined) {
            window[`turnstile${type === 'signup' ? 'Reg' : 'Forgot'}WidgetId`] = window.turnstile.render(targetId, {
                sitekey: '0x4AAAAAADGpMozD1QOtWPkP',
                theme: 'dark',
                callback: (t) => {
                    window[tokenKey] = t;
                    if (btn) {
                        btn.disabled = false;
                        btn.click();
                    }
                }
            });
        } else {
            window.turnstile.reset(window[`turnstile${type === 'signup' ? 'Reg' : 'Forgot'}WidgetId`]);
        }
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.textContent = 'sending...';
    }

    try {
        const { error } = type === 'signup' 
            ? await s.auth.resend({ type: 'signup', email, options: { captchaToken: token, emailRedirectTo: window.location.origin + '/auth?verified=true' } })
            : await s.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset', captchaToken: token });

        // Cleanup
        window[tokenKey] = null;
        if (window.turnstile) window.turnstile.reset(window[`turnstile${type === 'signup' ? 'Reg' : 'Forgot'}WidgetId`]);

        if (error) {
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

// 4. CORE INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    console.log('[sentinel-auth] initializing v17.2...');
    
    const s = getSupabase();
    const scrubHash = () => {
        if (window.location.href.indexOf('#') > -1) {
            window.history.replaceState(null, document.title, window.location.href.split('#')[0]);
        }
    };

    if (s) {
        s.auth.onAuthStateChange((event, session) => {
            if (session) {
                console.log('[auth] session established (event: ' + event + '), waiting to scrub hash...');
                setTimeout(scrubHash, 1500); 
            }
        });
        // Fallback for immediate scrub if session already exists
        s.auth.getSession().then(({ data: { session } }) => {
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

    // Password Rules Toggle & Real-time Validation
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

    // Restore Tab
    const storedTab = sessionStorage.getItem('sentinel_auth_tab');
    if (storedTab === 'register') window.switchManual('register');

    // Restore Cooldowns
    const restoreCooldown = (unlockKey, btnId, type) => {
        const unlockAt = localStorage.getItem(unlockKey);
        if (unlockAt) {
            const remaining = Math.ceil((parseInt(unlockAt) - Date.now()) / 1000);
            if (remaining > 0) startCooldown(btnId, type, unlockKey, remaining);
        }
    };
    restoreCooldown('sentinel_resend_unlock', 'resend-btn', 'signup');
    restoreCooldown('sentinel_forgot_resend_unlock', 'forgot-resend-btn', 'forgot');

    // URL Check
    const params = new URLSearchParams(window.location.search);
    if (params.get('verified') === 'true') {
        const panel = document.getElementById('auth-panel');
        const vState = document.getElementById('auth-verified-state');
        if (panel) panel.style.display = 'none';
        if (vState) vState.style.display = 'flex';
    }

    // Turnstile State Management
    window.explicitRegToken = null;
    window.explicitLoginToken = null;
    window.explicitForgotToken = null;

    const renderTurnstile = (id, target) => {
        if (!window.turnstile) return null;
        return window.turnstile.render(id, {
            sitekey: '0x4AAAAAADGpMozD1QOtWPkP',
            theme: 'dark',
            callback: (token) => {
                if (target === 'login') window.explicitLoginToken = token;
                else if (target === 'register') window.explicitRegToken = token;
                else if (target === 'forgot') window.explicitForgotToken = token;
                
                const btn = document.getElementById(`${target}-submit-btn`) || document.getElementById(`${target}-pw-submit-btn`);
                if (btn) {
                    btn.disabled = false;
                    btn.click();
                }
            }
        });
    };

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

            if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
                errorMsg.textContent = 'error: password requirements not met';
                errorMsg.style.display = 'block';
                return;
            }

            if (!window.explicitRegToken) {
                btn.disabled = true;
                btn.textContent = 'solve captcha...';
                if (window.turnstileRegWidgetId === undefined) {
                    window.turnstileRegWidgetId = renderTurnstile('#turnstile-register', 'register');
                } else {
                    window.turnstile.reset(window.turnstileRegWidgetId);
                }
                return;
            }

            btn.disabled = true;
            btn.textContent = 'processing...';
            errorMsg.style.display = 'none';

            const { data, error } = await s.auth.signUp({ email, password, options: { captchaToken: window.explicitRegToken } });
            
            // Cleanup
            window.explicitRegToken = null;
            if (window.turnstile && window.turnstileRegWidgetId !== undefined) window.turnstile.reset(window.turnstileRegWidgetId);

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
                const unlockAt = Date.now() + 60000;
                localStorage.setItem('sentinel_resend_unlock', unlockAt);
                startCooldown('resend-btn', 'signup', 'sentinel_resend_unlock', 60);
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

            if (!window.explicitLoginToken) {
                btn.disabled = true;
                btn.textContent = 'solve captcha...';
                if (window.turnstileLoginWidgetId === undefined) {
                    window.turnstileLoginWidgetId = renderTurnstile('#turnstile-login', 'login');
                } else {
                    window.turnstile.reset(window.turnstileLoginWidgetId);
                }
                return;
            }

            btn.disabled = true;
            btn.textContent = 'verifying...';
            errorMsg.style.display = 'none';

            const { error } = await s.auth.signInWithPassword({ email, password, options: { captchaToken: window.explicitLoginToken } });
            
            window.explicitLoginToken = null;
            if (window.turnstile && window.turnstileLoginWidgetId !== undefined) window.turnstile.reset(window.turnstileLoginWidgetId);

            if (error) {
                errorMsg.textContent = 'error: wrong credentials';
                errorMsg.style.display = 'block';
                btn.disabled = false;
                btn.textContent = 'login';
            } else {
                window.location.href = '/dashboard';
            }
        });
    }

    // Socials
    const redirectUrl = window.location.origin + '/dashboard';
    ['btn-google', 'btn-google-reg', 'btn-x', 'btn-x-reg'].forEach(id => {
        const b = document.getElementById(id);
        if (b) {
            b.addEventListener('click', async () => {
                const s = getSupabase();
                b.disabled = true;
                b.textContent = 'connecting...';
                const provider = id.includes('google') ? 'google' : 'twitter';
                await s.auth.signInWithOAuth({ provider, options: { redirectTo: redirectUrl } });
            });
        }
    });

    // Eye Toggles
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

    // Forgot Password
    const trigger = document.getElementById('forgot-pw-trigger');
    const modal = document.getElementById('forgot-pw-modal');
    const closeBtn = document.getElementById('close-forgot-pw-btn');
    const forgotForm = document.getElementById('forgot-pw-form');

    if (trigger && modal && closeBtn) {
        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            // Reset Modal State
            document.getElementById('forgot-pw-state-form').style.display = 'block';
            document.getElementById('forgot-pw-state-success').style.display = 'none';
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
        });

        const hideModal = () => {
            modal.classList.remove('active');
            setTimeout(() => { modal.style.display = 'none'; }, 300);
        };

        closeBtn.addEventListener('click', hideModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) hideModal(); });

        if (forgotForm) {
            forgotForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const s = getSupabase();
                const email = document.getElementById('forgot-pw-email').value;
                const btn = document.getElementById('forgot-pw-submit-btn');
                const errorMsg = document.getElementById('forgot-pw-error-msg');

                if (!window.explicitForgotToken) {
                    btn.disabled = true;
                    btn.textContent = 'solve captcha...';
                    if (window.turnstileForgotWidgetId === undefined) {
                        window.turnstileForgotWidgetId = renderTurnstile('#turnstile-forgot', 'forgot');
                    } else {
                        window.turnstile.reset(window.turnstileForgotWidgetId);
                    }
                    return;
                }

                btn.disabled = true;
                btn.textContent = 'sending...';
                errorMsg.style.display = 'none';

                const { error } = await s.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset', captchaToken: window.explicitForgotToken });
                
                window.explicitForgotToken = null;
                if (window.turnstile && window.turnstileForgotWidgetId !== undefined) window.turnstile.reset(window.turnstileForgotWidgetId);

                if (error) {
                    errorMsg.textContent = 'error: ' + error.message.toLowerCase();
                    errorMsg.style.display = 'block';
                    btn.disabled = false;
                    btn.textContent = 'send reset link';
                } else {
                    sessionStorage.setItem('sentinel_forgot_email', email);
                    document.getElementById('forgot-pw-state-form').style.display = 'none';
                    document.getElementById('forgot-pw-state-success').style.display = 'flex';
                    const unlockAt = Date.now() + 60000;
                    localStorage.setItem('sentinel_forgot_resend_unlock', unlockAt);
                    startCooldown('forgot-resend-btn', 'forgot', 'sentinel_forgot_resend_unlock', 60);
                }
            });
        }
    }
});
