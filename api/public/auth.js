// SentinelPay Auth Core (v18.0 - ULTIMATE FIX)
// Features: Dynamic Captcha Lifecycle, Atomic Locks, Zero-Conflict Handlers

// 1. SUPABASE SUBSYSTEM
const supabaseUrl = 'https://aivqwkgjdpklxxuvkxpy.supabase.co';
const supabaseKey = 'sb_publishable_bRfAssaGT6D8oFDQtPARbw_5fyYGWM6';
let supabaseClient = null;

const getSupabase = () => {
    if (supabaseClient) return supabaseClient;
    if (window.supabase) {
        supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey, {
            auth: { flowType: 'pkce', autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
        });
        return supabaseClient;
    }
    return null;
};

// 2. DYNAMIC CAPTCHA HANDLER (v18)
// This system destroys and recreates the captcha element to ensure zero token reuse or stale states.
window.solveCaptcha = async (scope, targetDivId, triggerBtn) => {
    console.log(`[auth] solving captcha for ${scope}...`);
    
    return new Promise((resolve) => {
        const targetDiv = document.getElementById(targetDivId);
        if (!targetDiv) return resolve(null);

        // 1. Clear previous widget
        targetDiv.innerHTML = '';
        const newDiv = document.createElement('div');
        newDiv.id = targetDivId + '-inner';
        targetDiv.appendChild(newDiv);

        if (!window.turnstile) {
            console.error('[auth] turnstile missing');
            return resolve(null);
        }

        // 2. Render fresh widget
        window.turnstile.render(newDiv, {
            sitekey: '0x4AAAAAADGpMozD1QOtWPkP',
            theme: 'dark',
            callback: (token) => {
                console.log(`[auth] captcha solved for ${scope}`);
                if (triggerBtn) {
                    triggerBtn.disabled = false;
                    triggerBtn.setAttribute('data-captcha-token', token);
                    // AUTO-SUBMIT after solve
                    triggerBtn.click();
                }
                resolve(token);
            },
            'error-callback': () => {
                console.error(`[auth] turnstile error for ${scope}`);
                resolve(null);
            }
        });
    });
};

// 3. UI HELPERS
window.switchManual = (target) => {
    const pLogin = document.getElementById('panel-login');
    const pRegister = document.getElementById('panel-register');
    const tLogin = document.getElementById('tab-login');
    const tRegister = document.getElementById('tab-register');

    if (target === 'login') {
        pRegister.style.display = 'none';
        pRegister.classList.remove('active');
        pLogin.style.display = 'block';
        setTimeout(() => pLogin.classList.add('active'), 10);
        tLogin.classList.add('active');
        tRegister.classList.remove('active');
    } else {
        pLogin.style.display = 'none';
        pLogin.classList.remove('active');
        pRegister.style.display = 'block';
        setTimeout(() => pRegister.classList.add('active'), 10);
        tRegister.classList.add('active');
        tLogin.classList.remove('active');
    }
    sessionStorage.setItem('sentinel_auth_tab', target);
};

