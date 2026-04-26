// SentinelPay Auth Core (v16.2 - CSP ULTIMATE STABILITY)
// Features: No-Inline Policy, Self-Healing Listeners, Atomic State Management

// 1. GLOBAL UI HANDLERS (Defined for reference but listeners attached in DOMContentLoaded)
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
        supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
        return supabaseClient;
    }
    return null;
};

// 3. RESEND SUBSYSTEM
let resendTimer = null;
let forgotResendTimer = null;

const startCooldown = (btnId, timerVar, unlockKey, remainingSec) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    
    if (btnId === 'resend-btn') {
        clearInterval(resendTimer);
    } else {
        clearInterval(forgotResendTimer);
    }

    btn.disabled = true;
    btn.style.opacity = '0.35';
    let timeLeft = remainingSec;
    btn.textContent = `available again in ${timeLeft}s`;

    const tick = () => {
        timeLeft--;
        if (timeLeft <= 0) {
            if (btnId === 'resend-btn') clearInterval(resendTimer);
            else clearInterval(forgotResendTimer);
            
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.textContent = 'resend email';
            localStorage.removeItem(unlockKey);
        } else {
            btn.textContent = `available again in ${timeLeft}s`;
        }
    };

    if (btnId === 'resend-btn') resendTimer = setInterval(tick, 1000);
    else forgotResendTimer = setInterval(tick, 1000);
};

window.handleResendHandshake = async (type = 'signup') => {
    console.log(`[auth] executing resend handshake for ${type}...`);
    const s = getSupabase();
    const btnId = type === 'signup' ? 'resend-btn' : 'forgot-resend-btn';
    const btn = document.getElementById(btnId);
    const emailKey = type === 'signup' ? 'sentinel_pending_email' : 'sentinel_forgot_email';
    const unlockKey = type === 'signup' ? 'sentinel_resend_unlock' : 'sentinel_forgot_resend_unlock';
    const email = sessionStorage.getItem(emailKey);

    if (!email || !s || (btn && btn.disabled)) return;

    if (btn) {
        btn.disabled = true;
        btn.textContent = 'dispatching...';
    }

    try {
        let result;
        if (type === 'signup') {
            result = await s.auth.resend({
                type: 'signup', email: email,
                options: { emailRedirectTo: window.location.origin + '/auth?verified=true' }
            });
        } else {
            result = await s.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + '/dashboard',
            });
        }

        const { error } = result;

        if (error) {
            console.error('[auth] resend error:', error.message);
            if (btn) { 
                btn.textContent = 'error: wait'; 
                setTimeout(() => { 
                    btn.disabled = false; 
                    btn.textContent = 'resend email'; 
                }, 3000); 
            }
        } else {
            if (btn) btn.textContent = 'email sent!';
            const unlockTimestamp = Date.now() + 60000;
            localStorage.setItem(unlockKey, unlockTimestamp);
            setTimeout(() => startCooldown(btnId, type === 'signup' ? resendTimer : forgotResendTimer, unlockKey, 60), 1500);
        }
    } catch (err) { console.error('[auth] resend critical fault'); }
};

