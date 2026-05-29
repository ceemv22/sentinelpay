let _authTouchLockHandler = null;
let _authTouchStartY = 0;

function authLockBodyScroll() {
    if (_authTouchLockHandler) return;
    const onStart = (e) => { _authTouchStartY = e.touches[0].clientY; };
    _authTouchLockHandler = (e) => {
        const mc = e.target.closest('.modal-content');
        if (!mc) { e.preventDefault(); return; }
        const dy = e.touches[0].clientY - _authTouchStartY;
        const atTop = mc.scrollTop <= 0 && dy > 0;
        const atBottom = mc.scrollTop >= mc.scrollHeight - mc.clientHeight && dy < 0;
        if (mc.scrollHeight <= mc.clientHeight || atTop || atBottom) e.preventDefault();
    };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', _authTouchLockHandler, { passive: false });
    _authTouchLockHandler._onStart = onStart;
}
function authUnlockBodyScroll() {
    if (!_authTouchLockHandler) return;
    document.removeEventListener('touchstart', _authTouchLockHandler._onStart);
    document.removeEventListener('touchmove', _authTouchLockHandler);
    _authTouchLockHandler = null;
}

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

window.solveCaptcha = async (scope, targetDivId, triggerBtn) => {
    return new Promise((resolve) => {
        const targetDiv = document.getElementById(targetDivId);
        if (!targetDiv) return resolve(null);

        targetDiv.innerHTML = '';
        const newDiv = document.createElement('div');
        newDiv.id = targetDivId + '-inner';
        targetDiv.appendChild(newDiv);

        if (!window.turnstile) {
            return resolve(null);
        }

        window.turnstile.render(newDiv, {
            sitekey: '0x4AAAAAADGpMozD1QOtWPkP',
            theme: 'dark',
            callback: (token) => {
                if (triggerBtn) {
                    triggerBtn.disabled = false;
                    triggerBtn.setAttribute('data-captcha-token', token);
                    triggerBtn.click();
                }
                resolve(token);
            },
            'error-callback': () => {
                resolve(null);
            }
        });
    });
};

const startResendTimer = (btn, sec) => {
    btn.disabled = true;
    let remaining = sec;
    btn.textContent = `resend in ${remaining}s`;
    const iv = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
            clearInterval(iv);
            btn.disabled = false;
            btn.textContent = 'resend email';
        } else {
            btn.textContent = `resend in ${remaining}s`;
        }
    }, 1000);
};

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