// 4. MAIN INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    console.log('[sentinel-auth] initializing v18.0...');
    const s = getSupabase();

    // FORM: LOGIN
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        let isBusy = false;
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            if (isBusy) return;

            const btn = document.getElementById('login-submit-btn');
            const token = btn.getAttribute('data-captcha-token');

            if (!token) {
                btn.disabled = true;
                btn.textContent = 'verifying identity...';
                await window.solveCaptcha('login', 'turnstile-login', btn);
                return;
            }

            try {
                isBusy = true;
                btn.disabled = true;
                btn.textContent = 'logging in...';
                const email = document.getElementById('login-email').value;
                const password = document.getElementById('login-password').value;

                const { error } = await s.auth.signInWithPassword({ 
                    email, 
                    password, 
                    options: { captchaToken: token } 
                });

                if (error) {
                    document.getElementById('login-error-msg').textContent = 'error: wrong credentials';
                    document.getElementById('login-error-msg').style.display = 'block';
                    btn.disabled = false;
                    btn.textContent = 'login';
                    btn.removeAttribute('data-captcha-token');
                    isBusy = false;
                } else {
                    window.location.href = '/dashboard/organizations';
                }
            } catch (err) { console.error(err); isBusy = false; btn.disabled = false; }
        };
    }

    // FORM: REGISTER
    const regForm = document.getElementById('register-form');
    if (regForm) {
        let isBusy = false;
        regForm.onsubmit = async (e) => {
            e.preventDefault();
            if (isBusy) return;

            const btn = document.getElementById('register-submit-btn');
            const token = btn.getAttribute('data-captcha-token');

            if (!token) {
                btn.disabled = true;
                btn.textContent = 'verifying identity...';
                await window.solveCaptcha('register', 'turnstile-register', btn);
                return;
            }

            try {
                isBusy = true;
                btn.disabled = true;
                btn.textContent = 'creating account...';
                const email = document.getElementById('reg-email').value;
                const password = document.getElementById('reg-password').value;

                const { data, error } = await s.auth.signUp({ 
                    email, 
                    password, 
                    options: { captchaToken: token } 
                });

                const isExisting = !error && data?.user && data.user.identities?.length === 0;
                if (error || isExisting) {
                    const msg = isExisting ? 'error: email already registered' : 'error: ' + error.message.toLowerCase();
                    document.getElementById('register-error-msg').textContent = msg;
                    document.getElementById('register-error-msg').style.display = 'block';
                    btn.disabled = false;
                    btn.textContent = 'create account';
                    btn.removeAttribute('data-captcha-token');
                    isBusy = false;
                } else {
                    sessionStorage.setItem('sentinel_pending_email', email);
                    document.getElementById('auth-panel').style.display = 'none';
                    document.getElementById('auth-success-state').style.display = 'flex';
                }
            } catch (err) { console.error(err); isBusy = false; btn.disabled = false; }
        };
    }

    // FORM: FORGOT PASSWORD
    const forgotForm = document.getElementById('forgot-pw-form');
    if (forgotForm) {
        let isBusy = false;
        forgotForm.onsubmit = async (e) => {
            e.preventDefault();
            if (isBusy) return;

            const btn = document.getElementById('forgot-pw-submit-btn');
            const token = btn.getAttribute('data-captcha-token');

            if (!token) {
                btn.disabled = true;
                btn.textContent = 'verifying identity...';
                await window.solveCaptcha('forgot', 'turnstile-forgot', btn);
                return;
            }

            try {
                isBusy = true;
                btn.disabled = true;
                btn.textContent = 'sending link...';
                const email = document.getElementById('forgot-pw-email').value;
                const errorMsg = document.getElementById('forgot-pw-error-msg');

                const { error } = await s.auth.resetPasswordForEmail(email, { 
                    redirectTo: window.location.origin + '/reset', 
                    captchaToken: token 
                });

                if (error) {
                    errorMsg.textContent = 'error: ' + error.message.toLowerCase();
                    errorMsg.style.display = 'block';
                    btn.disabled = false;
                    btn.textContent = 'send reset link';
                    btn.removeAttribute('data-captcha-token');
                    isBusy = false;
                } else {
                    document.getElementById('forgot-pw-state-form').style.display = 'none';
                    document.getElementById('forgot-pw-state-success').style.display = 'flex';
                    sessionStorage.setItem('sentinel_forgot_email', email);
                }
            } catch (err) { console.error(err); isBusy = false; btn.disabled = false; }
        };
    }

    // Tab Auto-Switch (based on URL hash or session)
    const hash = window.location.hash.toLowerCase();
    const lastTab = sessionStorage.getItem('sentinel_auth_tab');

    if (hash.includes('register')) {
        window.switchManual('register');
        // Instantly scrub hash for a clean URL
        window.history.replaceState(null, document.title, window.location.pathname);
    } else if (hash.includes('login')) {
        window.switchManual('login');
        // Instantly scrub hash for a clean URL
        window.history.replaceState(null, document.title, window.location.pathname);
    } else if (lastTab) {
        window.switchManual(lastTab);
    }

    // BINDINGS
    const trigger = document.getElementById('forgot-pw-trigger');
    const modal = document.getElementById('forgot-pw-modal');
    const closeBtn = document.getElementById('close-forgot-pw-btn');

    if (trigger && modal && closeBtn) {
        trigger.onclick = (e) => {
            e.preventDefault();
            document.getElementById('forgot-pw-state-form').style.display = 'block';
            document.getElementById('forgot-pw-state-success').style.display = 'none';
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
        };
        closeBtn.onclick = () => {
            modal.classList.remove('active');
            setTimeout(() => { modal.style.display = 'none'; }, 300);
        };
        modal.onclick = (e) => { if (e.target === modal) closeBtn.onclick(); };
    }

    document.getElementById('tab-login').onclick = () => window.switchManual('login');
    document.getElementById('tab-register').onclick = () => window.switchManual('register');

    // Password Toggle
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
    ['btn-google', 'btn-google-reg', 'btn-x', 'btn-x-reg'].forEach(id => {
        const b = document.getElementById(id);
        if (b) {
            b.onclick = async () => {
                b.disabled = true;
                b.textContent = 'connecting...';
                await s.auth.signInWithOAuth({ 
                    provider: id.includes('google') ? 'google' : 'twitter', 
                    options: { redirectTo: window.location.origin + '/dashboard/organizations' } 
                });
            };
        }
    });

    // Password Rules
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
