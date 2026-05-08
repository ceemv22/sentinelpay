// 0. S-Tier Global Error Monitor (Catch silent crashes)
window.onerror = (msg, url, line) => {
    const errorMsg = `[sentinel-critical] JS Error: ${msg} at ${url}:${line}`;
    console.error(errorMsg);
    showStatus(errorMsg, 'error');
};
window.onunhandledrejection = (event) => {
    const errorMsg = `[sentinel-critical] Unhandled Promise Rejection: ${event.reason}`;
    console.error(errorMsg);
    showStatus(errorMsg, 'error');
};

// 0. S-Tier UI Status Overlay (Visible feedback for hydration)
const showStatus = (msg, type = 'info') => {
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

// 0. Pre-Flight State Capture
const initialSearch = window.location.search;
const initialHash = window.location.hash;

const supabaseUrl = 'https://aivqwkgjdpklxxuvkxpy.supabase.co';
const supabaseKey = 'sb_publishable_bRfAssaGT6D8oFDQtPARbw_5fyYGWM6';

showStatus('initializing security subsystem...');

const sentinelAuth = window.supabase.createClient(supabaseUrl, supabaseKey, {
    auth: {
        flowType: 'pkce',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});

let isInitialized = false;
let authStartTime = Date.now();

// 1. Setup Auth Listener
sentinelAuth.auth.onAuthStateChange(async (event, session) => {
    console.log('[sentinel-dashboard] auth event:', event, !!session);
    showStatus(`auth event: ${event}`);
    
    if (session) {
        if (!isInitialized) {
            isInitialized = true;
            console.log('[sentinel-dashboard] session stabilized via onAuthStateChange, rendering...');
            showStatus('session verified, loading profile...', 'success');
            renderDashboard(session);
            setTimeout(scrubHash, 5000); 
        }
        return;
    }

    if (event === 'SIGNED_OUT' && (Date.now() - authStartTime > 20000)) {
        console.warn('[sentinel-dashboard] truly signed out, redirecting');
        window.location.href = '/auth?reason=signed_out';
    }
});

const scrubHash = () => {
    try {
        const url = new URL(window.location.href);
        if (url.search || url.hash) {
            window.history.replaceState(null, document.title, url.pathname);
            console.log('[sentinel-dashboard] URL scrubbed clean.');
        }
    } catch (e) {
        console.warn('[sentinel] scrubHash failed');
    }
};

const checkSession = async () => {
    try {
        const { data: { session }, error } = await sentinelAuth.auth.getSession();
        if (error) throw error;
        console.log('[sentinel-dashboard] checkSession session:', !!session);
        if (session) {
            if (!isInitialized) {
                isInitialized = true;
                console.log('[sentinel-dashboard] initializing from checkSession');
                showStatus('session found, launching...', 'success');
                renderDashboard(session);
                setTimeout(scrubHash, 5000);
            }
            return true;
        }
        return false;
    } catch (err) {
        console.error('[sentinel-dashboard] checkSession error:', err);
        return false;
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[sentinel-dashboard] v-19 loader active (ULTIMATE RESILIENCE)');
    
    // Main Hydration Logic
    (async () => {
        const hasSession = await checkSession();
        if (hasSession) return;

        const isAuthRedirect = initialSearch.includes('code=') || initialHash.includes('code=') || initialHash.includes('access_token=');

        if (isAuthRedirect) {
            showStatus('exchanging security tokens...');
            console.log('[sentinel-dashboard] auth redirect detected, waiting for exchange...');
            
            // Patient retry loop for PKCE exchange
            for (let i = 0; i < 40; i++) {
                await new Promise(r => setTimeout(r, 1000));
                showStatus(`verifying identity (attempt ${i+1}/40)...`);
                const sessionFound = await checkSession();
                if (isInitialized || sessionFound) {
                    return;
                }
            }
            
            showStatus('identity verification timed out', 'error');
            setTimeout(() => window.location.href = '/auth?error=hydration_timeout', 3000);
        } else {
            // Normal load: Wait 10s then bounce
            setTimeout(async () => {
                if (!isInitialized && !(await checkSession())) {
                    showStatus('no session found, redirecting to login...', 'error');
                    setTimeout(() => window.location.href = '/auth', 2000);
                }
            }, 10000);
        }
    })();

    // 3. Logout Logic
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.onclick = async (e) => {
            e.preventDefault();
            showStatus('signing out...');
            await sentinelAuth.auth.signOut();
            window.location.href = '/auth';
        };
    }

    // --- Setup Sidebar State Toggle ---
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebarPopup = document.getElementById('sidebar-popup');
    if (sidebarToggle && sidebarPopup) {
        sidebarToggle.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            sidebarPopup.classList.toggle('active');
        });
        document.addEventListener('click', (e) => {
            if (!sidebarToggle.contains(e.target) && !sidebarPopup.contains(e.target)) sidebarPopup.classList.remove('active');
        });
        sidebarPopup.querySelectorAll('.state-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                sidebarPopup.querySelectorAll('.state-option').forEach(opt => opt.classList.remove('active'));
                option.classList.add('active');
                const state = option.getAttribute('data-state');
                document.body.classList.remove('sidebar-expanded', 'sidebar-collapsed');
                if (state === 'expanded') document.body.classList.add('sidebar-expanded');
                else if (state === 'collapsed') document.body.classList.add('sidebar-collapsed');
                setTimeout(() => sidebarPopup.classList.remove('active'), 150);
            });
        });
    }

    async function renderDashboard(session) {
        const token = session.access_token;
        const user = session.user;
        
        // --- 1. Immediate Avatar Update ---
        let displayIdentifier = user.email || '';
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
            document.addEventListener('click', (e) => {
                if (!menuTrigger.contains(e.target) && !dropdownMenu.contains(e.target)) dropdownMenu.classList.remove('active');
            });
        }

        // Setup API Key Modal
        const badgeEl = document.getElementById('header-api-key');
        const modal = document.getElementById('api-modal-overlay');
        const closeBtn = document.getElementById('btn-close-api-modal');
        const modalDisplay = document.getElementById('modal-api-key-display');
        const copyBtn = document.getElementById('modal-btn-copy');
        let cachedFullKey = null;

        if (badgeEl && modal && !badgeEl.dataset.initialized) {
            badgeEl.dataset.initialized = "true";
            badgeEl.onclick = async (e) => {
                e.preventDefault();
                document.body.classList.add('modal-open');
                modal.style.display = 'flex';
                setTimeout(() => modal.classList.add('active'), 10);
                if (cachedFullKey) {
                    const suffix = cachedFullKey.slice(-4);
                    modalDisplay.textContent = `sp_live_••••••••••••••••••••••••${suffix}`;
                } else {
                    await fetchHeaderApiKey(token, (fullKey) => {
                        cachedFullKey = fullKey;
                        const suffix = fullKey.slice(-4);
                        modalDisplay.textContent = `sp_live_••••••••••••••••••••••••${suffix}`;
                    });
                }
            };
            closeBtn.onclick = () => {
                document.body.classList.remove('modal-open');
                modal.classList.remove('active');
                setTimeout(() => modal.style.display = 'none', 300);
            };
        }

        fetchHeaderApiKey(token, (fullKey) => cachedFullKey = fullKey);
        fetchProfile(token);
    }

    async function fetchHeaderApiKey(token, onKeyFetched) {
        const suffixEl = document.getElementById('api-key-suffix');
        const cachedSuffix = localStorage.getItem('sentinel_key_suffix');
        if (cachedSuffix && suffixEl) suffixEl.textContent = cachedSuffix;
        try {
            const res = await fetch('/v1/user/api-key/reveal', { headers: { 'Authorization': `Bearer ${token}` } });
            const result = await res.json();
            if (res.ok && result.apiKey) {
                const last4 = result.apiKey.slice(-4);
                if (suffixEl) suffixEl.textContent = last4;
                localStorage.setItem('sentinel_key_suffix', last4);
                if (onKeyFetched) onKeyFetched(result.apiKey);
            }
        } catch (err) { console.error('API key fetch error:', err); }
    }

    async function fetchProfile(token) {
        try {
            const response = await fetch('/v1/user/profile', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to load profile');
            }
            const data = await response.json();
            
            // Render Orgs
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
                        card.onclick = () => { /* enter dash */ };
                        orgCardsGrid.appendChild(card);
                    });
                }
            }
            document.body.classList.add('state-org-home');
        } catch (err) {
            console.error('Profile fetch error:', err);
            showStatus(`Error: ${err.message}`, 'error');
        }
    }
});