// 4. CORE INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    getSupabase();

    // CSP-COMPLIANT EVENT BINDINGS
    const bind = (id, func) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', func);
    };

    bind('tab-login', () => window.switchManual('login'));
    bind('tab-register', () => window.switchManual('register'));
    bind('resend-btn', () => window.handleResendHandshake('signup'));
    bind('forgot-resend-btn', () => window.handleResendHandshake('forgot'));
    bind('verified-dashboard-btn', () => { window.location.href = '/dashboard'; });

    // Restore Tab State
    const storedTab = sessionStorage.getItem('sentinel_auth_tab');
    if (storedTab === 'register') {
        window.switchManual('register');
    }

    // Restore Cooldowns
    const restoreCooldown = (unlockKey, btnId, timerVar) => {
        const unlockAt = localStorage.getItem(unlockKey);
        if (unlockAt) {
            const remaining = Math.ceil((parseInt(unlockAt) - Date.now()) / 1000);
            if (remaining > 0) startCooldown(btnId, timerVar, unlockKey, remaining);
        }
    };
    restoreCooldown('sentinel_resend_unlock', 'resend-btn', resendTimer);
    restoreCooldown('sentinel_forgot_resend_unlock', 'forgot-resend-btn', forgotResendTimer);

    // URL Verification Check
    const params = new URLSearchParams(window.location.search);
    if (params.get('verified') === 'true') {
        const authPanel = document.getElementById('auth-panel');
        const verifiedState = document.getElementById('auth-verified-state');
        if (authPanel) authPanel.style.display = 'none';
        if (verifiedState) verifiedState.style.display = 'flex';
    }

    // Form Handling
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
                const successState = document.getElementById('auth-success-state');
                const authPanel = document.getElementById('auth-panel');
                if (successState) successState.style.display = 'flex';
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
            btn.textContent = 'verifying...';
            errorMsg.style.display = 'none';

            const { error } = await s.auth.signInWithPassword({ email, password });
            if (error) {
                errorMsg.textContent = 'error: ' + error.message.toLowerCase();
                errorMsg.style.display = 'block';
                btn.disabled = false;
                btn.textContent = 'login';
            } else {
                window.location.href = '/dashboard';
            }
        });
    }

    // Password Eye Toggles
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

    // Social Setup (Already CSP-compliant)
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

    // Password Rules Real-time
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

    // Forgot Password Modal UI Logic
    const forgotPwTrigger = document.getElementById('forgot-pw-trigger');
    const forgotPwModal = document.getElementById('forgot-pw-modal');
    const closeForgotPwBtn = document.getElementById('close-forgot-pw-btn');
    const forgotPwForm = document.getElementById('forgot-pw-form');

    if (forgotPwTrigger && forgotPwModal && closeForgotPwBtn) {
        forgotPwTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            forgotPwModal.style.display = 'flex';
            setTimeout(() => forgotPwModal.classList.add('active'), 10);
        });

        const hideForgotModal = () => {
            forgotPwModal.classList.remove('active');
            setTimeout(() => {
                forgotPwModal.style.display = 'none';
                
                // Reset state quietly when hidden
                const stateForm = document.getElementById('forgot-pw-state-form');
                const stateSuccess = document.getElementById('forgot-pw-state-success');
                const btn = document.getElementById('forgot-pw-submit-btn');
                const errorMsg = document.getElementById('forgot-pw-error-msg');
                
                if (stateForm && stateSuccess) {
                    stateForm.style.display = 'flex';
                    stateSuccess.style.display = 'none';
                    if (forgotPwForm) forgotPwForm.reset();
                    if (btn) {
                        btn.textContent = 'send reset link';
                        btn.disabled = false;
                    }
                    if (errorMsg) errorMsg.style.display = 'none';
                }
            }, 300);
        };

        closeForgotPwBtn.addEventListener('click', hideForgotModal);
        
        // Close on background click
        forgotPwModal.addEventListener('click', (e) => {
            if (e.target === forgotPwModal) {
                hideForgotModal();
            }
        });
        
        if (forgotPwForm) {
            forgotPwForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const btn = document.getElementById('forgot-pw-submit-btn');
                const errorMsg = document.getElementById('forgot-pw-error-msg');
                const emailInput = document.getElementById('forgot-pw-email').value;
                const stateForm = document.getElementById('forgot-pw-state-form');
                const stateSuccess = document.getElementById('forgot-pw-state-success');
                
                btn.textContent = 'sending...';
                btn.disabled = true;
                errorMsg.style.display = 'none';

                const s = getSupabase();
                const { error } = await s.auth.resetPasswordForEmail(emailInput, {
                    redirectTo: window.location.origin + '/dashboard',
                });

                if (error) {
                    errorMsg.textContent = 'error: ' + error.message.toLowerCase();
                    errorMsg.style.display = 'block';
                    btn.textContent = 'send reset link';
                    btn.disabled = false;
                } else {
                    sessionStorage.setItem('sentinel_forgot_email', emailInput);
                    stateForm.style.display = 'none';
                    stateSuccess.style.display = 'flex';
                    
                    const unlockTimestamp = Date.now() + 60000;
                    localStorage.setItem('sentinel_forgot_resend_unlock', unlockTimestamp);
                    startCooldown('forgot-resend-btn', forgotResendTimer, 'sentinel_forgot_resend_unlock', 60);
                }
            });
        }
    }

    console.log('[auth] CSP-compliant system v16.2 ready.');
});
