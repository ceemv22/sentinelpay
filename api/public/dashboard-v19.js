// 0. S-Tier Global Error Monitor
window.onerror = (msg, url, line) => {
    const errorMsg = `[sentinel-critical] JS Error: ${msg} at ${url}:${line}`;
    console.error(errorMsg);
    if (window.showStatus) showStatus(errorMsg, 'error');
};
window.onunhandledrejection = (event) => {
    const errorMsg = `[sentinel-critical] Unhandled Promise Rejection: ${event.reason}`;
    console.error(errorMsg);
    if (window.showStatus) showStatus(errorMsg, 'error');
};

// 0. S-Tier UI Status Overlay
window.showStatus = (msg, type = 'info') => {
    let overlay = document.getElementById('sentinel-status-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'sentinel-status-overlay';
        overlay.style.cssText = 'position:fixed;bottom:20px;right:20px;padding:12px 20px;background:rgba(0,0,0,0.8);backdrop-filter:blur(10px);border:1px solid rgba(0,240,255,0.2);border-radius:12px;color:#00f0ff;font-family:JetBrains Mono,monospace;font-size:0.75rem;z-index:99999;box-shadow:0 10px 30px rgba(0,0,0,0.5);pointer-events:none;transition:all 0.3s ease;';
        document.body.appendChild(overlay);
    }
    overlay.style.borderColor = type === 'error' ? 'rgba(255,51,51,0.4)' : 'rgba(0,240,255,0.2)';
    overlay.style.color = type === 'error' ? '#ff3333' : '#00f0ff';
    overlay.textContent = msg;
    if (type === 'success') setTimeout(() => overlay.remove(), 5000);
};

// 1. GLOBAL STATE
const supabaseUrl = 'https://aivqwkgjdpklxxuvkxpy.supabase.co';
const supabaseKey = 'sb_publishable_bRfAssaGT6D8oFDQtPARbw_5fyYGWM6';
let sentinelAuth = null;
let isInitialized = false;
let authStartTime = Date.now();

const initialSearch = window.location.search;
const initialHash = window.location.hash;

// 2. CORE LOGIC
const scrubHash = () => {
    try {
        const url = new URL(window.location.href);
        if (url.search || url.hash) {
            window.history.replaceState(null, document.title, url.pathname);
            console.log('[sentinel-dashboard] URL scrubbed.');
        }
    } catch (e) {}
};

const checkSession = async () => {
    if (!sentinelAuth) return false;
    try {
        const { data: { session }, error } = await sentinelAuth.auth.getSession();
        if (error) throw error;
        if (session && !isInitialized) {
            isInitialized = true;
            showStatus('session confirmed, loading...', 'success');
            renderDashboard(session);
            setTimeout(scrubHash, 5000);
            return true;
        }
        return !!session;
    } catch (err) {
        console.error('[sentinel-dashboard] checkSession error:', err);
        return false;
    }
};

const startHydration = async () => {
    // RESOLVE SDK RACE CONDITION
    let sdk = window.supabase;
    if (!sdk && typeof supabase !== 'undefined') sdk = supabase;
    
    if (!sdk) {
        showStatus('CRITICAL: SDK not found. Refreshing in 3s...', 'error');
        setTimeout(() => window.location.reload(), 3000);
        return;
    }

    showStatus('booting v19.1-resilience...');

    try {
        sentinelAuth = sdk.createClient(supabaseUrl, supabaseKey, {
            auth: {
                flowType: 'pkce',
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true
            }
        });
    } catch (e) {
        showStatus('SDK INIT FAILED: ' + e.message, 'error');
        return;
    }

    // 1. Setup Auth Listener
    sentinelAuth.auth.onAuthStateChange(async (event, session) => {
        console.log('[sentinel-dashboard] auth event:', event, !!session);
        showStatus(`auth event: ${event}`);
        
        if (session && !isInitialized) {
            isInitialized = true;
            showStatus('session verified!', 'success');
            renderDashboard(session);
            setTimeout(scrubHash, 5000); 
        }

        if (event === 'SIGNED_OUT' && (Date.now() - authStartTime > 30000)) {
            window.location.href = '/auth?reason=signed_out';
        }
    });

    // 2. Hydration Flow
    (async () => {
        showStatus('probing for session...');
        const hasSession = await checkSession();
        if (hasSession) return;

        const urlParams = new URLSearchParams(initialSearch || initialHash.substring(1));
        const code = urlParams.get('code');
        const isAuthRedirect = !!code || initialHash.includes('access_token=');

        if (isAuthRedirect) {
            if (code) {
                showStatus('exchanging security code...');
                try {
                    const { data, error } = await sentinelAuth.auth.exchangeCodeForSession(code);
                    if (error) throw error;
                    if (data.session && !isInitialized) {
                        isInitialized = true;
                        showStatus('identity confirmed!', 'success');
                        renderDashboard(data.session);
                        setTimeout(scrubHash, 5000);
                        return;
                    }
                } catch (e) {
                    showStatus(`exchange failed: ${e.message}`, 'error');
                }
            }

            for (let i = 0; i < 30; i++) {
                await new Promise(r => setTimeout(r, 1000));
                showStatus(`syncing (attempt ${i+1}/30)...`);
                if (isInitialized || await checkSession()) return;
            }
            showStatus('hydration timeout', 'error');
            setTimeout(() => window.location.href = '/auth?error=hydration_timeout', 3000);
        } else {
            showStatus('unauthenticated guest', 'info');
            setTimeout(async () => {
                if (!isInitialized && !(await checkSession())) {
                    window.location.href = '/auth';
                }
            }, 10000);
        }
    })();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startHydration);
} else {
    startHydration();
}

