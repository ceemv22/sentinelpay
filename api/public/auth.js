const supabaseUrl = 'https://aivqwkgjdpklxxuvkxpy.supabase.co';
const supabaseKey = 'sb_publishable_bRfAssaGT6D8oFDQtPARbw_5fyYGWM6';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', () => {
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const panelLogin = document.getElementById('panel-login');
    const panelRegister = document.getElementById('panel-register');
    const successState = document.getElementById('auth-success-state');
    const authPanel = document.getElementById('auth-panel');

    let currentTab = 'login';

    // ── Smooth Panel Switch ──
    function switchPanel(target) {
        if (currentTab === target) return;
        const outgoing = target === 'register' ? panelLogin : panelRegister;
        const incoming = target === 'register' ? panelRegister : panelLogin;

        outgoing.classList.add('fade-out');
        setTimeout(() => {
            outgoing.style.display = 'none';
            outgoing.classList.remove('fade-out');
            incoming.style.display = 'block';
            // Force reflow then animate in
            incoming.classList.add('fade-out');
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    incoming.classList.remove('fade-out');
                });
            });
        }, 250);

        currentTab = target;
        tabLogin.classList.toggle('active', target === 'login');
        tabRegister.classList.toggle('active', target === 'register');
    }

    tabLogin.addEventListener('click', () => switchPanel('login'));
    tabRegister.addEventListener('click', () => switchPanel('register'));

    // ── URL Param ──
    if (new URLSearchParams(window.location.search).get('tab') === 'register') {
        // Instant switch, no animation
        panelLogin.style.display = 'none';
        panelRegister.style.display = 'block';
        tabLogin.classList.remove('active');
        tabRegister.classList.add('active');
        currentTab = 'register';
    }

    // ── Password Rules Toggle ──
    const pwRulesToggle = document.getElementById('pw-rules-toggle');
    const pwRulesTooltip = document.getElementById('pw-rules-tooltip');
    if (pwRulesToggle) {
        pwRulesToggle.addEventListener('click', () => {
            const showing = pwRulesTooltip.style.display !== 'none';
            pwRulesTooltip.style.display = showing ? 'none' : 'block';
        });
    }

    // ── Live Password Validation ──
    const regPassword = document.getElementById('reg-password');
    if (regPassword) {
        regPassword.addEventListener('input', () => {
            const val = regPassword.value;
            const ruleLen = document.getElementById('rule-len');
            const ruleUpper = document.getElementById('rule-upper');
            const ruleNum = document.getElementById('rule-num');

            ruleLen.textContent = val.length >= 8 ? '✓' : '✗';
            ruleLen.style.color = val.length >= 8 ? 'var(--color-green)' : 'var(--color-red)';

            ruleUpper.textContent = /[A-Z]/.test(val) ? '✓' : '✗';
            ruleUpper.style.color = /[A-Z]/.test(val) ? 'var(--color-green)' : 'var(--color-red)';

            ruleNum.textContent = /[0-9]/.test(val) ? '✓' : '✗';
            ruleNum.style.color = /[0-9]/.test(val) ? 'var(--color-green)' : 'var(--color-red)';
        });
    }

    // ── LOGIN Form ──
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorMsg = document.getElementById('login-error-msg');
        const btn = document.getElementById('login-submit-btn');

        btn.textContent = 'processing...';
        btn.disabled = true;
        errorMsg.style.display = 'none';

        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            window.location.href = '/dashboard';
        } catch (error) {
            errorMsg.textContent = error.message;
            errorMsg.style.display = 'block';
            btn.disabled = false;
            btn.textContent = 'login';
        }
    });

    // ── REGISTER Form ──
    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        const confirm = document.getElementById('reg-confirm').value;
        const tos = document.getElementById('reg-tos').checked;
        const errorMsg = document.getElementById('register-error-msg');
        const btn = document.getElementById('register-submit-btn');

        errorMsg.style.display = 'none';

        // Client-side validation
        if (password.length < 8) {
            errorMsg.textContent = 'password must be at least 8 characters.';
            errorMsg.style.display = 'block';
            return;
        }
        if (!/[A-Z]/.test(password)) {
            errorMsg.textContent = 'password needs at least one uppercase letter.';
            errorMsg.style.display = 'block';
            return;
        }
        if (!/[0-9]/.test(password)) {
            errorMsg.textContent = 'password needs at least one number.';
            errorMsg.style.display = 'block';
            return;
        }
        if (password !== confirm) {
            errorMsg.textContent = 'passwords do not match.';
            errorMsg.style.display = 'block';
            return;
        }
        if (!tos) {
            errorMsg.textContent = 'you must agree to the terms.';
            errorMsg.style.display = 'block';
            return;
        }

        btn.textContent = 'creating...';
        btn.disabled = true;

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: window.location.origin + '/dashboard'
                }
            });
            if (error) throw error;

            // Show success
            authPanel.style.display = 'none';
            successState.style.display = 'block';
        } catch (error) {
            errorMsg.textContent = error.message;
            errorMsg.style.display = 'block';
            btn.disabled = false;
            btn.textContent = 'create account';
        }
    });

    // ── Social Logins (both panels) ──
    const oauthRedirect = window.location.origin + '/dashboard';

    ['btn-google', 'btn-google-reg'].forEach(id => {
        document.getElementById(id).addEventListener('click', async () => {
            await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: oauthRedirect }
            });
        });
    });

    ['btn-x', 'btn-x-reg'].forEach(id => {
        document.getElementById(id).addEventListener('click', async () => {
            await supabase.auth.signInWithOAuth({
                provider: 'twitter',
                options: { redirectTo: oauthRedirect }
            });
        });
    });
});
