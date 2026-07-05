const supabaseUrl = 'https://aivqwkgjdpklxxuvkxpy.supabase.co';
const supabaseKey = 'sb_publishable_bRfAssaGT6D8oFDQtPARbw_5fyYGWM6';
let s = null;

const getSupabase = () => {
    if (s) return s;
    if (window.supabase) {
        s = window.supabase.createClient(supabaseUrl, supabaseKey, {
            auth: { flowType: 'pkce', autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
        });
        return s;
    }
    return null;
};

document.addEventListener('DOMContentLoaded', async () => {
    const supabase = getSupabase();
    if (!supabase) return;

    const form = document.getElementById('reset-password-form');
    const invalidState = document.getElementById('reset-invalid-state');
    const introText = document.getElementById('reset-intro-text');
    const successState = document.getElementById('reset-success-state');

    const cleanURL = () => {
        if (window.location.href.indexOf('#') > -1 || window.location.href.indexOf('code=') > -1) {
            const url = new URL(window.location.href);
            url.searchParams.delete('code');
            window.history.replaceState(null, document.title, url.pathname);
        }
    };

    const redirectToAuth = (msg) => {
        sessionStorage.setItem('sentinel_pending_toast', msg);
        window.location.replace('/auth');
    };

    const urlSearch = new URLSearchParams(window.location.search);
    const urlHash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const urlError = urlSearch.get('error') || urlHash.get('error');
    const urlErrorCode = urlSearch.get('error_code') || urlHash.get('error_code');

    if (urlError) {
        const msg = urlErrorCode === 'otp_expired'
            ? 'recovery link expired or already used.'
            : 'reset link is invalid. request a new one.';
        redirectToAuth(msg);
        return;
    }

    const isRecoveryRedirect = window.location.search.includes('code=');
    let sessionValidated = false;

    const validateSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            sessionValidated = true;
            form.style.display = 'flex';
            cleanURL();
            return true;
        }
        return false;
    };

    if (isRecoveryRedirect) {
        let attempts = 0;
        const interval = setInterval(async () => {
            attempts++;
            const ok = await validateSession();
            if (ok || attempts > 10) {
                clearInterval(interval);
                if (!ok) redirectToAuth('recovery link expired or already used.');
            }
        }, 500);
    } else {
        const ok = await validateSession();
        if (!ok) redirectToAuth('reset link is invalid. request a new one.');
    }

    if (form) {
        let isSubmitting = false;
        form.onsubmit = async (e) => {
            e.preventDefault();
            if (isSubmitting) return;

            const pw = document.getElementById('new-password').value;
            const confirm = document.getElementById('confirm-password').value;
            const btn = document.getElementById('reset-submit-btn');
            const errorMsg = document.getElementById('reset-error-msg');
            
            if (pw !== confirm) {
                errorMsg.textContent = 'error: passwords do not match';
                errorMsg.style.display = 'block';
                return;
            }

            if (pw.length < 8 || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw)) {
                errorMsg.textContent = 'error: security requirements not met';
                errorMsg.style.display = 'block';
                return;
            }

            try {
                isSubmitting = true;
                btn.disabled = true;
                btn.textContent = 'updating key...';
                errorMsg.style.display = 'none';

                const { error } = await supabase.auth.updateUser({ password: pw });

                if (error) {
                    errorMsg.textContent = 'error: ' + error.message.toLowerCase();
                    errorMsg.style.display = 'block';
                    btn.disabled = false;
                    btn.textContent = 'update security key';
                } else {
                    if (introText) introText.style.display = 'none';
                    form.style.display = 'none';
                    successState.style.display = 'flex';
                    const tabs = document.querySelector('.auth-tabs');
                    if (tabs) tabs.style.display = 'none';
                    await supabase.auth.signOut();
                }
            } catch (err) { console.error(err); }
            finally { isSubmitting = false; }
        };
    }

    document.querySelectorAll('.pw-eye-toggle').forEach(btn => {
        btn.onclick = () => {
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
        };
    });

    const bind = (id, url) => {
        const el = document.getElementById(id);
        if (el) el.onclick = () => window.location.href = url;
    };
    bind('reset-login-btn', '/auth');
    bind('back-to-login-invalid', '/auth');

    const toggle = document.getElementById('pw-rules-toggle');
    const tooltip = document.getElementById('pw-rules-tooltip');
    if (toggle && tooltip) {
        toggle.onmouseenter = () => tooltip.classList.add('visible');
        toggle.onmouseleave = () => tooltip.classList.remove('visible');
    }

    const newPwInput = document.getElementById('new-password');
    if (newPwInput) {
        newPwInput.oninput = (e) => {
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