// UI HELPERS
const logoutBtn = document.getElementById('btn-logout');
if (logoutBtn) {
    logoutBtn.onclick = async (e) => {
        e.preventDefault();
        showStatus('signing out...');
        if (sentinelAuth) await sentinelAuth.auth.signOut();
        window.location.href = '/auth';
    };
}

async function renderDashboard(session) {
    try {
        const token = session.access_token;
        const user = session.user;
        
        let displayIdentifier = user.email || 'authenticated user';
        let avatarInitial = '?';
        if (user.user_metadata) {
            if (user.user_metadata.user_name) {
                displayIdentifier = `@${user.user_metadata.user_name}`;
                avatarInitial = user.user_metadata.user_name.charAt(0);
            } else if (user.user_metadata.full_name) {
                avatarInitial = user.user_metadata.full_name.charAt(0);
            }
        }
        if (avatarInitial === '?' && displayIdentifier) avatarInitial = displayIdentifier.charAt(0);
        
        const avatarEl = document.getElementById('org-avatar-circle');
        if (avatarEl) avatarEl.textContent = avatarInitial.toUpperCase();
        const dropdownEmailEl = document.getElementById('dropdown-email');
        if (dropdownEmailEl) dropdownEmailEl.textContent = displayIdentifier;

        const menuTrigger = document.getElementById('user-menu-trigger');
        const dropdownMenu = document.getElementById('user-dropdown');
        if (menuTrigger && dropdownMenu && !menuTrigger.dataset.initialized) {
            menuTrigger.dataset.initialized = "true";
            menuTrigger.onclick = (e) => {
                e.preventDefault(); e.stopPropagation();
                dropdownMenu.classList.toggle('active');
            };
        }

        fetchHeaderApiKey(token);
        fetchProfile(token);
    } catch (e) {
        showStatus('render error: ' + e.message, 'error');
    }
}

async function fetchHeaderApiKey(token) {
    const suffixEl = document.getElementById('api-key-suffix');
    try {
        const res = await fetch('/v1/user/api-key/reveal', { headers: { 'Authorization': `Bearer ${token}` } });
        const result = await res.json();
        if (res.ok && result.apiKey && suffixEl) {
            suffixEl.textContent = result.apiKey.slice(-4);
        }
    } catch (err) {}
}

async function fetchProfile(token) {
    try {
        const response = await fetch('/v1/user/profile', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error('profile sync failed');
        const data = await response.json();
        
        const orgsRes = await fetch('/v1/organizations', { headers: { 'Authorization': `Bearer ${token}` } });
        const orgs = await orgsRes.json();
        const orgCardsGrid = document.querySelector('.org-cards-grid');
        if (orgCardsGrid) {
            orgCardsGrid.innerHTML = '';
            if (orgs.length === 0) {
                orgCardsGrid.innerHTML = '<div class="empty-state">no organizations found.</div>';
            } else {
                orgs.forEach(org => {
                    const card = document.createElement('div');
                    card.className = 'org-card-item';
                    card.innerHTML = `<span>${org.name}</span>`;
                    orgCardsGrid.appendChild(card);
                });
            }
        }
        document.body.classList.add('state-org-home');
        showStatus('dashboard ready', 'success');
    } catch (err) {
        showStatus(`profile error: ${err.message}`, 'error');
    }
}
