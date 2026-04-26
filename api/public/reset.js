const supabaseUrl = 'https://aivqwkgjdpklxxuvkxpy.supabase.co';
const supabaseKey = 'sb_publishable_bRfAssaGT6D8oFDQtPARbw_5fyYGWM6';
let s = null;

const getSupabase = () => {
    if (s) return s;
    if (window.supabase) {
        s = window.supabase.createClient(supabaseUrl, supabaseKey);
        return s;
    }
    return null;
};

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[reset] security handshake protocol initiated...');
    const supabase = getSupabase();
    const form = document.getElementById('reset-password-form');
    const invalidState = document.getElementById('reset-invalid-state');
    const introText = document.getElementById('reset-intro-text');
    
    // Check for recovery session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (session) {
        console.log('[reset] recovery session validated.');
        form.style.display = 'flex';
        
        // Clean URL: Remove the heavy Supabase hash tokens for a premium experience
        if (window.location.hash) {
            window.history.replaceState(null, null, window.location.pathname);
        }
    } else {
        console.warn('[reset] invalid or expired recovery bridge.');
        if (introText) introText.style.display = 'none';
        if (invalidState) invalidState.style.display = 'block';
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

    // Form logic
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const pw = document.getElementById('new-password').value;
            const confirm = document.getElementById('confirm-password').value;
            const btn = document.getElementById('reset-submit-btn');
            const errorMsg = document.getElementById('reset-error-msg');
            
            if (pw !== confirm) {
                errorMsg.textContent = 'error: passwords do not match';
                errorMsg.style.display = 'block';
                return;
            }

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
                // Success
                if (introText) introText.style.display = 'none';
                form.style.display = 'none';
                document.getElementById('reset-success-state').style.display = 'flex';
                
                // Clean up session immediately for security
                await supabase.auth.signOut();
            }
        });
    }

    const loginBtn = document.getElementById('reset-login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            window.location.href = '/auth';
        });
    }

    // Tooltip logic
    const toggle = document.getElementById('pw-rules-toggle');
    const tooltip = document.getElementById('pw-rules-tooltip');
    if (toggle && tooltip) {
        toggle.addEventListener('mouseenter', () => tooltip.classList.add('visible'));
        toggle.addEventListener('mouseleave', () => tooltip.classList.remove('visible'));
    }

    // Password Rules Real-time
    const newPw = document.getElementById('new-password');
    if (newPw) {
        newPw.addEventListener('input', (e) => {
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
});
