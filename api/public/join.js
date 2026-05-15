// SentinelPay Join Logic (v1.0)
// S-Tier Invitation Handling

const supabaseUrl = 'https://aivqwkgjdpklxxuvkxpy.supabase.co';
const supabaseKey = 'sb_publishable_bRfAssaGT6D8oFDQtPARbw_5fyYGWM6';
const API_URL = window.location.origin;

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const slug = params.get('slug');
    const name = params.get('name');

    if (!token || !slug) {
        if (window.SentinelToast) window.SentinelToast.show("invalid or expired invitation link.", "error");
        setTimeout(() => window.location.href = '/', 3000);
        return;
    }

    // Initialize Supabase
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
    const { data: { session } } = await supabase.auth.getSession();

    const joinCard = document.getElementById('join-card');
    const joinSubtitle = document.getElementById('join-subtitle');
    const btnLogin = document.getElementById('btn-join-login');
    const btnRegister = document.getElementById('btn-join-register');
    const acceptSection = document.getElementById('accept-section');
    const btnAccept = document.getElementById('btn-accept-invite');
    
    // Auth UI buttons (Sign in / Create Account)
    const authButtons = btnLogin.parentElement;

    if (session) {
        // USER LOGGED IN: Show Accept Screen
        authButtons.style.display = 'none';
        joinSubtitle.style.display = 'none';
        acceptSection.style.display = 'flex';
        
        document.getElementById('inviter-name').textContent = name || 'a team member';
        document.getElementById('org-slug-name').textContent = slug;

        btnAccept.onclick = async () => {
            try {
                btnAccept.disabled = true;
                btnAccept.textContent = 'joining...';

                const response = await fetch(`${API_URL}/v1/organizations/${slug}/team/join`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({ token })
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || 'failed to join organization');
                }

                if (window.SentinelToast) window.SentinelToast.show("successfully joined the team!", "success");
                setTimeout(() => window.location.href = `/dashboard/org/${slug}/team`, 1500);
            } catch (err) {
                if (window.SentinelToast) window.SentinelToast.show(err.message, "error");
                btnAccept.disabled = false;
                btnAccept.textContent = 'accept and join team';
            }
        };
    } else {
        // USER NOT LOGGED IN: Show Gatekeeper Screen
        btnLogin.onclick = () => {
            sessionStorage.setItem('sentinel_join_token', token);
            sessionStorage.setItem('sentinel_join_slug', slug);
            sessionStorage.setItem('sentinel_join_name', name);
            window.location.href = '/auth#login';
        };

        btnRegister.onclick = () => {
            sessionStorage.setItem('sentinel_join_token', token);
            sessionStorage.setItem('sentinel_join_slug', slug);
            sessionStorage.setItem('sentinel_join_name', name);
            window.location.href = '/auth#register';
        };
    }
});
