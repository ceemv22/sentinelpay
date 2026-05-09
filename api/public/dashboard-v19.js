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

// 0. S-Tier UI Status Overlay (Only for Errors now)
window.showStatus = (msg, type = 'info') => {
    if (type !== 'error') return; // Silent mode for everything except critical failures
    
    let overlay = document.getElementById('sentinel-status-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'sentinel-status-overlay';
        overlay.style.cssText = 'position:fixed;bottom:20px;right:20px;padding:12px 20px;background:rgba(0,0,0,0.8);backdrop-filter:blur(10px);border:1px solid rgba(255,51,51,0.4);border-radius:12px;color:#ff3333;font-family:JetBrains Mono,monospace;font-size:0.75rem;z-index:99999;box-shadow:0 10px 30px rgba(0,0,0,0.5);pointer-events:none;transition:all 0.3s ease;';
        document.body.appendChild(overlay);
    }
    overlay.textContent = msg;
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
            setTimeout(scrubHash, 500);
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
        setTimeout(startHydration, 100);
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
        return;
    }

    sentinelAuth.auth.onAuthStateChange(async (event, session) => {
        if (session && !isInitialized) {
            isInitialized = true;
            renderDashboard(session);
            setTimeout(scrubHash, 500); 
        }
        if (event === 'SIGNED_OUT' && (Date.now() - authStartTime > 30000)) {
            window.location.href = '/auth';
        }
    });

    const hasSession = await checkSession();
    if (hasSession) return;

    const urlParams = new URLSearchParams(initialSearch || initialHash.substring(1));
    const code = urlParams.get('code');
    const isAuthRedirect = !!code || initialHash.includes('access_token=');

    if (isAuthRedirect) {
        if (code) {
            try {
                const { data, error } = await sentinelAuth.auth.exchangeCodeForSession(code);
                if (error) throw error;
                if (data.session && !isInitialized) {
                    isInitialized = true;
                    renderDashboard(data.session);
                    setTimeout(scrubHash, 500);
                    return;
                }
            } catch (e) {
                showStatus(`Identity Error: ${e.message}`, 'error');
            }
        }
        for (let i = 0; i < 10; i++) {
            await new Promise(r => setTimeout(r, 200));
            if (isInitialized || await checkSession()) return;
        }
        window.location.href = '/auth?error=timeout';
    } else {
        setTimeout(async () => {
            if (!isInitialized && !(await checkSession())) {
                window.location.href = '/auth';
            }
        }, 4000);
    }
};

startHydration();

// UI HELPERS
const logoutBtn = document.getElementById('btn-logout');
if (logoutBtn) {
    logoutBtn.onclick = async (e) => {
        e.preventDefault();
        localStorage.removeItem('sentinel-cached-orgs');
        if (sentinelAuth) await sentinelAuth.auth.signOut();
        window.location.href = 'https://sentinelpay.org';
    };
}

function renderDashboard(session) {
    if (renderDashboard.busy) return;
    renderDashboard.busy = true;

    try {
        const token = session.access_token;
        const user = session.user;
        
        // 1. INSTANT UI STATE
        document.body.classList.add('state-org-home');

        // 2. Immediate Identifiers
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
                menuTrigger.classList.toggle('active');
                dropdownMenu.classList.toggle('active');
            };
        }

        // 3. CACHE LOOKUP
        const cachedOrgs = localStorage.getItem('sentinel-cached-orgs');
        const orgCardsGrid = document.querySelector('.org-cards-grid');
        if (orgCardsGrid) {
            if (cachedOrgs) {
                try {
                    const orgs = JSON.parse(cachedOrgs);
                    updateOrgGrid(orgs);
                } catch(e) {
                    orgCardsGrid.innerHTML = '<div class="sync-shimmer">syncing organizations...</div>';
                }
            } else {
                orgCardsGrid.innerHTML = '<div class="sync-shimmer">syncing organizations...</div>';
            }
        }

        // 4. BACKGROUND FETCH
        fetchHeaderApiKey(token);
        fetchProfile(token);

        // 5. MODAL INITIALIZATION
        setupCreateOrgModal(token);
    } catch (e) {
        showStatus('Render Error', 'error');
    } finally {
        renderDashboard.busy = false;
    }
}

