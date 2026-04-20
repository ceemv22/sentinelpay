const supabaseUrl = 'https://aivqwkgjdpklxxuvkxpy.supabase.co';
const supabaseKey = 'sb_publishable_bRfAssaGT6D8oFDQtPARbw_5fyYGWM6';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', () => {
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const submitBtn = document.getElementById('auth-submit-btn');
    const authForm = document.getElementById('auth-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const errorMsg = document.getElementById('auth-error-msg');
    const authPanel = document.getElementById('auth-panel');
    const successState = document.getElementById('auth-success-state');

    let isLogin = true;

    // Smooth fade helper
    const formContent = authPanel.querySelector('.auth-social');
    const formFields = authPanel.querySelector('.auth-form');
    const divider = authPanel.querySelector('.auth-divider');
    const animTargets = [formContent, formFields, divider].filter(Boolean);

    function animateTabSwitch(callback) {
        animTargets.forEach(el => {
            el.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
            el.style.opacity = '0';
            el.style.transform = 'translateY(8px)';
        });
        setTimeout(() => {
            callback();
            animTargets.forEach(el => {
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            });
        }, 200);
    }

    // Tab switching
    tabLogin.addEventListener('click', () => {
        if (isLogin) return;
        animateTabSwitch(() => {
            isLogin = true;
            tabLogin.classList.add('active');
            tabRegister.classList.remove('active');
            submitBtn.textContent = 'login';
            errorMsg.style.display = 'none';
            passwordInput.style.display = 'block';
            passwordInput.previousElementSibling.style.display = 'block';
            passwordInput.required = true;
        });
    });

    tabRegister.addEventListener('click', () => {
        if (!isLogin) return;
        animateTabSwitch(() => {
            isLogin = false;
            tabRegister.classList.add('active');
            tabLogin.classList.remove('active');
            submitBtn.textContent = 'send magic link';
            errorMsg.style.display = 'none';
            // For registration, we will use Magic Link for highest conversion & S-Tier security
            passwordInput.style.display = 'none';
            passwordInput.previousElementSibling.style.display = 'none';
            passwordInput.required = false;
        });
    });

    // Handle initial state from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('tab') === 'register') {
        tabRegister.click();
    }

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = emailInput.value;
        const password = passwordInput.value;

        submitBtn.textContent = 'processing...';
        submitBtn.disabled = true;
        errorMsg.style.display = 'none';

        try {
            if (isLogin) {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });

                if (error) throw error;
                
                // Success login, redirect to dashboard
                window.location.href = '/dashboard';
            } else {
                // Register via Magic Link
                const { data, error } = await supabase.auth.signInWithOtp({
                    email,
                    options: {
                        emailRedirectTo: window.location.origin + '/dashboard'
                    }
                });

                if (error) throw error;

                // Show success state
                authPanel.style.display = 'none';
                successState.style.display = 'block';
            }
        } catch (error) {
            errorMsg.textContent = error.message;
            errorMsg.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = isLogin ? 'login' : 'send magic link';
        }
    });

    // Social Logins
    document.getElementById('btn-google').addEventListener('click', async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/dashboard'
            }
        });
    });

    document.getElementById('btn-x').addEventListener('click', async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'twitter',
            options: {
                redirectTo: window.location.origin + '/dashboard'
            }
        });
    });
});
