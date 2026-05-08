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
    if (window.silentMode && type === 'info') return; // Bypass noise for healthy users
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
    if (type === 'success') setTimeout(() => { if (overlay) overlay.remove(); }, 3000);
};

// 1. GLOBAL STATE
const supabaseUrl = 'https://aivqwkgjdpklxxuvkxpy.supabase.co';
const supabaseKey = 'sb_publishable_bRfAssaGT6D8oFDQtPARbw_5fyYGWM6';
let sentinelAuth = null;
let isInitialized = false;
let authStartTime = Date.now();
window.silentMode = false;

const initialSearch = window.location.search;
const initialHash = window.location.hash;

// 2. CORE LOGIC
const scrubHash = () => {
    try {
        const url = new URL(window.location.href);
        if (url.search || url.hash) {
            window.history.replaceState(null, document.title, url.pathname);
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
            renderDashboard(session);
            setTimeout(scrubHash, 1000);
            return true;
        }
        return !!session;
    } catch (err) {
        return false;
    }
};

const startHydration = async () => {
    let sdk = window.supabase || (typeof supabase !== 'undefined' ? supabase : null);
    if (!sdk) {
        showStatus('SDK not found. Retrying...', 'error');
        setTimeout(() => window.location.reload(), 2000);
        return;
    }

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
        showStatus('SDK INIT ERROR', 'error');
        return;
    }

    // 1. Setup Auth Listener (Immediate catch)
    sentinelAuth.auth.onAuthStateChange(async (event, session) => {
        if (session && !isInitialized) {
            isInitialized = true;
            renderDashboard(session);
            setTimeout(scrubHash, 1000); 
        }
        if (event === 'SIGNED_OUT' && (Date.now() - authStartTime > 30000)) {
            window.location.href = '/auth';
        }
    });

    // 2. Hydration Flow
    const hasSession = await checkSession();
    if (hasSession) {
        window.silentMode = true; // No more messages needed
        return;
    }

    const urlParams = new URLSearchParams(initialSearch || initialHash.substring(1));
    const code = urlParams.get('code');
    const isAuthRedirect = !!code || initialHash.includes('access_token=');

    if (isAuthRedirect) {
        showStatus('finalizing identity...', 'info');
        if (code) {
            try {
                const { data, error } = await sentinelAuth.auth.exchangeCodeForSession(code);
                if (error) throw error;
                if (data.session && !isInitialized) {
                    isInitialized = true;
                    renderDashboard(data.session);
                    setTimeout(scrubHash, 1000);
                    return;
                }
            } catch (e) {
                showStatus(`handshake failed: ${e.message}`, 'error');
            }
        }

        // Loop fallback (Faster)
        for (let i = 0; i < 15; i++) {
            await new Promise(r => setTimeout(r, 400));
            if (isInitialized || await checkSession()) return;
        }
        window.location.href = '/auth?error=timeout';
    } else {
        // Normal guest load
        setTimeout(async () => {
            if (!isInitialized && !(await checkSession())) {
                window.location.href = '/auth';
            }
        }, 5000);
    }
};

// BOOT IMMEDIATELY
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
        if (sentinelAuth) await sentinelAuth.auth.signOut();
        window.location.href = '/auth';
    };
}

async function renderDashboard(session) {
    try {
        const token = session.access_token;
        const user = session.user;
        
        // Immediate UI preparation
        let displayIdentifier = user.email || 'user';
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

        // Parallel Fetch
        await Promise.all([
            fetchHeaderApiKey(token),
            fetchProfile(token)
        ]);

        showStatus('Dashboard Ready', 'success');
    } catch (e) {
        showStatus('Render Error', 'error');
    }
}

async function fetchHeaderApiKey(token) {
    try {
        const res = await fetch('/v1/user/api-key/reveal', { headers: { 'Authorization': `Bearer ${token}` } });
        const result = await res.json();
        const suffixEl = document.getElementById('api-key-suffix');
        if (res.ok && result.apiKey && suffixEl) {
            suffixEl.textContent = result.apiKey.slice(-4);
        }
    } catch (err) {}
}

async function fetchProfile(token) {
    try {
        const response = await fetch('/v1/user/profile', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error();
        
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
    } catch (err) {}
}