function setupCreateOrgModal(token) {
    const modal = document.getElementById('create-org-modal-overlay');
    const openBtn = document.getElementById('mock-new-org-btn');
    const closeBtn = document.getElementById('btn-close-create-org');
    const form = document.getElementById('create-org-form');
    const errorEl = document.getElementById('create-org-error');
    const submitBtn = document.getElementById('btn-submit-org');

    if (!modal || !openBtn || !closeBtn || !form) return;
    if (openBtn.dataset.bound) return;
    openBtn.dataset.bound = "true";

    const openModal = () => {
        modal.classList.add('active');
        document.body.classList.add('modal-open');
        form.reset();
        errorEl.style.display = 'none';
        
        // Reset custom selects
        document.querySelectorAll('.sentinel-select-trigger').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.sentinel-select-dropdown').forEach(d => d.classList.remove('active'));
    };

    const closeModal = () => {
        modal.classList.remove('active');
        document.body.classList.remove('modal-open');
    };

    openBtn.onclick = (e) => { e.preventDefault(); openModal(); };
    closeBtn.onclick = (e) => { e.preventDefault(); closeModal(); };
    
    // Close on overlay click
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };

    // Custom Select Logic
    const initSelect = (idPrefix) => {
        const trigger = document.getElementById(`${idPrefix}-select-trigger`);
        const dropdown = document.getElementById(`${idPrefix}-select-dropdown`);
        const hiddenInput = document.getElementById(`org-${idPrefix}`);
        const options = dropdown.querySelectorAll('.sentinel-select-option');
        const displayVal = trigger.querySelector('.selected-value');

        trigger.onclick = (e) => {
            e.stopPropagation();
            // Close other selects
            document.querySelectorAll('.sentinel-select-trigger').forEach(t => { if(t!==trigger) t.classList.remove('active') });
            document.querySelectorAll('.sentinel-select-dropdown').forEach(d => { if(d!==dropdown) d.classList.remove('active') });
            
            trigger.classList.toggle('active');
            dropdown.classList.toggle('active');
        };

        options.forEach(opt => {
            opt.onclick = () => {
                options.forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                hiddenInput.value = opt.dataset.value;
                displayVal.textContent = opt.textContent;
                trigger.classList.remove('active');
                dropdown.classList.remove('active');
            };
        });
    };

    initSelect('plan');
    initSelect('region');

    // Global click to close selects
    document.addEventListener('click', () => {
        document.querySelectorAll('.sentinel-select-trigger').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.sentinel-select-dropdown').forEach(d => d.classList.remove('active'));
    });

    form.onsubmit = async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('org-name').value.trim();
        const plan = document.getElementById('org-plan').value;
        const region = document.getElementById('org-region').value;

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'initializing...';
            errorEl.style.display = 'none';

            const response = await fetch('/v1/organizations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name, plan, region })
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.code === 'name_taken') {
                    const random = Math.floor(100000 + Math.random() * 900000);
                    const rec = `${name.toLowerCase().replace(/\s+/g, '-')}-${random}`;
                    throw new Error(`name already taken. recommended: ${rec}`);
                }
                throw new Error(data.error || 'failed to create organization');
            }

            // Success
            if (window.SentinelToast) window.SentinelToast.show("organization created successfully.", "success");
            closeModal();
            
            // Refresh grid
            fetchProfile(token);
            
        } catch (err) {
            errorEl.textContent = `error: ${err.message.toLowerCase()}`;
            errorEl.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'create organization';
        }
    };
}

function updateOrgGrid(orgs) {
    const orgCardsGrid = document.querySelector('.org-cards-grid');
    if (!orgCardsGrid) return;
    
    orgCardsGrid.innerHTML = '';
    if (orgs.length === 0) {
        orgCardsGrid.innerHTML = '<div class="empty-state">no organizations found.</div>';
    } else {
        orgs.forEach(org => {
            const card = document.createElement('div');
            card.className = 'org-card-item';
            
            // Re-creating the professional org card structure
            const initial = org.name.charAt(0).toUpperCase();
            const planText = org.plan ? `${org.plan.charAt(0).toUpperCase() + org.plan.slice(1)} Plan` : 'Standard Plan';
            const regionText = org.region ? org.region.toUpperCase() : 'AMERICAS';
            
            card.innerHTML = `
                <div class="org-card-avatar">${initial}</div>
                <div class="org-card-info">
                    <span class="org-card-name"></span>
                    <span class="org-card-meta">${planText} | ${regionText}</span>
                </div>
                <svg style="margin-left: auto; opacity: 0.3;" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            `;
            // Safe assignment
            card.querySelector('.org-card-name').textContent = org.name;
            orgCardsGrid.appendChild(card);
        });
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
        if (!response.ok) return;
        
        const orgsRes = await fetch('/v1/organizations', { headers: { 'Authorization': `Bearer ${token}` } });
        const orgs = await orgsRes.json();
        
        localStorage.setItem('sentinel-cached-orgs', JSON.stringify(orgs));
        updateOrgGrid(orgs);
    } catch (err) {}
}
