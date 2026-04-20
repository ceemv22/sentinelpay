// Consolidated Auth Logic (v7.0)
// This file handles:
// 1. Tab switching (Login <-> Register)
// 2. Initial tab state via URL params (?tab=register)
// 3. Password rules live validation
// 4. Form submissions (Sign-in/Sign-up) via Supabase
// 5. Social Oauth handlers

document.addEventListener('DOMContentLoaded', () => {
    console.log('[sentinel-auth] initializing logic v7.0...');

    // DOM Elements
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const panelLogin = document.getElementById('panel-login');
    const panelRegister = document.getElementById('panel-register');
    const authPanel = document.getElementById('auth-panel');
    const successState = document.getElementById('auth-success-state');

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

    function switchPanel(target) {
        if (currentTab === target) return;
        
        // Toggle active tab classes
        tabLogin.classList.toggle('active', target === 'login');
        tabRegister.classList.toggle('active', target === 'register');

        // Instant UI switch
        if (target === 'register') {
            panelLogin.style.display = 'none';
            panelRegister.style.display = 'block';
        } else {
            panelRegister.style.display = 'none';
            panelLogin.style.display = 'block';
        }

        currentTab = target;
        console.log('[sentinel-auth] switched to:', target);
    }

    // Attach Listeners (CSP-Safe)
    tabLogin.addEventListener('click', () => switchPanel('login'));
    tabRegister.addEventListener('click', () => switchPanel('register'));

    // Handle URL params
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'register') {
        switchPanel('register');
    }

    // Password Rules Live Validation
    const regPw = document.getElementById('reg-password');
    const rules = {
        len: document.getElementById('rule-len'),
        upper: document.getElementById('rule-upper'),
        num: document.getElementById('rule-num')
    };
    if (regPw && rules.len) {
        regPw.addEventListener('input', (e) => {
            const val = e.target.value;
            rules.len.classList.toggle('met', val.length >= 8);
            rules.upper.classList.toggle('met', /[A-Z]/.test(val));
            rules.num.classList.toggle('met', /[0-9]/.test(val));
        });
    }

    // Rules Tooltip Toggle
    const pwToggle = document.getElementById('pw-rules-toggle');
    const pwTooltip = document.getElementById('pw-rules-tooltip');
    if (pwToggle && pwTooltip) {
        pwToggle.addEventListener('click', () => {
            pwTooltip.style.display = pwTooltip.style.display === 'block' ? 'none' : 'block';
        });
    }

    // Forms Submissions
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
                errorMsg.textContent = 'error: ' + error.message.toLowerCase();
                errorMsg.style.display = 'block';
                btn.disabled = false;
                btn.textContent = 'sign in';
            } else {
                window.location.href = '/dashboard';
            }
        });
    }

    const regForm = document.getElementById('register-form');
    if (regForm) {
        regForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!supabase) return alert('Auth unavailable');
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;
            const confirm = document.getElementById('reg-confirm').value;
            const tos = document.getElementById('reg-tos').checked;
            const btn = document.getElementById('register-submit-btn');
            const errorMsg = document.getElementById('register-error-msg');

            if (password !== confirm) {
                errorMsg.textContent = 'error: passwords do not match';
                errorMsg.style.display = 'block';
                btn.disabled = false; return;
            }
            if (!tos) {
                errorMsg.textContent = 'error: please accept terms';
                errorMsg.style.display = 'block';
                btn.disabled = false; return;
            }

            btn.disabled = true;
            btn.textContent = 'creating account...';
            errorMsg.style.display = 'none';

            const { error } = await supabase.auth.signUp({ 
                email, 
                password,
                options: { emailRedirectTo: window.location.origin + '/auth' }
            });
            if (error) {
                errorMsg.textContent = 'error: ' + error.message.toLowerCase();
                errorMsg.style.display = 'block';
                btn.disabled = false;
                btn.textContent = 'create account';
            } else {
                successState.style.display = 'block';
                authPanel.style.display = 'none';
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
