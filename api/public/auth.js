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
                const identifier = document.getElementById('login-email').value.trim();
                const password = document.getElementById('login-password').value;

                let email = identifier;
                if (!identifier.includes('@')) {
                    try {
                        const resolveRes = await fetch('/v1/auth/resolve-login', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ identifier })
                        });
                        const resolveData = await resolveRes.json();
                        if (!resolveRes.ok || !resolveData.email) {
                            document.getElementById('login-error-msg').textContent = 'error: wrong credentials';
                            document.getElementById('login-error-msg').style.display = 'block';
                            btn.disabled = false;
                            btn.textContent = 'login';
                            btn.removeAttribute('data-captcha-token');
                            isBusy = false;
                            return;
                        }
                        email = resolveData.email;
                    } catch {
                        document.getElementById('login-error-msg').textContent = 'error: something went wrong. try again';
                        document.getElementById('login-error-msg').style.display = 'block';
                        btn.disabled = false;
                        btn.textContent = 'login';
                        btn.removeAttribute('data-captcha-token');
                        isBusy = false;
                        return;
                    }
                }

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
                    let needsMfa = false;
                    try {
                        if (s.auth.mfa && s.auth.mfa.getAuthenticatorAssuranceLevel) {
                            const { data: aal } = await s.auth.mfa.getAuthenticatorAssuranceLevel();
                            needsMfa = !!(aal && aal.nextLevel === 'aal2' && aal.nextLevel !== aal.currentLevel);
                        }
                    } catch (mfaErr) { needsMfa = false; }
                    if (needsMfa) {
                        isBusy = false;
                        showMfaStep();
                        return;
                    }
                    window.location.href = returnTo || '/dashboard/organizations';
                }
            } catch (err) { console.error(err); isBusy = false; btn.disabled = false; }
        };
    }

    function showMfaStep() {
        const panel = document.getElementById('auth-panel');
        const mfaState = document.getElementById('auth-mfa-state');
        const codeInput = document.getElementById('auth-mfa-code');
        const verifyBtn = document.getElementById('auth-mfa-verify-btn');
        const errEl = document.getElementById('auth-mfa-error');
        const cancelBtn = document.getElementById('auth-mfa-cancel');
        if (!panel || !mfaState) { window.location.href = returnTo || '/dashboard/organizations'; return; }

        panel.style.display = 'none';
        mfaState.style.display = 'flex';
        setTimeout(() => { if (codeInput) codeInput.focus(); }, 60);

        if (codeInput) codeInput.oninput = () => { codeInput.value = codeInput.value.replace(/[^0-9]/g, '').slice(0, 6); };

        const submit = async () => {
            if (!errEl) return;
            errEl.style.display = 'none';
            const code = (codeInput.value || '').trim();
            if (!/^[0-9]{6}$/.test(code)) { errEl.textContent = 'error: enter the 6-digit code'; errEl.style.display = 'block'; return; }
            verifyBtn.disabled = true;
            verifyBtn.textContent = 'verifying...';
            try {
                const { data: factorData } = await s.auth.mfa.listFactors();
                const factors = (factorData && (factorData.totp || factorData.all)) || [];
                const f = factors.find(x => x.status === 'verified') || factors[0];
                if (!f) throw new Error('no authenticator found');
                const { error } = await s.auth.mfa.challengeAndVerify({ factorId: f.id, code });
                if (error) throw new Error(error.message);
                window.location.href = returnTo || '/dashboard/organizations';
            } catch (e) {
                console.error('[mfa login verify]', e.message || e);
                const m = (e.message || '').toLowerCase();
                let friendly = 'could not verify the code. try again.';
                if (m.includes('rate') || m.includes('too many') || m.includes('limit')) friendly = 'too many attempts. wait a moment and try again.';
                else if (m.includes('expired')) friendly = 'the code expired. enter a fresh one from your authenticator app.';
                else if (m.includes('invalid') || m.includes('incorrect') || m.includes('totp') || m.includes('code') || m.includes('verif')) friendly = 'incorrect code. check your authenticator app and try again.';
                else if (m.includes('network') || m.includes('fetch') || m.includes('failed to')) friendly = 'network error. check your connection and try again.';
                verifyBtn.disabled = false;
                verifyBtn.textContent = 'verify';
                errEl.textContent = `error: ${friendly}`;
                errEl.style.display = 'block';
                if (codeInput) { codeInput.value = ''; codeInput.focus(); }
            }
        };

        if (verifyBtn) verifyBtn.onclick = submit;
        if (codeInput) codeInput.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } };
        if (cancelBtn) cancelBtn.onclick = async () => { try { await s.auth.signOut(); } catch (e) {} window.location.reload(); };
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

                const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!EMAIL_RE.test(email)) {
                    document.getElementById('register-error-msg').textContent = 'error: invalid email format';
                    document.getElementById('register-error-msg').style.display = 'block';
                    btn.disabled = false;
                    btn.textContent = 'create account';
                    btn.removeAttribute('data-captcha-token');
                    isBusy = false;
                    return;
                }

                if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
                    document.getElementById('register-error-msg').textContent = 'error: password must be at least 8 characters and include an uppercase letter and a number';
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
                    let msg = 'error: registration failed. try again.';
                    if (isExisting) {
                        msg = 'error: this email is already registered. try logging in instead.';
                    } else if (error) {
                        const m = (error.message || '').toLowerCase();
                        if (m.includes('email') && (m.includes('invalid') || m.includes('format'))) {
                            msg = 'error: invalid email format';
                        } else if (m.includes('already registered') || m.includes('already exists') || m.includes('already been registered')) {
                            msg = 'error: this email is already registered. try logging in instead.';
                        } else if (m.includes('password')) {
                            msg = 'error: password does not meet security requirements';
                        } else if (m.includes('rate limit') || m.includes('too many')) {
                            msg = 'error: too many attempts. wait a moment and try again';
                        } else if (m.includes('captcha')) {
                            msg = 'error: verification failed. please retry';
                        }
                    }
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
