// Consolidated Auth Logic (v8.0)
// Features: Persistent Tab State, Clean URL, Sync'd Layouts, Fade Animations

document.addEventListener('DOMContentLoaded', () => {
    console.log('[sentinel-auth] initializing logic v8.0...');

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
    let isTransitioning = false;

    function switchPanel(target, persist = true) {
        if ((currentTab === target && persist) || isTransitioning) return;
        isTransitioning = true;

        const outgoing = currentTab === 'login' ? panelLogin : panelRegister;
        const incoming = target === 'login' ? panelLogin : panelRegister;

        // 1. Fade out current
        outgoing.classList.remove('active');
        tabLogin.classList.toggle('active', target === 'login');
        tabRegister.classList.toggle('active', target === 'register');

        setTimeout(() => {
            // 2. Switch visibility
            outgoing.style.display = 'none';
            incoming.style.display = 'block';

            // 3. Trigger fade in
            setTimeout(() => {
                incoming.classList.add('active');
                currentTab = target;
                isTransitioning = false;
                if (persist) sessionStorage.setItem('sentinel_auth_tab', target);
            }, 30);
        }, 150);
    }

    // Attach Listeners
    tabLogin.addEventListener('click', () => switchPanel('login'));
    tabRegister.addEventListener('click', () => switchPanel('register'));

    // Handle Initial State (URL > Session > Default)
    const params = new URLSearchParams(window.location.search);
    const storedTab = sessionStorage.getItem('sentinel_auth_tab');
    
    if (params.get('tab') === 'register') {
        switchPanel('register', true);
    } else if (storedTab === 'register') {
        // Initial load needs immediate show
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
            if (rules.len) rules.len.classList.toggle('met', val.length >= 8);
            if (rules.upper) rules.upper.classList.toggle('met', /[A-Z]/.test(val));
            if (rules.num) rules.num.classList.toggle('met', /[0-9]/.test(val));
        });
    }

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
                errorMsg.textContent = 'error: ' + error.message.toLowerCase();
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