document.addEventListener('DOMContentLoaded', () => {
    const s = getSupabase();

    const urlParams = new URLSearchParams(window.location.search);
    const returnToRaw = urlParams.get('returnTo');
    const returnTo = (returnToRaw && returnToRaw.startsWith('/') && !returnToRaw.startsWith('//') && !returnToRaw.startsWith('/\\'))
        ? returnToRaw
        : null;

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
                    window.location.href = returnTo || '/dashboard/organizations';
                }
            } catch (err) { console.error(err); isBusy = false; btn.disabled = false; }
        };
    }

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

                if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
                    document.getElementById('register-error-msg').textContent = 'error: security requirements not met';
                    document.getElementById('register-error-msg').style.display = 'block';
                    btn.disabled = false;
                    btn.textContent = 'create account';
                    btn.removeAttribute('data-captcha-token');
                    isBusy = false;
                    return;
                }

                const { data, error } = await s.auth.signUp({ 
                    email, 
                    password, 
                    options: { captchaToken: token } 
                });

                const isExisting = !error && data?.user && data.user.identities?.length === 0;
                if (error || isExisting) {
                    const msg = isExisting ? 'error: unable to register. try logging in.' : 'error: registration failed.';
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
                    const resendBtn = document.getElementById('resend-btn');
                    if (resendBtn) {
                        startResendTimer(resendBtn, 60);
                        resendBtn.onclick = async () => {
                            const resendEmail = sessionStorage.getItem('sentinel_pending_email');
                            if (!resendEmail || resendBtn.disabled) return;
                            resendBtn.disabled = true;
                            resendBtn.textContent = 'sending...';
                            await s.auth.resend({ type: 'signup', email: resendEmail });
                            startResendTimer(resendBtn, 60);
                        };
                    }
                }
            } catch (err) { console.error(err); isBusy = false; btn.disabled = false; }
        };
    }

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
                    const forgotResendBtn = document.getElementById('forgot-resend-btn');
                    if (forgotResendBtn) {
                        startResendTimer(forgotResendBtn, 60);
                        forgotResendBtn.onclick = async () => {
                            const forgotEmail = sessionStorage.getItem('sentinel_forgot_email');
                            if (!forgotEmail || forgotResendBtn.disabled) return;
                            forgotResendBtn.disabled = true;
                            forgotResendBtn.textContent = 'sending...';
                            await s.auth.resetPasswordForEmail(forgotEmail, { redirectTo: window.location.origin + '/reset' });
                            startResendTimer(forgotResendBtn, 60);
                        };
                    }
                }
            } catch (err) { console.error(err); isBusy = false; btn.disabled = false; }
        };
    }

    const pendingToast = sessionStorage.getItem('sentinel_pending_toast');
    if (pendingToast) {
        sessionStorage.removeItem('sentinel_pending_toast');
        setTimeout(() => { if (window.SentinelToast) window.SentinelToast.show(pendingToast, 'warning'); }, 300);
    }

    const hash = window.location.hash.toLowerCase();
    const authPath = window.location.pathname.toLowerCase();
    const lastTab = sessionStorage.getItem('sentinel_auth_tab');

    if (authPath.includes('/auth/register') || hash.includes('register')) {
        window.switchManual('register');
        if (hash) window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
    } else if (authPath.includes('/auth/login') || hash.includes('login')) {
        window.switchManual('login');
        if (hash) window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
    } else if (lastTab) {
        window.switchManual(lastTab);
    }

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
            document.body.classList.add('modal-open');
            authLockBodyScroll();
        };
        closeBtn.onclick = () => {
            modal.classList.remove('active');
            document.body.classList.remove('modal-open');
            authUnlockBodyScroll();
            setTimeout(() => { modal.style.display = 'none'; }, 300);
        };
        modal.onclick = (e) => { if (e.target === modal) closeBtn.onclick(); };
    }

    document.getElementById('tab-login').onclick = () => window.switchManual('login');
    document.getElementById('tab-register').onclick = () => window.switchManual('register');

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

    const oauthButtonIds = ['btn-google', 'btn-google-reg', 'btn-x', 'btn-x-reg'];

    const resolveOAuthRedirect = () =>
        returnTo
            ? window.location.origin + returnTo
            : window.location.origin + '/dashboard/organizations';

    const resetOAuthButtons = () => {
        oauthButtonIds.forEach((id) => {
            const btn = document.getElementById(id);
            if (!btn || !btn.dataset.defaultHtml) return;
            btn.disabled = false;
            btn.removeAttribute('data-oauth-busy');
            btn.innerHTML = btn.dataset.defaultHtml;
        });
        sessionStorage.removeItem('sentinel_oauth_pending');
    };

    const setOAuthButtonLoading = (btn) => {
        if (!btn) return;
        btn.disabled = true;
        btn.setAttribute('data-oauth-busy', '1');
        const label = btn.querySelector('.social-btn-label');
        if (label) label.textContent = 'connecting...';
    };

    const oauthButtonsStale = () => {
        if (sessionStorage.getItem('sentinel_oauth_pending')) return true;
        return oauthButtonIds.some((id) => document.getElementById(id)?.hasAttribute('data-oauth-busy'));
    };

    oauthButtonIds.forEach((id) => {
        const btn = document.getElementById(id);
        if (btn) btn.dataset.defaultHtml = btn.innerHTML;
    });

    const oauthHash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    if (oauthHash.get('error') || oauthHash.get('error_description')) {
        resetOAuthButtons();
        const oauthError = oauthHash.get('error_description') || oauthHash.get('error');
        const loginError = document.getElementById('login-error-msg');
        const registerError = document.getElementById('register-error-msg');
        const message = 'error: ' + decodeURIComponent(oauthError || 'oauth cancelled').replace(/\+/g, ' ').toLowerCase();
        if (loginError) {
            loginError.textContent = message;
            loginError.style.display = 'block';
        }
        if (registerError) {
            registerError.textContent = message;
            registerError.style.display = 'block';
        }
        window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
    }

    window.addEventListener('pageshow', () => {
        if (oauthButtonsStale()) resetOAuthButtons();
    });

    window.addEventListener('focus', () => {
        if (oauthButtonsStale()) resetOAuthButtons();
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && oauthButtonsStale()) {
            resetOAuthButtons();
        }
    });

    oauthButtonIds.forEach((id) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.onclick = async () => {
            if (btn.hasAttribute('data-oauth-busy')) return;
            setOAuthButtonLoading(btn);
            sessionStorage.setItem('sentinel_oauth_pending', id);
            try {
                const { data, error } = await s.auth.signInWithOAuth({
                    provider: id.includes('google') ? 'google' : 'twitter',
                    options: { redirectTo: resolveOAuthRedirect() }
                });
                if (error) {
                    resetOAuthButtons();
                    const loginError = document.getElementById('login-error-msg');
                    if (loginError) {
                        loginError.textContent = 'error: ' + error.message.toLowerCase();
                        loginError.style.display = 'block';
                    }
                    return;
                }
                if (data?.url) {
                    window.location.assign(data.url);
                    return;
                }
                resetOAuthButtons();
            } catch {
                resetOAuthButtons();
            }
        };
    });

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
