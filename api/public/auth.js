// SentinelPay Auth Core (v16.1 - UNSTOPPABLE INTERACTIVITY)
// Features: Global Scope Enforcement, Dynamic DOM Discovery, Resilience v16.1

// 1. GLOBAL UI HANDLERS (Defined first and outside all blocks)
window.switchManual = (target) => {
    console.log('[auth] manual switch triggered ->', target);
    
    // Find elements dynamically to avoid closure/null issues
    const panelLogin = document.getElementById('panel-login');
    const panelRegister = document.getElementById('panel-register');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');

    if (!panelLogin || !panelRegister) {
        console.error('[auth] panels missing in DOM');
        return;
    }

    // Toggle active state
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

    // Update Tab Visuals
    if (tabLogin && tabRegister) {
        tabLogin.classList.toggle('active', target === 'login');
        tabRegister.classList.toggle('active', target === 'register');
    }

    sessionStorage.setItem('sentinel_auth_tab', target);
};

// 2. SUPABASE & RESEND LOGIC (Stabilized)
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

// DISPATCHER
let resendTimer = null;
const startResendCooldown = (remainingSec) => {
    const resendBtn = document.getElementById('resend-btn');
    if (!resendBtn) return;
    
    clearInterval(resendTimer);
    resendBtn.disabled = true;
    resendBtn.style.opacity = '0.35';
    let timeLeft = remainingSec;
    resendBtn.textContent = `available again in ${timeLeft}s`;

    resendTimer = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
            clearInterval(resendTimer);
            resendBtn.disabled = false;
            resendBtn.style.opacity = '1';
            resendBtn.textContent = 'resend email';
            localStorage.removeItem('sentinel_resend_unlock');
        } else {
            resendBtn.textContent = `available again in ${timeLeft}s`;
        }
    }, 1000);
};

window.handleResend = async () => {
    const s = getSupabase();
    const resendBtn = document.getElementById('resend-btn');
    const email = sessionStorage.getItem('sentinel_pending_email');

    if (!email || !s || resendBtn.disabled) return;

    resendBtn.disabled = true;
    resendBtn.textContent = 'dispatching...';

    try {
        const { error } = await s.auth.resend({
            type: 'signup', email: email,
            options: { emailRedirectTo: window.location.origin + '/auth?verified=true' }
        });
        if (error) {
            resendBtn.textContent = 'error: locked';
            setTimeout(() => { resendBtn.disabled = false; resendBtn.textContent = 'resend email'; }, 3000);
        } else {
            resendBtn.textContent = 'email sent!';
            const unlockTimestamp = Date.now() + 60000;
            localStorage.setItem('sentinel_resend_unlock', unlockTimestamp);
            setTimeout(() => startResendCooldown(60), 1500);
        }
    } catch (err) { console.error('[auth] resend fault'); }
};

// 3. BOOTSTRAP (Events & Initialization)
document.addEventListener('DOMContentLoaded', () => {
    console.log('[auth] initialization v16.1 starting...');
    getSupabase();

    // Check Persistent State
    const storedTab = sessionStorage.getItem('sentinel_auth_tab');
    if (storedTab === 'register') {
        window.switchManual('register');
    }

    // Cooldown restore
    const unlockAt = localStorage.getItem('sentinel_resend_unlock');
    if (unlockAt) {
        const remaining = Math.ceil((parseInt(unlockAt) - Date.now()) / 1000);
        if (remaining > 0) startResendCooldown(remaining);
    }

    // Verified Link Check
    const params = new URLSearchParams(window.location.search);
    if (params.get('verified') === 'true') {
        const authPanel = document.getElementById('auth-panel');
        const verifiedState = document.getElementById('auth-verified-state');
        if (authPanel) authPanel.style.display = 'none';
        if (verifiedState) verifiedState.style.display = 'flex';
    }

    // Form Event Listeners
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
            btn.textContent = 'processing...';
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

    // EYE Toggle RESTORE
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

    // Socials
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

    console.log('[auth] stabilization v16.1 complete.');
});
