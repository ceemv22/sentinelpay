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

window.showStatus = (msg, type = 'info') => {
    if (type !== 'error') return;
    
    let overlay = document.getElementById('sentinel-status-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'sentinel-status-overlay';
        overlay.style.cssText = 'position:fixed;bottom:20px;right:20px;padding:12px 20px;background:rgba(0,0,0,0.8);backdrop-filter:blur(10px);border:1px solid rgba(255,51,51,0.4);border-radius:12px;color:#ff3333;font-family:JetBrains Mono,monospace;font-size:0.75rem;z-index:99999;box-shadow:0 10px 30px rgba(0,0,0,0.5);pointer-events:none;transition:all 0.3s ease;';
        document.body.appendChild(overlay);
    }
    overlay.textContent = msg;
};

const supabaseUrl = 'https://aivqwkgjdpklxxuvkxpy.supabase.co';
const supabaseKey = 'sb_publishable_bRfAssaGT6D8oFDQtPARbw_5fyYGWM6';
let sentinelAuth = null;
let isInitialized = false;
let authStartTime = Date.now();
const API_URL = window.location.origin;

let _touchLockHandler = null;
let _touchLockStartY = 0;

function lockBodyScroll() {
    const ca = document.querySelector('.content-area');
    if (ca) {
        ca._lockedScrollTop = ca.scrollTop;
        ca.style.setProperty('overflow-y', 'hidden', 'important');
    }
    if (_touchLockHandler) return;
    const onStart = (e) => { _touchLockStartY = e.touches[0].clientY; };
    _touchLockHandler = (e) => {
        const mc = e.target.closest('.modal-content');
        if (!mc) { e.preventDefault(); return; }
        const dy = e.touches[0].clientY - _touchLockStartY;
        const atTop = mc.scrollTop <= 0 && dy > 0;
        const atBottom = mc.scrollTop >= mc.scrollHeight - mc.clientHeight && dy < 0;
        if (mc.scrollHeight <= mc.clientHeight || atTop || atBottom) e.preventDefault();
    };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', _touchLockHandler, { passive: false });
    _touchLockHandler._onStart = onStart;
}
function unlockBodyScroll() {
    const ca = document.querySelector('.content-area');
    if (ca) {
        ca.style.removeProperty('overflow-y');
        if (ca._lockedScrollTop !== undefined) ca.scrollTop = ca._lockedScrollTop;
    }
    if (!_touchLockHandler) return;
    document.removeEventListener('touchstart', _touchLockHandler._onStart);
    document.removeEventListener('touchmove', _touchLockHandler);
    _touchLockHandler = null;
}

const initialSearch = window.location.search;
const initialHash = window.location.hash;

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
    const pendingToken = sessionStorage.getItem('sentinel_join_token');
    const pendingSlug = sessionStorage.getItem('sentinel_join_slug');
    const pendingName = sessionStorage.getItem('sentinel_join_name');

    if (pendingToken && pendingSlug) {
        sessionStorage.removeItem('sentinel_join_token');
        sessionStorage.removeItem('sentinel_join_slug');
        sessionStorage.removeItem('sentinel_join_name');
        
        window.location.href = `/join?token=${pendingToken}&slug=${pendingSlug}&name=${encodeURIComponent(pendingName || '')}`;
        return;
    }

    if (renderDashboard.busy) return;
    renderDashboard.busy = true;

    try {
        const token = session.access_token;
        const user = session.user;
        window.supabaseAuthToken = token;
        
        document.body.classList.add('state-org-home');

        let rawUsername = user.email || 'user';
        let displayIdentifier = user.email || 'user';
        let avatarInitial = '?';
        if (user.user_metadata) {
            if (user.user_metadata.user_name) {
                rawUsername = user.user_metadata.user_name;
                displayIdentifier = `@${rawUsername}`;
                avatarInitial = rawUsername.charAt(0);
            } else if (user.user_metadata.full_name) {
                avatarInitial = user.user_metadata.full_name.charAt(0);
            }
        }
        if (avatarInitial === '?' && displayIdentifier) avatarInitial = displayIdentifier.charAt(0);

        const avatarEl = document.getElementById('org-avatar-circle');
        if (avatarEl) avatarEl.textContent = avatarInitial.toUpperCase();
        
        const teamAvatarEl = document.getElementById('team-owner-avatar');
        if (teamAvatarEl) teamAvatarEl.textContent = avatarInitial.toUpperCase();
        
        const teamEmailEl = document.getElementById('current-user-email');
        if (teamEmailEl) teamEmailEl.textContent = rawUsername;

        const dropdownEmailEl = document.getElementById('dropdown-email');
        if (dropdownEmailEl) dropdownEmailEl.textContent = displayIdentifier;

        const menuTrigger = document.getElementById('user-menu-trigger');
        const dropdownMenu = document.getElementById('user-dropdown');
        if (menuTrigger && dropdownMenu && !menuTrigger.dataset.initialized) {
            menuTrigger.dataset.initialized = "true";
            menuTrigger.onclick = (e) => {
                e.preventDefault(); e.stopPropagation();
                if (document.body.classList.contains('mobile-sidebar-open')) {
                    document.body.classList.remove('mobile-sidebar-open');
                }
                menuTrigger.classList.toggle('active');
                dropdownMenu.classList.toggle('active');
            };
        }

        const currentPath = window.location.pathname;
        const orgMatch = currentPath.match(/^\/dashboard\/org\/([a-z0-9]{20})(\/[a-z0-9-]+)?$/);
        const isValidHome = currentPath === '/dashboard' || currentPath === '/dashboard/organizations' || currentPath === '/dashboard/';
        const accountMatch = currentPath.match(/^\/dashboard\/account\/settings(?:\/(preferences|security|access-tokens))?$/);

        if (orgMatch) {
            switchToOrgView(orgMatch[1], orgMatch[2] ? orgMatch[2].substring(1) : 'projects');
        } else if (isValidHome) {
            switchToHomeView();
        } else if (accountMatch) {
            const tab = accountMatch[1] || 'preferences';
            document.title = 'sentinelpay | account settings';
            if (!accountMatch[1]) {
                history.replaceState({}, '', '/dashboard/account/settings/preferences');
            }
            switchToAccountSettings(tab);
        } else {
            window.location.replace('/dashboard/organizations');
            return;
        }

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

        fetchHeaderApiKey(token);
        fetchProfile(token);
        fetchPendingInvitations(token);

        setupCreateOrgModal(token);
        setupInviteMemberModal(token);
        setupSidebar();
        setupMobileNav();
        initOrgSearch();
    } catch (e) {
        console.error('[sentinel-render] Critical failure:', e);
        showStatus('Render Error', 'error');
    } finally {
        renderDashboard.busy = false;
    }
}

function setupMobileNav() {
    const toggle = document.getElementById('mobile-nav-toggle');
    const hamburger = document.getElementById('mobile-hamburger-btn');
    const overlay = document.getElementById('mobile-sidebar-overlay');
    const sidebar = document.querySelector('.sidebar');

    if (!overlay) return;
    if (overlay.dataset.mobileBound) return;
    overlay.dataset.mobileBound = 'true';

    const openMobileNav = () => {
        document.body.classList.add('mobile-sidebar-open');
    };

    const closeMobileNav = () => {
        document.body.classList.remove('mobile-sidebar-open');
    };

    if (toggle) {
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.location.href = 'https://sentinelpay.org';
        });
    }

    if (hamburger) {
        hamburger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const trigger = document.getElementById('user-menu-trigger');
            const dropdown = document.getElementById('user-dropdown');
            if (dropdown && dropdown.classList.contains('active')) {
                trigger && trigger.classList.remove('active');
                dropdown.classList.remove('active');
                flipToMainPanel();
            }
            document.body.classList.toggle('mobile-sidebar-open');
        });
    }

    overlay.addEventListener('click', closeMobileNav);

    if (sidebar) {
        sidebar.querySelectorAll('.sidebar-item').forEach(item => {
            item.addEventListener('click', () => {
                setTimeout(closeMobileNav, 200);
            });
        });
    }

    const observer = new MutationObserver(() => {
        const desktopSuffix = document.getElementById('api-key-suffix');
        const mobileSuffix = document.getElementById('mobile-api-key-suffix');
        if (desktopSuffix && mobileSuffix) {
            mobileSuffix.textContent = desktopSuffix.textContent;
        }
    });
    const desktopSuffix = document.getElementById('api-key-suffix');
    if (desktopSuffix) {
        observer.observe(desktopSuffix, { childList: true, characterData: true, subtree: true });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeMobileNav();
    });
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

    const PLANS = {
        starter: {
            label: 'starter',
            price: '$99',
            period: '/mo',
            features: ['1 rpc endpoint', 'up to 250 monitored addresses', 'real-time email alerts', 'on-demand api scan access', 'standard support'],
            featured: false
        },
        pro: {
            label: 'pro',
            price: '$399',
            period: '/mo',
            features: ['up to 5 rpc endpoints', 'up to 2,500 monitored addresses', 'email + webhook alerts', 'custom risk thresholds per endpoint', 'priority support'],
            featured: true
        },
        enterprise: {
            label: 'enterprise',
            price: 'custom',
            period: '',
            features: ['unlimited rpc endpoints', 'unlimited monitored addresses', 'dedicated infrastructure', 'custom alert integrations', 'sla + dedicated support'],
            contact: true
        }
    };

    let _cryptoIntervals = { poll: null, countdown: null };
    let _currentSessionGen = 0;
    let _batchSessions = null;
    let _stripeCheckout = null;

    const resetToStep1 = () => {
        clearInterval(_cryptoIntervals.poll);
        clearInterval(_cryptoIntervals.countdown);
        _cryptoIntervals = { poll: null, countdown: null };
        _currentSessionGen = 0;
        _batchSessions = null;
        if (_stripeCheckout) { _stripeCheckout.destroy(); _stripeCheckout = null; }
        const step1 = document.getElementById('create-org-step-1');
        const step2 = document.getElementById('create-org-step-2');
        const step3 = document.getElementById('create-org-step-3');
        if (step1) step1.style.display = 'flex';
        if (step2) { step2.style.display = 'none'; step2.innerHTML = ''; }
        if (step3) { step3.style.display = 'none'; step3.innerHTML = ''; }
    };

    const openModal = () => {
        modal.classList.add('active');
        document.body.classList.add('modal-open');
        lockBodyScroll();
        form.reset();
        errorEl.style.display = 'none';

        const planDisplay = document.querySelector('#plan-select-trigger .selected-value');
        if (planDisplay) planDisplay.textContent = 'starter — $99/mo';
        const planInput = document.getElementById('org-plan');
        if (planInput) planInput.value = 'starter';
        document.querySelectorAll('#plan-select-dropdown .sentinel-select-option').forEach(o => {
            o.classList.toggle('selected', o.dataset.value === 'starter');
        });

        const recEl = document.getElementById('org-name-rec');
        const successIcon = document.getElementById('org-name-success');
        if (recEl) recEl.style.display = 'none';
        if (successIcon) successIcon.style.display = 'none';

        document.querySelectorAll('.sentinel-select-trigger').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.sentinel-select-dropdown').forEach(d => d.classList.remove('active'));

        resetToStep1();
    };

    const closeModal = () => {
        modal.classList.remove('active');
        document.body.classList.remove('modal-open');
        unlockBodyScroll();
        resetToStep1();
    };

    openBtn.onclick = (e) => { e.preventDefault(); openModal(); };
    closeBtn.onclick = (e) => { e.preventDefault(); closeModal(); };

    const dropdownCreateBtn = document.getElementById('dropdown-create-org');
    if (dropdownCreateBtn && !dropdownCreateBtn.dataset.bound) {
        dropdownCreateBtn.dataset.bound = 'true';
        dropdownCreateBtn.onclick = (e) => { e.preventDefault(); openModal(); };
    }

    modal.onclick = (e) => { if (e.target === modal) closeModal(); };

    const initSelect = (idPrefix) => {
        const trigger = document.getElementById(`${idPrefix}-select-trigger`);
        const dropdown = document.getElementById(`${idPrefix}-select-dropdown`);
        const hiddenInput = document.getElementById(`org-${idPrefix}`);
        const options = dropdown.querySelectorAll('.sentinel-select-option');
        const displayVal = trigger.querySelector('.selected-value');

        trigger.onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll('.sentinel-select-trigger').forEach(t => { if (t !== trigger) t.classList.remove('active'); });
            document.querySelectorAll('.sentinel-select-dropdown').forEach(d => { if (d !== dropdown) d.classList.remove('active'); });
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

    const nameInput = document.getElementById('org-name');
    const recEl = document.getElementById('org-name-rec');
    const successIcon = document.getElementById('org-name-success');
    let checkTimeout;

    nameInput.oninput = () => {
        clearTimeout(checkTimeout);
        const val = nameInput.value.trim();
        if (val.length < 2) {
            recEl.style.display = 'none';
            if (successIcon) successIcon.style.display = 'none';
            return;
        }
        checkTimeout = setTimeout(async () => {
            try {
                const res = await fetch(`/v1/organizations/check?name=${encodeURIComponent(val)}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const { available } = await res.json();
                if (!available) {
                    const random = Math.floor(100000 + Math.random() * 900000);
                    const rec = `${val.toLowerCase().replace(/\s+/g, '-')}-${random}`;
                    recEl.innerHTML = `${val.toLowerCase()} is taken. try <span class="org-rec-link" id="btn-use-rec">${rec}</span> instead.`;
                    recEl.style.display = 'block';
                    const recLink = document.getElementById('btn-use-rec');
                    if (recLink) {
                        recLink.onclick = () => {
                            nameInput.value = rec;
                            nameInput.dispatchEvent(new Event('input'));
                        };
                    }
                    if (successIcon) successIcon.style.display = 'none';
                } else {
                    recEl.style.display = 'none';
                    if (successIcon) successIcon.style.display = 'block';
                }
            } catch (e) {}
        }, 400);
    };

    document.addEventListener('click', () => {
        document.querySelectorAll('.sentinel-select-trigger').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.sentinel-select-dropdown').forEach(d => d.classList.remove('active'));
    });

    const transitionToStep3 = (name, plan) => {
        const step2 = document.getElementById('create-org-step-2');
        const step3 = document.getElementById('create-org-step-3');
        const p = PLANS[plan] || PLANS.starter;

        step3.innerHTML = `
            <button id="btn-step3-back" style="position:absolute;top:0.5rem;left:0.5rem;background:transparent;border:none;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;gap:6px;font-family:'JetBrains Mono',monospace;font-size:0.73rem;padding:0.5rem;border-radius:6px;transition:color 0.2s;z-index:1001;line-height:1;-webkit-tap-highlight-color:transparent;transform:none !important;box-shadow:none !important;">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>back
            </button>
            <div style="padding-top:2.25rem;width:100%;">
                <div class="auth-tabs" style="margin-bottom:1.25rem;display:flex;justify-content:flex-start;">
                    <button class="auth-tab active" id="tab-btn-card" style="width:auto;padding:0.4rem 1rem;font-size:0.7rem;border-radius:6px;">pay with card</button>
                    <button class="auth-tab" id="tab-btn-crypto" style="width:auto;padding:0.4rem 1rem;font-size:0.7rem;border-radius:6px;">pay with crypto</button>
                </div>
                <div id="tab-content-card">
                    <p id="create-org-pay-error" class="error-msg" style="display:none;margin-bottom:0.5rem;"></p>
                    <div id="stripe-checkout-container" style="min-height:180px;"></div>
                </div>
                <div id="tab-content-crypto" style="display:none;">
                    <div id="crypto-selector-view">
                        <div style="font-family:'JetBrains Mono',monospace;font-size:0.67rem;color:var(--text-muted);margin-bottom:0.5rem;letter-spacing:0.03em;">select currency</div>
                        <div id="crypto-dd-wrap" style="position:relative;">
                            <button id="crypto-dd-trigger" style="width:100%;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:0.6rem 0.8rem;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:0.6rem;box-sizing:border-box;-webkit-tap-highlight-color:transparent;box-shadow:none !important;transform:none !important;transition:border-color 0.18s ease;">
                                <div id="crypto-dd-selected" style="display:flex;align-items:center;gap:0.5rem;flex:1;min-width:0;">
                                    <span style="font-family:'JetBrains Mono',monospace;font-size:0.7rem;color:var(--text-muted);">choose a currency...</span>
                                </div>
                                <svg id="crypto-dd-chevron" style="flex-shrink:0;transition:transform 0.18s;" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </button>
                            <div id="crypto-dd-panel" style="display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;background:#090909;border:1px solid rgba(255,255,255,0.1);border-radius:8px;z-index:200;max-height:200px;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.7);"></div>
                        </div>
                        <div id="network-dd-wrap" style="display:none;position:relative;margin-top:0.5rem;">
                            <button id="network-dd-trigger" style="width:100%;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:0.6rem 0.8rem;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:0.6rem;box-sizing:border-box;-webkit-tap-highlight-color:transparent;box-shadow:none !important;transform:none !important;transition:border-color 0.18s ease;">
                                <span id="network-dd-selected" style="font-family:'JetBrains Mono',monospace;font-size:0.7rem;color:var(--text-muted);">select network...</span>
                                <svg id="network-dd-chevron" style="flex-shrink:0;transition:transform 0.18s;" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </button>
                            <div id="network-dd-panel" style="display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;background:#090909;border:1px solid rgba(255,255,255,0.1);border-radius:8px;z-index:200;max-height:160px;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.7);"></div>
                        </div>
                        <p id="crypto-sel-error" style="display:none;font-family:'JetBrains Mono',monospace;font-size:0.67rem;color:#ff3333;margin-top:0.45rem;margin-bottom:0;"></p>
                    </div>
                    <div id="crypto-status-area" style="margin-top:0.75rem;"></div>
                </div>
            </div>
        `;

        step2.style.display = 'none';
        step3.style.display = 'flex';
        step3.style.flexDirection = 'column';
        step3.style.width = '100%';

        const CRYPTO_CURRENCIES = [
            { currency: 'BNB',  name: 'bnb',      networks: [{ id: 'bsc',      label: 'bsc'      }], color: '#F3BA2F' },
            { currency: 'BTC',  name: 'bitcoin',  networks: [{ id: 'bitcoin',  label: 'bitcoin'  }], color: '#F7931A' },
            { currency: 'DAI',  name: 'dai',      networks: [{ id: 'ethereum', label: 'erc-20'   }, { id: 'polygon', label: 'polygon'  }], color: '#F5AC37' },
            { currency: 'ETH',  name: 'ethereum', networks: [{ id: 'ethereum', label: 'ethereum' }], color: '#627EEA' },
            { currency: 'POL',  name: 'polygon',  networks: [{ id: 'polygon',  label: 'polygon'  }], color: '#8247E5' },
            { currency: 'USDC', name: 'usd coin', networks: [{ id: 'ethereum', label: 'erc-20'   }, { id: 'bsc', label: 'bep-20'  }, { id: 'polygon', label: 'polygon'  }], color: '#2775CA' },
            { currency: 'USDT', name: 'tether',   networks: [{ id: 'ethereum', label: 'erc-20'   }, { id: 'bsc', label: 'bep-20'  }, { id: 'polygon', label: 'polygon'  }], color: '#26A17B' },
        ];

        const cryptoSelError = document.getElementById('crypto-sel-error');
        const ddTrigger = document.getElementById('crypto-dd-trigger');
        const ddPanel = document.getElementById('crypto-dd-panel');
        const ddSelected = document.getElementById('crypto-dd-selected');
        const ddChevron = document.getElementById('crypto-dd-chevron');
        const networkWrap = document.getElementById('network-dd-wrap');
        const netTrigger = document.getElementById('network-dd-trigger');
        const netPanel = document.getElementById('network-dd-panel');
        const netSelected = document.getElementById('network-dd-selected');
        const netChevron = document.getElementById('network-dd-chevron');
        let ddOpen = false;
        let netOpen = false;

        const toggleDd = (force) => {
            ddOpen = typeof force === 'boolean' ? force : !ddOpen;
            ddPanel.style.display = ddOpen ? '' : 'none';
            ddChevron.style.transform = ddOpen ? 'rotate(180deg)' : '';
            ddTrigger.style.borderColor = ddOpen ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)';
        };

        const toggleNetDd = (force) => {
            netOpen = typeof force === 'boolean' ? force : !netOpen;
            netPanel.style.display = netOpen ? '' : 'none';
            netChevron.style.transform = netOpen ? 'rotate(180deg)' : '';
            netTrigger.style.borderColor = netOpen ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)';
        };

        ddTrigger.addEventListener('click', (e) => { e.stopPropagation(); if (netOpen) toggleNetDd(false); toggleDd(); });
        netTrigger.addEventListener('click', (e) => { e.stopPropagation(); if (ddOpen) toggleDd(false); toggleNetDd(); });
        document.addEventListener('click', () => { if (ddOpen) toggleDd(false); if (netOpen) toggleNetDd(false); });

        const showCryptoPayment = (session, coin) => {
            const statusArea = document.getElementById('crypto-status-area');
            if (!statusArea) return;

            const expiresAt = new Date(session.expiresAt);
            const getTimeLeft = () => {
                const diff = expiresAt - Date.now();
                if (diff <= 0) return '00:00';
                const m = Math.floor(diff / 60000);
                const s = Math.floor((diff % 60000) / 1000);
                return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
            };

            const _sm = window.innerWidth <= 600;
            const _qr = _sm ? '82' : '118';
            const _gap = _sm ? '0.38rem' : '0.575rem';
            const _pt = _sm ? '0.5rem' : '0.75rem';

            statusArea.innerHTML = `
                <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:${_pt};display:flex;flex-direction:column;gap:${_gap};">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;">
                        <div id="batch-id-copy" title="click to copy session id" style="display:flex;align-items:center;gap:0.3rem;cursor:pointer;min-width:0;flex:1;overflow:hidden;-webkit-tap-highlight-color:transparent;">
                            <span id="batch-id-text" style="font-family:'JetBrains Mono',monospace;font-size:0.58rem;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;transition:color 0.2s;">${session.batchId}</span>
                            <span id="batch-id-icon" style="flex-shrink:0;color:var(--text-muted);opacity:0.5;display:flex;align-items:center;transition:opacity 0.2s,color 0.2s;"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></span>
                        </div>
                        <div id="crypto-countdown" style="font-family:'JetBrains Mono',monospace;font-size:0.67rem;color:#f5ac37;flex-shrink:0;">&#x23F1; ${getTimeLeft()}</div>
                    </div>
                    <div style="text-align:center;">
                        <div style="font-family:'JetBrains Mono',monospace;font-size:0.63rem;color:var(--text-muted);margin-bottom:0.2rem;">send exactly</div>
                        <div style="font-family:'JetBrains Mono',monospace;font-size:1.3rem;font-weight:700;color:#ffffff;letter-spacing:-0.025em;">${session.amountCrypto} <span style="font-size:0.68rem;color:rgba(255,255,255,0.45);">${coin.currency}</span></div>
                        <div style="font-family:'JetBrains Mono',monospace;font-size:0.6rem;color:var(--text-muted);margin-top:0.15rem;">&asymp; $${session.amountUsd.toLocaleString('en-US')}</div>
                    </div>
                    <div style="display:flex;justify-content:center;">
                        <img src="${session.qrDataUrl}" alt="qr" style="width:${_qr}px;height:${_qr}px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);">
                    </div>
                    <div style="background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:0.65rem 0.75rem;display:grid;grid-template-columns:1fr auto;align-items:center;gap:0.5rem;width:100%;box-sizing:border-box;">
                        <div style="font-family:'JetBrains Mono',monospace;font-size:0.68rem;color:#ffffff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${session.address}</div>
                        <button id="btn-copy-address" style="background:transparent;border:none;cursor:pointer;color:var(--text-muted);padding:0.15rem;display:flex;align-items:center;transition:color 0.2s;-webkit-tap-highlight-color:transparent;transform:none !important;box-shadow:none !important;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        </button>
                    </div>
                    <div style="font-family:'JetBrains Mono',monospace;font-size:0.6rem;color:var(--text-muted);text-align:center;opacity:0.6;padding:0.35rem 0;">credited after 2 confirmations</div>
                    <div id="crypto-pay-status" style="font-family:'JetBrains Mono',monospace;font-size:0.63rem;color:var(--text-muted);text-align:center;display:flex;align-items:center;justify-content:center;gap:0.375rem;min-height:0;"></div>
                </div>
            `;

            const copyBtn = document.getElementById('btn-copy-address');
            if (copyBtn) {
                const COPY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
                const CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                let copied = false;
                const showCopied = () => {
                    copied = true;
                    copyBtn.style.color = '#00ff88';
                    copyBtn.style.cursor = 'default';
                    copyBtn.innerHTML = CHECK_SVG;
                    setTimeout(() => {
                        if (!copyBtn) return;
                        copyBtn.style.color = 'var(--text-muted)';
                        copyBtn.style.cursor = 'pointer';
                        copyBtn.innerHTML = COPY_SVG;
                        copied = false;
                    }, 3000);
                };
                const fallbackCopy = (text) => {
                    const ta = document.createElement('textarea');
                    ta.value = text;
                    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
                    document.body.appendChild(ta);
                    ta.focus();
                    ta.select();
                    try { document.execCommand('copy'); showCopied(); } catch {}
                    document.body.removeChild(ta);
                };
                copyBtn.onclick = () => {
                    if (copied) return;
                    if (navigator.clipboard && window.isSecureContext) {
                        navigator.clipboard.writeText(session.address).then(showCopied).catch(() => fallbackCopy(session.address));
                    } else {
                        fallbackCopy(session.address);
                    }
                };
            }

            const batchCopyEl = document.getElementById('batch-id-copy');
            if (batchCopyEl) {
                const batchText = document.getElementById('batch-id-text');
                const batchIcon = document.getElementById('batch-id-icon');
                const CHECK_SMALL = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                const COPY_SMALL = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
                let batchCopied = false;
                const showBatchCopied = () => {
                    batchCopied = true;
                    if (batchText) { batchText.style.color = '#00ff88'; }
                    if (batchIcon) { batchIcon.style.color = '#00ff88'; batchIcon.style.opacity = '1'; batchIcon.innerHTML = CHECK_SMALL; }
                    setTimeout(() => {
                        if (batchText) batchText.style.color = 'var(--text-muted)';
                        if (batchIcon) { batchIcon.style.color = 'var(--text-muted)'; batchIcon.style.opacity = '0.5'; batchIcon.innerHTML = COPY_SMALL; }
                        batchCopied = false;
                    }, 2500);
                };
                const fallbackBatch = (text) => {
                    const ta = document.createElement('textarea');
                    ta.value = text;
                    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
                    document.body.appendChild(ta);
                    ta.focus();
                    ta.select();
                    try { document.execCommand('copy'); showBatchCopied(); } catch {}
                    document.body.removeChild(ta);
                };
                batchCopyEl.onmouseenter = () => { if (!batchCopied && batchIcon) batchIcon.style.opacity = '1'; };
                batchCopyEl.onmouseleave = () => { if (!batchCopied && batchIcon) batchIcon.style.opacity = '0.5'; };
                batchCopyEl.onclick = () => {
                    if (batchCopied) return;
                    const val = session.batchId;
                    if (navigator.clipboard && window.isSecureContext) {
                        navigator.clipboard.writeText(val).then(showBatchCopied).catch(() => fallbackBatch(val));
                    } else {
                        fallbackBatch(val);
                    }
                };
            }

            _cryptoIntervals.countdown = setInterval(() => {
                const el = document.getElementById('crypto-countdown');
                if (!el) { clearInterval(_cryptoIntervals.countdown); return; }
                const t = getTimeLeft();
                el.textContent = '⏱ ' + t;
                if (t === '00:00') {
                    clearInterval(_cryptoIntervals.countdown);
                    _cryptoIntervals.countdown = null;
                    const statusEl = document.getElementById('crypto-pay-status');
                    if (statusEl) statusEl.innerHTML = '<span style="color:#ff3333;">session expired. change currency to refresh.</span>';
                }
            }, 1000);

            _cryptoIntervals.poll = setInterval(async () => {
                try {
                    const r = await fetch('/v1/crypto/session/' + session.id, {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    const data = await r.json();
                    if (data.status === 'confirmed') {
                        clearInterval(_cryptoIntervals.poll);
                        clearInterval(_cryptoIntervals.countdown);
                        _cryptoIntervals.poll = null;
                        _cryptoIntervals.countdown = null;
                        const statusEl = document.getElementById('crypto-pay-status');
                        if (statusEl) statusEl.innerHTML = '<span style="color:#00f0ff;">✓ payment confirmed!</span>';
                        setTimeout(() => { closeModal(); window.location.replace('/dashboard/organizations'); }, 2000);
                    }
                } catch (e) {}
            }, 10000);
        };

        const handleCryptoSelect = async (coin) => {
            const cacheKey = coin.currency + ':' + coin.network;

            if (_batchSessions && new Date(_batchSessions.expiresAt) > Date.now()) {
                const sess = _batchSessions.sessions[cacheKey];
                if (sess) {
                    clearInterval(_cryptoIntervals.poll);
                    clearInterval(_cryptoIntervals.countdown);
                    _cryptoIntervals = { poll: null, countdown: null };
                    showCryptoPayment(sess, coin);
                    return;
                }
            }

            const gen = ++_currentSessionGen;
            const statusArea = document.getElementById('crypto-status-area');
            if (statusArea) {
                statusArea.innerHTML = '<p style="font-family:\'JetBrains Mono\',monospace;font-size:0.67rem;color:var(--text-muted);margin:0.5rem 0 0 0;text-align:center;">generating deposit address...</p>';
            }
            try {
                const batchRes = await fetch('/v1/crypto/batch-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                    body: JSON.stringify({ plan, orgName: name })
                });
                const batchData = await batchRes.json();
                if (!batchRes.ok) throw new Error(batchData.error || 'failed to create payment session');
                if (gen !== _currentSessionGen) return;
                _batchSessions = batchData;
                const sess = _batchSessions.sessions[cacheKey];
                if (!sess) throw new Error('currency not available');
                showCryptoPayment(sess, coin);
            } catch (err) {
                if (gen !== _currentSessionGen) return;
                const area = document.getElementById('crypto-status-area');
                if (area) {
                    area.innerHTML = `<p style="font-family:'JetBrains Mono',monospace;font-size:0.67rem;color:#ff3333;margin:0.5rem 0 0 0;text-align:center;">error: ${err.message.toLowerCase()}</p>`;
                }
            }
        };

        const COIN_IMG = {
            ETH:  'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/eth.svg',
            BTC:  'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/btc.svg',
            BNB:  'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/bnb.svg',
            POL:  'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/matic.svg',
            USDT: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/usdt.svg',
            USDC: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/usdc.svg',
            DAI:  'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/dai.svg',
        };

        let selectedCurrency = null;
        let selectedNetwork = null;

        const renderDdSelected = (cur) => {
            ddSelected.innerHTML = '';
            const sWrap = document.createElement('div');
            sWrap.style.cssText = 'width:18px;height:18px;border-radius:50%;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:' + cur.color + '1a;';
            const sImg = document.createElement('img');
            sImg.src = COIN_IMG[cur.currency] || '';
            sImg.alt = cur.currency;
            sImg.style.cssText = 'width:18px;height:18px;border-radius:50%;object-fit:cover;';
            sImg.onerror = () => { sImg.style.display = 'none'; };
            sWrap.appendChild(sImg);
            const sTxt = document.createElement('span');
            sTxt.style.cssText = "font-family:'JetBrains Mono',monospace;font-size:0.7rem;color:#e0e0e0;";
            sTxt.textContent = cur.name;
            ddSelected.appendChild(sWrap);
            ddSelected.appendChild(sTxt);
        };

        const renderNetSelected = (net) => {
            netSelected.textContent = net.label;
            netSelected.style.color = '#e0e0e0';
        };

        const populateNetworkDd = (cur) => {
            netPanel.innerHTML = '';
            cur.networks.forEach((net, i) => {
                const item = document.createElement('div');
                item.style.cssText = 'padding:0.5rem 0.8rem;font-family:\'JetBrains Mono\',monospace;font-size:0.7rem;color:var(--text-muted);cursor:pointer;transition:background 0.13s;' + (i < cur.networks.length - 1 ? 'border-bottom:1px solid rgba(255,255,255,0.04);' : '');
                item.textContent = net.label;
                item.addEventListener('mouseover', () => { item.style.background = 'rgba(255,255,255,0.04)'; item.style.color = '#fff'; });
                item.addEventListener('mouseout', () => { item.style.background = 'transparent'; item.style.color = 'var(--text-muted)'; });
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectedNetwork = net;
                    toggleNetDd(false);
                    renderNetSelected(net);
                    clearInterval(_cryptoIntervals.poll);
                    clearInterval(_cryptoIntervals.countdown);
                    _cryptoIntervals = { poll: null, countdown: null };
                    handleCryptoSelect({ currency: selectedCurrency.currency, network: selectedNetwork.id, net: selectedNetwork.label });
                });
                netPanel.appendChild(item);
            });
        };

        const onCurrencySelect = (cur) => {
            selectedCurrency = cur;
            selectedNetwork = cur.networks[0];
            toggleDd(false);
            renderDdSelected(cur);
            if (cur.networks.length > 1) {
                populateNetworkDd(cur);
                renderNetSelected(cur.networks[0]);
                networkWrap.style.display = '';
            } else {
                networkWrap.style.display = 'none';
            }
            const cryptoTab = document.getElementById('tab-content-crypto');
            if (cryptoTab && cryptoTab.style.display !== 'none') {
                clearInterval(_cryptoIntervals.poll);
                clearInterval(_cryptoIntervals.countdown);
                _cryptoIntervals = { poll: null, countdown: null };
                handleCryptoSelect({ currency: cur.currency, network: cur.networks[0].id, net: cur.networks[0].label });
            }
        };

        CRYPTO_CURRENCIES.forEach((cur, i) => {
            const item = document.createElement('div');
            item.style.cssText = 'padding:0.5rem 0.8rem;font-family:\'JetBrains Mono\',monospace;font-size:0.7rem;color:var(--text-muted);cursor:pointer;transition:background 0.13s;' + (i < CRYPTO_CURRENCIES.length - 1 ? 'border-bottom:1px solid rgba(255,255,255,0.04);' : '');
            item.textContent = cur.name;
            item.addEventListener('mouseover', () => { item.style.background = 'rgba(255,255,255,0.04)'; item.style.color = '#fff'; });
            item.addEventListener('mouseout', () => { item.style.background = 'transparent'; item.style.color = 'var(--text-muted)'; });
            item.addEventListener('click', (e) => { e.stopPropagation(); onCurrencySelect(cur); });
            ddPanel.appendChild(item);
        });

        onCurrencySelect(CRYPTO_CURRENCIES.find(c => c.currency === 'ETH'));

        document.getElementById('btn-step3-back').onclick = () => {
            clearInterval(_cryptoIntervals.poll);
            clearInterval(_cryptoIntervals.countdown);
            _cryptoIntervals = { poll: null, countdown: null };
            if (_stripeCheckout) { _stripeCheckout.destroy(); _stripeCheckout = null; }
            step3.style.display = 'none';
            step3.innerHTML = '';
            step2.style.display = 'flex';
            step2.style.flexDirection = 'column';
            step2.style.width = '100%';
        };

        document.getElementById('tab-btn-card').onclick = () => {
            document.getElementById('tab-btn-card').classList.add('active');
            document.getElementById('tab-btn-crypto').classList.remove('active');
            document.getElementById('tab-content-card').style.display = '';
            document.getElementById('tab-content-crypto').style.display = 'none';
        };

        document.getElementById('tab-btn-crypto').onclick = () => {
            document.getElementById('tab-btn-crypto').classList.add('active');
            document.getElementById('tab-btn-card').classList.remove('active');
            document.getElementById('tab-content-crypto').style.display = '';
            document.getElementById('tab-content-card').style.display = 'none';
            const statusArea = document.getElementById('crypto-status-area');
            if (selectedCurrency && selectedNetwork && statusArea && !statusArea.querySelector('#crypto-pay-status')) {
                clearInterval(_cryptoIntervals.poll);
                clearInterval(_cryptoIntervals.countdown);
                _cryptoIntervals = { poll: null, countdown: null };
                handleCryptoSelect({ currency: selectedCurrency.currency, network: selectedNetwork.id, net: selectedNetwork.label });
            }
        };

        const initStripeEmbedded = async () => {
            if (_stripeCheckout) return;
            const container = document.getElementById('stripe-checkout-container');
            const payErrEl = document.getElementById('create-org-pay-error');
            if (!container) return;

            container.innerHTML = '<p style="font-family:\'JetBrains Mono\',monospace;font-size:0.67rem;color:var(--text-muted);text-align:center;padding:1rem 0;">initializing secure checkout...</p>';

            try {
                if (!window.Stripe) throw new Error('payment system not ready, please refresh');

                const cfgRes = await fetch('/v1/stripe/config', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const cfgData = await cfgRes.json();
                if (!cfgRes.ok || !cfgData.publishableKey) throw new Error('payment configuration unavailable');

                const sessRes = await fetch('/v1/stripe/embedded-checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ plan, orgName: name })
                });
                const sessData = await sessRes.json();
                if (!sessRes.ok || !sessData.clientSecret) throw new Error(sessData.error || 'failed to initialize checkout');

                const stripeInst = window.Stripe(cfgData.publishableKey);
                _stripeCheckout = await stripeInst.initEmbeddedCheckout({
                    clientSecret: sessData.clientSecret,
                    onComplete: () => {
                        if (_stripeCheckout) { _stripeCheckout.destroy(); _stripeCheckout = null; }
                        window.location.replace('/dashboard/organizations?stripe=success');
                    }
                });

                container.innerHTML = '';
                container.style.maxHeight = '420px';
                container.style.overflowY = 'auto';
                container.style.overscrollBehavior = 'contain';
                _stripeCheckout.mount(container);
            } catch (err) {
                if (payErrEl) {
                    payErrEl.textContent = `error: ${err.message.toLowerCase()}`;
                    payErrEl.style.display = 'block';
                }
                if (container) container.innerHTML = '';
            }
        };

        initStripeEmbedded();
    };

    const transitionToStep2 = (name, plan) => {
        const step1 = document.getElementById('create-org-step-1');
        const step2 = document.getElementById('create-org-step-2');
        const p = PLANS[plan] || PLANS.starter;
        const isEnterprise = !!p.contact;

        step2.innerHTML = `
            <button id="btn-step2-back" style="position:absolute;top:0.5rem;left:0.5rem;background:transparent;border:none;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;gap:6px;font-family:'JetBrains Mono',monospace;font-size:0.73rem;padding:0.5rem;border-radius:6px;transition:color 0.2s;z-index:1001;-webkit-tap-highlight-color:transparent;line-height:1;transform:none !important;box-shadow:none !important;">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>back
            </button>
            <div style="padding-top:2.25rem;width:100%;">
                <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:0.6rem 0.875rem;margin-bottom:0.875rem;">
                    <div style="display:flex;align-items:center;gap:0.6rem;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                        <span style="font-family:'JetBrains Mono',monospace;font-size:0.7rem;color:var(--text-muted);">organization</span>
                    </div>
                    <span style="font-family:'JetBrains Mono',monospace;font-size:0.74rem;color:#e0e0e0;font-weight:500;">${name}</span>
                </div>
                <div class="org-plan-card-summary${p.featured ? ' plan-featured' : ''}">
                    ${p.featured ? '<div class="plan-accent-bar"></div>' : ''}
                    <div class="plan-card-inner">
                        <div class="plan-card-top">
                            <span class="plan-card-label${p.featured ? ' plan-label-accent' : ''}">${p.label}</span>
                            ${p.featured ? '<span class="plan-card-popular">most popular</span>' : ''}
                        </div>
                        <div class="plan-price-row">
                            ${!isEnterprise ? `<span class="plan-price-currency">${p.price.charAt(0)}</span><span class="plan-price-amount">${p.price.slice(1)}</span><span class="plan-price-period">/mo</span>` : `<span class="plan-price-amount" style="font-size:1.5rem;letter-spacing:-1px;color:rgba(255,255,255,0.6);">custom pricing</span>`}
                        </div>
                        <div class="plan-card-divider"></div>
                        <ul class="plan-features-list">
                            ${p.features.map(f => `<li class="plan-feature-item"><svg class="plan-feat-check" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>${f}</li>`).join('')}
                        </ul>
                    </div>
                </div>
                ${isEnterprise ? `
                <div style="margin-top:1.1rem;padding:0.875rem 1rem;background:rgba(0,240,255,0.03);border:1px solid rgba(0,240,255,0.1);border-radius:10px;font-family:'JetBrains Mono',monospace;font-size:0.72rem;color:var(--text-muted);line-height:1.7;text-align:center;">
                    enterprise plans require custom configuration.<br>reach out and we'll get you set up.
                </div>
                <a href="mailto:support@sentinelpay.org" class="submit-btn" style="margin-top:1rem;display:flex;align-items:center;justify-content:center;text-decoration:none;">contact sales →</a>
                ` : `
                <p id="create-org-pay-error" class="error-msg" style="display:none;margin-top:0.75rem;"></p>
                <button class="submit-btn" id="btn-proceed-checkout" style="margin-top:1rem;display:flex;align-items:center;justify-content:center;gap:8px;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
                    proceed to checkout
                </button>
                `}
            </div>
        `;

        step1.style.display = 'none';
        step2.style.display = 'flex';
        step2.style.flexDirection = 'column';
        step2.style.width = '100%';

        document.getElementById('btn-step2-back').onclick = () => {
            step2.style.display = 'none';
            step2.innerHTML = '';
            step1.style.display = 'flex';
        };

        if (!isEnterprise) {
            const payBtn = document.getElementById('btn-proceed-checkout');
            const payErrEl = document.getElementById('create-org-pay-error');

            payBtn.onclick = () => transitionToStep3(name, plan);
        }
    };

    form.onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('org-name').value.trim();
        const plan = document.getElementById('org-plan').value;

        if (name.length < 2) {
            errorEl.textContent = 'error: name must be at least 2 characters.';
            errorEl.style.display = 'block';
            return;
        }

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'checking...';
            errorEl.style.display = 'none';

            const res = await fetch(`/v1/organizations/check?name=${encodeURIComponent(name)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const { available } = await res.json();

            if (!available) {
                errorEl.textContent = 'error: name already taken.';
                errorEl.style.display = 'block';
                return;
            }

            transitionToStep2(name, plan);
        } catch (err) {
            errorEl.textContent = `error: ${err.message.toLowerCase()}`;
            errorEl.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'continue';
        }
    };
}

let inviteTurnstileId = null;

function setupInviteMemberModal(token) {
    const modal = document.getElementById('invite-member-modal-overlay');
    const openBtn = document.getElementById('btn-invite-member');
    const closeBtn = document.getElementById('btn-close-invite-modal');
    const form = document.getElementById('invite-member-form');
    const submitBtn = document.getElementById('btn-submit-invite');

    if (!modal || !openBtn || !closeBtn || !form) return;
    if (openBtn.dataset.bound) return;
    openBtn.dataset.bound = "true";

    const getInviteCooldown = () => {
        const last = localStorage.getItem('sentinel-last-invite-sent');
        if (!last) return 0;
        const remaining = 60000 - (Date.now() - parseInt(last));
        return Math.max(0, Math.ceil(remaining / 1000));
    };

    const updateSubmitBtnState = () => {
        const remaining = getInviteCooldown();
        if (remaining > 0) {
            submitBtn.disabled = true;
            submitBtn.textContent = `wait ${remaining}s...`;
            setTimeout(updateSubmitBtnState, 1000);
        } else {
            submitBtn.disabled = false;
            submitBtn.textContent = 'send invitation';
        }
    };

    const openModal = () => {
        modal.classList.add('active');
        document.body.classList.add('modal-open');
        lockBodyScroll();
        form.reset();

        if (window.turnstile) {
            const container = document.getElementById('turnstile-invite');
            if (container) {
                container.innerHTML = ''; 
                inviteTurnstileId = window.turnstile.render(container, {
                    sitekey: '0x4AAAAAADGpMozD1QOtWPkP',
                    theme: 'dark',
                    callback: (token) => {
                        submitBtn.setAttribute('data-captcha-token', token);
                    }
                });
            }
        }

        updateSubmitBtnState();
        document.querySelectorAll('.sentinel-select-trigger').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.sentinel-select-dropdown').forEach(d => d.classList.remove('active'));
    };

    const closeModal = () => {
        modal.classList.remove('active');
        document.body.classList.remove('modal-open');
        unlockBodyScroll();
        if (window.turnstile && inviteTurnstileId !== null) {
            window.turnstile.reset(inviteTurnstileId);
        }
        submitBtn.removeAttribute('data-captcha-token');
    };

    openBtn.onclick = (e) => { e.preventDefault(); openModal(); };
    closeBtn.onclick = (e) => { e.preventDefault(); closeModal(); };
    
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };

    const trigger = document.getElementById('invite-role-select-trigger');
    const dropdown = document.getElementById('invite-role-select-dropdown');
    const hiddenInput = document.getElementById('invite-role');
    const options = dropdown.querySelectorAll('.sentinel-select-option');
    const displayVal = trigger.querySelector('.selected-value');

    trigger.onclick = (e) => {
        e.stopPropagation();
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

    form.onsubmit = async (e) => {
        e.preventDefault();
        
        const remaining = getInviteCooldown();
        if (remaining > 0) {
            if (window.SentinelToast) window.SentinelToast.show(`please wait ${remaining}s before sending more invitations.`, "warning");
            return;
        }

        const captchaToken = submitBtn.getAttribute('data-captcha-token');
        if (!captchaToken && window.turnstile) {
            if (window.SentinelToast) window.SentinelToast.show("please verify the captcha.", "error");
            return;
        }

        const rawEmails = document.getElementById('invite-emails').value;
        const role = hiddenInput.value;

        const emailList = rawEmails.split(/[\s,]+/).filter(item => {
            return item.trim().length > 0 && /^([^\s@]+@[^\s@]+\.[^\s@]+|[a-zA-Z0-9_.-]+)$/.test(item);
        });

        if (emailList.length === 0) {
            if (window.SentinelToast) window.SentinelToast.show("please enter at least one valid email.", "error");
            return;
        }

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'dispatching...';

            const path = window.location.pathname;
            const orgMatch = path.match(/\/dashboard\/org\/([a-z0-9]{20})/);
            const orgSlug = orgMatch ? orgMatch[1] : null;

            if (!orgSlug) throw new Error("organization context missing");

            const response = await fetch(`${API_URL}/v1/organizations/${orgSlug}/team/invite`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    emailList,
                    role,
                    'cf-turnstile-response': captchaToken
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'failed to send invitations');
            }

            emailList.forEach(email => {
                const member = { email, role, status: 'invited', invitedAt: Date.now(), isYou: false };
                saveInvitedMember(orgSlug, member);
                teamMembersFullList.push(member);
            });

            renderTeamPage();

            localStorage.setItem('sentinel-last-invite-sent', Date.now().toString());

            if (window.SentinelToast) window.SentinelToast.show(`${emailList.length} invitation${emailList.length > 1 ? 's' : ''} dispatched successfully.`, "success");
            closeModal();
        } catch (err) {
            if (window.SentinelToast) window.SentinelToast.show(err.message, "error");
            submitBtn.disabled = false;
            submitBtn.textContent = 'send invitation';
        }
    };
}

function saveInvitedMember(orgSlug, member) {
    const key = `sentinel-invites-${orgSlug}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    if (!existing.some(m => m.email === member.email)) {
        existing.push(member);
        localStorage.setItem(key, JSON.stringify(existing));
    }
}

let currentTeamPage = 1;
const teamItemsPerPage = 6;
let teamMembersFullList = [];
let currentOrgSlug = null;

function loadInvitedMembers(orgSlug) {
    const key = `sentinel-invites-${orgSlug}`;
    const invited = JSON.parse(localStorage.getItem(key) || '[]');
    
    const ownerEmail = document.getElementById('current-user-email')?.textContent || 'owner@sentinelpay.org';
    
    teamMembersFullList = [
        { email: ownerEmail, role: 'owner', status: 'active', isYou: true },
        ...invited.map(m => ({ ...m, isYou: false }))
    ];

    currentTeamPage = 1;
    initTeamPagination();
    renderTeamPage();
}

function renderTeamPage() {
    const tableBody = document.getElementById('team-table-body');
    const pageInfo = document.getElementById('team-pagination-info');
    const btnPrev = document.getElementById('btn-team-prev');
    const btnNext = document.getElementById('btn-team-next');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    
    const start = (currentTeamPage - 1) * teamItemsPerPage;
    const end = start + teamItemsPerPage;
    const pageItems = teamMembersFullList.slice(start, end);

    pageItems.forEach(m => {
        addTeamMemberToTable(m.email, m.role, m.status, m.isYou);
    });

    if (!pageInfo) return;

    const total = teamMembersFullList.length;
    const showingStart = total === 0 ? 0 : start + 1;
    const showingEnd = Math.min(end, total);
    
    pageInfo.textContent = `showing ${showingStart}-${showingEnd} of ${total}, ${total} member${total > 1 ? 's' : ''}`;
    
    if (btnPrev) {
        btnPrev.disabled = currentTeamPage === 1;
        btnPrev.style.opacity = btnPrev.disabled ? '0.3' : '1';
        btnPrev.style.cursor = btnPrev.disabled ? 'not-allowed' : 'pointer';
    }

    if (btnNext) {
        btnNext.disabled = end >= total;
        btnNext.style.opacity = btnNext.disabled ? 'not-allowed' : '1';
        btnNext.style.opacity = btnNext.disabled ? '0.3' : '1';
        btnNext.style.cursor = btnNext.disabled ? 'not-allowed' : 'pointer';
    }
}

function initTeamPagination() {
    const btnPrev = document.getElementById('btn-team-prev');
    const btnNext = document.getElementById('btn-team-next');
    if (btnPrev) {
        btnPrev.onclick = () => { if (currentTeamPage > 1) { currentTeamPage--; renderTeamPage(); } };
    }
    if (btnNext) {
        btnNext.onclick = () => { if (currentTeamPage * teamItemsPerPage < teamMembersFullList.length) { currentTeamPage++; renderTeamPage(); } };
    }
}

function addTeamMemberToTable(email, role, status = 'active', isYou = false) {
    const tableBody = document.getElementById('team-table-body');
    if (!tableBody) return;

    const row = document.createElement('tr');
    row.className = 'table-row-hover';
    row.style.cssText = 'border-bottom: 1px solid var(--border-glass); transition: background 0.2s ease;';

    const avatarInitial = email.charAt(0).toUpperCase();
    
    let statusBadge = '';
    let actionButtons = '';
    
    if (isYou) {
        statusBadge = `<span style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: var(--text-muted); font-size: 0.6rem; padding: 2px 6px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; text-transform: lowercase; margin-left: 8px;">you</span>`;
        actionButtons = `
            <div class="tooltip-wrapper">
                <button class="btn-cancel" style="padding: 0.4rem 0.8rem; font-size: 0.7rem; border-radius: 6px; opacity: 0.5; cursor: not-allowed; pointer-events: none;" disabled>leave team</button>
                <div class="pw-tooltip team-tooltip">
                    an organization requires at least 1 owner
                </div>
            </div>
        `;
    } else if (status === 'invited') {
        statusBadge = `<span class="status-badge invited-badge">invited</span>`;
        actionButtons = `
            <div style="display: flex; align-items: center; gap: 0.75rem; justify-content: flex-end;">
                <div class="tooltip-wrapper">
                    <button class="btn-cancel" style="padding: 0.4rem 0.8rem; font-size: 0.7rem; border-radius: 6px; opacity: 0.5; cursor: not-allowed; pointer-events: none; font-family: 'JetBrains Mono', monospace;" disabled>manage access</button>
                    <div class="pw-tooltip team-tooltip">
                        access can be managed after the invite is accepted
                    </div>
                </div>
                <div class="dropdown-actions-wrapper" style="position: relative;">
                    <button class="btn-more-actions">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.6;"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                    </button>
                    <div class="dropdown-menu row-actions-dropdown" style="top: calc(100% + 8px); right: 0; width: 210px; padding: 8px; background: rgba(8, 10, 12, 0.96); border: 1px solid rgba(0, 240, 255, 0.15); border-radius: 12px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 240, 255, 0.05); z-index: 1000;">
                        <div class="dropdown-item" onclick="resendInvite('${email}')" style="font-size: 0.75rem; gap: 10px; padding: 10px; cursor: pointer; font-family: 'JetBrains Mono', monospace;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.7;"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                            resend invitation
                        </div>
                        <div class="dropdown-item text-red" onclick="cancelInvite('${email}', this)" style="font-size: 0.75rem; gap: 10px; padding: 10px; cursor: pointer; font-family: 'JetBrains Mono', monospace;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.7;"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                            cancel invitation
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else {
        actionButtons = `
            <div style="display: flex; justify-content: flex-end;">
                <button class="btn-cancel" style="padding: 0.4rem 0.8rem; font-size: 0.7rem; border-radius: 6px; font-family: 'JetBrains Mono', monospace;">remove</button>
            </div>
        `;
    }

    row.innerHTML = `
        <td style="padding: 1.25rem 1.5rem;">
            <div style="display: flex; align-items: center; gap: 1rem;">
                <div class="org-avatar" style="border-radius: 8px; width: 34px; height: 34px; font-weight: 800; font-size: 0.9rem;">${avatarInitial}</div>
                <div style="display: flex; flex-direction: column;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; font-weight: 600; color: #fff;">${email}</span>
                        ${statusBadge}
                    </div>
                </div>
            </div>
        </td>
        <td style="padding: 1.25rem 1.5rem;">
            <div style="display: flex; align-items: center; gap: 6px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; font-size: 0.8rem;">
                disabled
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.5;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </div>
        </td>
        <td style="padding: 1.25rem 1.5rem;">
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: #fff; opacity: 0.9;">${role}</span>
        </td>
        <td style="padding: 1.25rem 1.5rem; text-align: right;">
            ${actionButtons}
        </td>
    `;

    tableBody.appendChild(row);

    const moreBtn = row.querySelector('.btn-more-actions');
    const dropdown = row.querySelector('.row-actions-dropdown');
    if (moreBtn && dropdown) {
        moreBtn.onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll('.row-actions-dropdown.active').forEach(d => {
                if (d !== dropdown) d.classList.remove('active');
            });
            dropdown.classList.toggle('active');
        };
    }

    const countEl = document.querySelector('.team-member-count');
    if (countEl) {
        const total = tableBody.querySelectorAll('tr').length;
        countEl.textContent = `${total} member${total !== 1 ? 's' : ''}`;
    }
}

function flipToNotifPanel() {
    const dropdown = document.getElementById('user-dropdown');
    const mainPanel = document.getElementById('dropdown-main-panel');
    const notifPanel = document.getElementById('dropdown-notif-panel');
    const items = document.getElementById('notification-items');
    const panelBody = document.getElementById('notif-panel-body');
    if (!dropdown || !mainPanel || !notifPanel || !panelBody) return;
    dropdown.style.height = dropdown.offsetHeight + 'px';
    if (items) panelBody.appendChild(items);
    mainPanel.style.transition = 'opacity 0.18s ease';
    mainPanel.style.opacity = '0';
    setTimeout(() => {
        mainPanel.style.display = 'none';
        mainPanel.style.opacity = '';
        mainPanel.style.transition = '';
        notifPanel.style.opacity = '0';
        notifPanel.style.transition = 'opacity 0.18s ease';
        notifPanel.classList.add('active');
        requestAnimationFrame(() => {
            notifPanel.style.opacity = '1';
            setTimeout(() => { notifPanel.style.opacity = ''; notifPanel.style.transition = ''; }, 180);
        });
    }, 180);
}

function flipToMainPanel() {
    const dropdown = document.getElementById('user-dropdown');
    const mainPanel = document.getElementById('dropdown-main-panel');
    const notifPanel = document.getElementById('dropdown-notif-panel');
    const items = document.getElementById('notification-items');
    const itemsWrapper = document.getElementById('notification-items-wrapper');
    if (!dropdown || !mainPanel || !notifPanel) return;
    notifPanel.style.transition = 'opacity 0.18s ease';
    notifPanel.style.opacity = '0';
    setTimeout(() => {
        notifPanel.classList.remove('active');
        notifPanel.style.opacity = '';
        notifPanel.style.transition = '';
        if (items && itemsWrapper) itemsWrapper.appendChild(items);
        mainPanel.style.display = '';
        dropdown.style.height = '';
        mainPanel.style.opacity = '0';
        mainPanel.style.transition = 'opacity 0.18s ease';
        requestAnimationFrame(() => {
            mainPanel.style.opacity = '1';
            setTimeout(() => { mainPanel.style.opacity = ''; mainPanel.style.transition = ''; }, 180);
        });
    }, 180);
}

document.addEventListener('DOMContentLoaded', () => {
    const notifRow = document.getElementById('notification-row');
    const backBtn = document.getElementById('notif-panel-back');
    if (notifRow) {
        notifRow.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            flipToNotifPanel();
        });
    }
    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            flipToMainPanel();
        });
    }
});

document.addEventListener('click', (e) => {
    document.querySelectorAll('.row-actions-dropdown.active').forEach(d => {
        d.classList.remove('active');
    });

    const trigger = document.getElementById('user-menu-trigger');
    const dropdown = document.getElementById('user-dropdown');
    if (trigger && dropdown && !trigger.contains(e.target) && !dropdown.contains(e.target)) {
        trigger.classList.remove('active');
        dropdown.classList.remove('active');
        flipToMainPanel();
    }
});

async function resendInvite(email) {
    const cooldownKey = `sentinel-resend-cooldown-${email}`;
    const last = localStorage.getItem(cooldownKey);
    if (last) {
        const remaining = 60000 - (Date.now() - parseInt(last));
        if (remaining > 0) {
            const secs = Math.ceil(remaining / 1000);
            if (window.SentinelToast) window.SentinelToast.show(`please wait ${secs}s before resending to this email.`, "warning");
            return;
        }
    }

    if (window.SentinelToast) window.SentinelToast.show(`resending invitation to ${email}...`, "info");
    
    try {
        const path = window.location.pathname;
        const orgMatch = path.match(/\/dashboard\/org\/([a-z0-9]{20})/);
        const orgSlug = orgMatch ? orgMatch[1] : null;

        if (!orgSlug) throw new Error("organization context missing");

        const token = window.supabaseAuthToken;

        const response = await fetch(`${API_URL}/v1/organizations/${orgSlug}/team/invite`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                emailList: [email],
                role: 'developer'
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'failed to resend invitation');
        }

        localStorage.setItem(cooldownKey, Date.now().toString());
        
        if (window.SentinelToast) window.SentinelToast.show(`invitation resent to ${email}`, "success");
    } catch (err) {
        if (window.SentinelToast) window.SentinelToast.show(err.message, "error");
    }
}

function cancelInvite(email, btnEl) {
    const path = window.location.pathname;
    const orgMatch = path.match(/\/dashboard\/org\/([a-z0-9]{20})/);
    const orgSlug = orgMatch ? orgMatch[1] : null;

    if (orgSlug) {
        const key = `sentinel-invites-${orgSlug}`;
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        const updated = existing.filter(m => m.email !== email);
        localStorage.setItem(key, JSON.stringify(updated));
    }

    const row = btnEl.closest('tr');
    if (row) {
        row.style.opacity = '0';
        row.style.transform = 'translateX(20px)';
        setTimeout(() => {
            row.remove();
            const countEl = document.querySelector('.team-member-count');
            const tableBody = document.getElementById('team-table-body');
            if (countEl && tableBody) {
                const total = tableBody.querySelectorAll('tr').length;
                countEl.textContent = `${total} member${total !== 1 ? 's' : ''}`;
            }
        }, 300);
    }
    
    if (window.SentinelToast) window.SentinelToast.show(`invitation for ${email} cancelled`, "info");
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
            
            const initial = org.name.charAt(0).toUpperCase();
            const planText = org.plan ? `${org.plan} plan` : 'standard plan';
            
            card.innerHTML = `
                <div class="org-card-avatar"></div>
                <div class="org-card-info">
                    <span class="org-card-name"></span>
                    <span class="org-card-meta"></span>
                </div>
                <svg style="margin-left: auto; opacity: 0.3; flex-shrink: 0;" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            `;
            card.querySelector('.org-card-avatar').textContent = initial;
            card.querySelector('.org-card-name').textContent = org.name;
            card.querySelector('.org-card-meta').textContent = planText;

            card.onclick = () => {
                const slug = org.slug;
                history.pushState({ slug }, '', `/dashboard/org/${slug}`);
                switchToOrgView(slug, 'projects');
            };

            orgCardsGrid.appendChild(card);
        });
    }
}

let _allOrgsCache = [];

function filterOrgGrid(q) {
    const grid = document.querySelector('.org-cards-grid');
    if (!grid) return;
    const cards = grid.querySelectorAll('.org-card-item');
    const term = q.toLowerCase().trim();
    cards.forEach(card => {
        const name = (card.querySelector('.org-card-name') || {}).textContent || '';
        const matches = !term || name.toLowerCase().includes(term);
        card.style.display = matches ? '' : 'none';
        if (term && matches) {
            card.classList.add('org-card-match');
        } else {
            card.classList.remove('org-card-match');
        }
    });
}

function initOrgSearch() {
    const input = document.querySelector('.org-search-input');
    if (!input) return;
    const urlQ = new URLSearchParams(window.location.search).get('q') || '';
    if (urlQ) {
        input.value = urlQ;
        filterOrgGrid(urlQ);
    }
    input.addEventListener('input', function() {
        const q = this.value.trim();
        const url = q ? '/dashboard/organizations?q=' + encodeURIComponent(q) : '/dashboard/organizations';
        history.replaceState({}, '', url);
        filterOrgGrid(q);
    });
}

function hideAllViews() {
    ['org-home-view','org-dashboard-view','dashboard-view','org-team-view','org-settings-view','account-settings-view'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
}

function switchToHomeView() {
    currentOrgSlug = null;
    document.body.classList.remove('state-in-org');
    document.body.classList.add('state-org-home');
    hideAllViews();
    document.getElementById('org-home-view').classList.remove('hidden');

    const globalNav = document.getElementById('sidebar-global-nav');
    const orgNav = document.getElementById('sidebar-org-nav');
    const accountNav = document.getElementById('sidebar-account-nav');
    if (globalNav) globalNav.classList.remove('hidden');
    if (orgNav) orgNav.classList.add('hidden');
    if (accountNav) accountNav.classList.add('hidden');
}

function switchToAccountSettings(tab) {
    tab = tab || 'preferences';
    currentOrgSlug = null;
    document.body.classList.remove('state-in-org');
    document.body.classList.add('state-org-home');
    hideAllViews();
    document.getElementById('account-settings-view').classList.remove('hidden');
    document.title = 'sentinelpay | account settings';

    const globalNav = document.getElementById('sidebar-global-nav');
    const orgNav = document.getElementById('sidebar-org-nav');
    const accountNav = document.getElementById('sidebar-account-nav');
    if (globalNav) globalNav.classList.add('hidden');
    if (orgNav) orgNav.classList.add('hidden');
    if (accountNav) {
        accountNav.classList.remove('hidden');
        accountNav.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
        const tabToId = { 'preferences': 'sidebar-item-preferences', 'security': 'sidebar-item-security', 'access-tokens': 'sidebar-item-tokens' };
        const activeEl = document.getElementById(tabToId[tab]);
        if (activeEl) activeEl.classList.add('active');
    }

    const tabTitles = { 'preferences': 'preferences', 'security': 'security', 'access-tokens': 'access tokens' };
    const titleEl = document.getElementById('account-settings-tab-title');
    if (titleEl) titleEl.textContent = tabTitles[tab] || tab;

    ['preferences', 'security', 'access-tokens'].forEach(t => {
        const panel = document.getElementById('account-tab-' + t);
        if (panel) panel.style.display = t === tab ? '' : 'none';
    });

    if (!accountNav || accountNav.dataset.accountNavBound) return;
    accountNav.dataset.accountNavBound = 'true';
    [
        { id: 'sidebar-item-preferences', tab: 'preferences' },
        { id: 'sidebar-item-security', tab: 'security' },
        { id: 'sidebar-item-tokens', tab: 'access-tokens' }
    ].forEach(({ id, tab: t }) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('click', e => {
            e.preventDefault();
            history.pushState({}, '', '/dashboard/account/settings/' + t);
            switchToAccountSettings(t);
        });
    });
}

function switchToOrgView(slug, view = 'projects') {
    currentOrgSlug = slug;
    document.body.classList.remove('state-org-home');
    document.body.classList.add('state-in-org');
    document.getElementById('org-home-view').classList.add('hidden');
    document.getElementById('dashboard-view').classList.add('hidden');
    
    const globalNav = document.getElementById('sidebar-global-nav');
    const orgNav = document.getElementById('sidebar-org-nav');
    const accountNav = document.getElementById('sidebar-account-nav');
    if (globalNav) globalNav.classList.add('hidden');
    if (orgNav) orgNav.classList.remove('hidden');
    if (accountNav) accountNav.classList.add('hidden');

    const subViews = ['org-dashboard-view', 'org-team-view', 'org-settings-view'];
    subViews.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    document.querySelectorAll('#sidebar-org-nav .sidebar-item').forEach(i => i.classList.remove('active'));

    if (view === 'team') {
        const teamView = document.getElementById('org-team-view');
        if (teamView) teamView.classList.remove('hidden');
        const teamItem = document.getElementById('sidebar-item-team');
        if (teamItem) teamItem.classList.add('active');
        loadTeamFromApi(slug);
    } else if (view === 'settings') {
        const settingsView = document.getElementById('org-settings-view');
        if (settingsView) settingsView.classList.remove('hidden');
        const settingsItem = document.getElementById('sidebar-item-settings');
        if (settingsItem) settingsItem.classList.add('active');
        renderOrgSettings(slug, window.supabaseAuthToken);
    } else {
        const dashView = document.getElementById('org-dashboard-view');
        if (dashView) dashView.classList.remove('hidden');
        const projItem = document.getElementById('sidebar-item-projects');
        if (projItem) projItem.classList.add('active');
        renderOrgDashboard(slug, window.supabaseAuthToken);
    }
}

async function renderOrgDashboard(slug, token) {
    const view = document.getElementById('org-dashboard-view');
    if (!view || !token) return;

    view.innerHTML = `<div style="color: var(--text-muted); font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; padding: 2rem;">loading...</div>`;

    try {
        const res = await fetch(`/v1/organizations/${slug}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('failed to load organization');
        const org = await res.json();

        const orgNameEl = document.getElementById('current-org-name');
        if (orgNameEl) orgNameEl.textContent = org.name;
        const orgAvatarEl = document.getElementById('org-avatar-circle');
        if (orgAvatarEl) orgAvatarEl.textContent = org.name.charAt(0).toUpperCase();
        const orgPlanEl = document.querySelector('.org-switcher-trigger .org-plan');
        if (orgPlanEl) orgPlanEl.textContent = `${org.plan || 'starter'} plan`;

        const cached = localStorage.getItem('sentinel-cached-orgs');
        if (cached) {
            try { updateDropdownOrgList(JSON.parse(cached), slug); } catch (e) {}
        }

        const planLabel = org.plan || 'starter';
        const regionLabel = org.region || 'americas';
        const createdLabel = new Date(org.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

        const ownerBadge = org.isOwner
            ? `<span style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:var(--text-muted);font-size:0.65rem;padding:3px 8px;border-radius:4px;font-family:'JetBrains Mono',monospace;text-transform:lowercase;">owner</span>`
            : '';
        const inviteBtn = org.isOwner
            ? `<button class="btn-new-org" id="org-invite-quick-btn" style="white-space:nowrap;flex-shrink:0;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" y1="8" x2="19" y2="14"></line><line x1="22" y1="11" x2="16" y2="11"></line></svg>invite members</button>`
            : '';

        view.innerHTML = `
<div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:1rem;">
    <div>
        <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem;">
            <h1 id="org-page-name" style="font-family:'JetBrains Mono',monospace;font-size:1.5rem;font-weight:800;letter-spacing:-1px;color:#fff;margin:0;"></h1>
            <span id="org-page-plan" style="background:rgba(0,240,255,0.1);border:1px solid rgba(0,240,255,0.2);color:var(--neon-blue);font-size:0.65rem;padding:3px 8px;border-radius:4px;font-family:'JetBrains Mono',monospace;text-transform:lowercase;"></span>
            ${ownerBadge}
        </div>
        <div style="color:var(--text-muted);font-family:'JetBrains Mono',monospace;font-size:0.75rem;" id="org-page-meta"></div>
    </div>
    ${inviteBtn}
</div>

<div class="summary-cards" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));">
    <div class="metric-card">
        <div class="metric-header"><span class="metric-label">total scans</span><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg></div>
        <div class="metric-value-container"><span class="metric-value" id="org-stat-scans">0</span></div>
        <span class="metric-trend neutral">all time</span>
    </div>
    <div class="metric-card">
        <div class="metric-header"><span class="metric-label">team members</span><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg></div>
        <div class="metric-value-container"><span class="metric-value" id="org-stat-members">0</span></div>
        <span class="metric-trend neutral">active</span>
    </div>
    <div class="metric-card">
        <div class="metric-header"><span class="metric-label">plan</span><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--neon-blue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg></div>
        <div class="metric-value-container"><span class="metric-value text-white" style="font-size:1.6rem;" id="org-stat-plan"></span></div>
        <span class="metric-trend neutral" id="org-stat-region"></span>
    </div>
    <div class="metric-card">
        <div class="metric-header"><span class="metric-label">system health</span><div class="pulse-dot-container"><div class="pulse-dot"></div></div></div>
        <div class="metric-value-container"><span class="metric-value text-white" style="font-size:2rem;">nominal</span></div>
        <span class="metric-trend neutral">all systems operational</span>
    </div>
</div>

<div class="glass-panel" style="padding:1.5rem;border-radius:12px;background:rgba(15,15,15,0.4);border:1px solid var(--border-glass);">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:0.75rem;font-weight:700;color:#fff;text-transform:lowercase;letter-spacing:0.5px;">recent scans</div>
        <span style="font-family:'JetBrains Mono',monospace;font-size:0.65rem;color:var(--text-muted);">last 30 days</span>
    </div>
    <div id="org-recent-scans" style="color:var(--text-muted);font-family:'JetBrains Mono',monospace;font-size:0.75rem;padding:1.5rem 0;text-align:center;opacity:0.6;">no scans yet. start scanning wallets via the api.</div>
</div>`;

        view.querySelector('#org-page-name').textContent = org.name;
        view.querySelector('#org-page-plan').textContent = org.plan || 'starter';
        view.querySelector('#org-page-meta').textContent = `${regionLabel} · created ${createdLabel}`;
        view.querySelector('#org-stat-scans').textContent = org.scanCount || 0;
        view.querySelector('#org-stat-members').textContent = org.memberCount || 0;
        view.querySelector('#org-stat-plan').textContent = org.plan || 'starter';
        view.querySelector('#org-stat-region').textContent = regionLabel;

        const quickInviteBtn = view.querySelector('#org-invite-quick-btn');
        if (quickInviteBtn) {
            quickInviteBtn.onclick = () => {
                const inviteBtn = document.getElementById('btn-invite-member');
                if (inviteBtn) inviteBtn.click();
            };
        }
    } catch (err) {
        const errDiv = document.createElement('div');
        errDiv.style.cssText = 'color:var(--color-red);font-family:\'JetBrains Mono\',monospace;font-size:0.8rem;padding:2rem;';
        errDiv.textContent = err.message;
        view.innerHTML = '';
        view.appendChild(errDiv);
    }
}

async function renderOrgSettings(slug, token) {
    const view = document.getElementById('org-settings-view');
    if (!view || !token) return;

    view.innerHTML = `<div style="color:var(--text-muted);font-family:'JetBrains Mono',monospace;font-size:0.8rem;padding:2rem;">loading...</div>`;

    try {
        const res = await fetch(`/v1/organizations/${slug}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('failed to load organization');
        const org = await res.json();

        if (!org.isOwner) {
            view.innerHTML = `<div style="color:var(--text-muted);font-family:'JetBrains Mono',monospace;font-size:0.8rem;padding:2rem;">only the owner can access settings.</div>`;
            return;
        }

        const createdLabel = new Date(org.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        view.innerHTML = `
<h1 style="font-family:'JetBrains Mono',monospace;font-size:1.5rem;font-weight:800;letter-spacing:-1px;color:#fff;margin:0 0 2rem;">settings</h1>

<div style="padding:1.5rem;border-radius:12px;background:rgba(15,15,15,0.4);border:1px solid var(--border-glass);margin-bottom:1.5rem;">
    <div style="font-family:'JetBrains Mono',monospace;font-size:0.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:1.25rem;">general</div>
    <div style="display:flex;flex-direction:column;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem 0;border-bottom:1px solid rgba(255,255,255,0.04);">
            <span style="font-family:'JetBrains Mono',monospace;font-size:0.75rem;color:var(--text-muted);">organization name</span>
            <span style="font-family:'JetBrains Mono',monospace;font-size:0.78rem;color:#e0e0e0;">${org.name}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem 0;border-bottom:1px solid rgba(255,255,255,0.04);">
            <span style="font-family:'JetBrains Mono',monospace;font-size:0.75rem;color:var(--text-muted);">plan</span>
            <span style="font-family:'JetBrains Mono',monospace;font-size:0.78rem;color:var(--neon-blue);">${org.plan || 'starter'}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem 0;border-bottom:1px solid rgba(255,255,255,0.04);">
            <span style="font-family:'JetBrains Mono',monospace;font-size:0.75rem;color:var(--text-muted);">region</span>
            <span style="font-family:'JetBrains Mono',monospace;font-size:0.78rem;color:#e0e0e0;">${org.region || 'americas'}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem 0;">
            <span style="font-family:'JetBrains Mono',monospace;font-size:0.75rem;color:var(--text-muted);">created</span>
            <span style="font-family:'JetBrains Mono',monospace;font-size:0.78rem;color:#e0e0e0;">${createdLabel}</span>
        </div>
    </div>
</div>

<div style="padding:1.5rem;border-radius:12px;background:rgba(12,4,4,0.7);border:1px solid rgba(255,51,51,0.12);">
    <div style="font-family:'JetBrains Mono',monospace;font-size:0.65rem;font-weight:700;color:rgba(255,51,51,0.5);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:1.25rem;">danger zone</div>
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:2rem;flex-wrap:wrap;">
        <div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:0.82rem;color:#e0e0e0;font-weight:600;margin-bottom:0.4rem;">delete organization</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;color:var(--text-muted);line-height:1.6;max-width:380px;">permanently removes this organization, all members, api keys, and scan history. this cannot be undone.</div>
        </div>
        <button id="btn-delete-org-init" style="flex-shrink:0;background:transparent;border:1px solid rgba(255,51,51,0.3);color:rgba(255,80,80,0.85);font-family:'JetBrains Mono',monospace;font-size:0.74rem;padding:0.5rem 1rem;border-radius:8px;cursor:pointer;white-space:nowrap;">delete organization</button>
    </div>
    <div id="delete-confirm-zone" style="display:none;margin-top:1.5rem;padding-top:1.25rem;border-top:1px solid rgba(255,51,51,0.1);">
        <div style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;color:var(--text-muted);margin-bottom:0.75rem;">type <span style="color:#e0e0e0;">${org.name}</span> to confirm deletion:</div>
        <div style="display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap;">
            <input id="delete-confirm-input" type="text" placeholder="${org.name}" style="flex:1;min-width:160px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,51,51,0.2);border-radius:8px;padding:0.55rem 0.875rem;font-family:'JetBrains Mono',monospace;font-size:0.75rem;color:#e0e0e0;outline:none;box-sizing:border-box;">
            <button id="btn-delete-org-confirm" style="background:rgba(255,51,51,0.12);border:1px solid rgba(255,51,51,0.3);color:rgba(255,80,80,0.9);font-family:'JetBrains Mono',monospace;font-size:0.74rem;padding:0.55rem 1rem;border-radius:8px;cursor:pointer;white-space:nowrap;">confirm delete</button>
        </div>
        <p id="delete-org-error" class="error-msg" style="display:none;margin-top:0.75rem;"></p>
    </div>
</div>`;

        document.getElementById('btn-delete-org-init').onclick = () => {
            document.getElementById('delete-confirm-zone').style.display = 'block';
            document.getElementById('btn-delete-org-init').style.display = 'none';
        };

        document.getElementById('btn-delete-org-confirm').onclick = async () => {
            const confirmName = document.getElementById('delete-confirm-input').value.trim();
            const errEl = document.getElementById('delete-org-error');
            errEl.style.display = 'none';

            if (confirmName !== org.name) {
                errEl.textContent = 'error: name does not match.';
                errEl.style.display = 'block';
                return;
            }

            const btn = document.getElementById('btn-delete-org-confirm');
            btn.disabled = true;
            btn.textContent = 'deleting...';

            try {
                const delRes = await fetch(`/v1/organizations/${slug}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!delRes.ok) {
                    const d = await delRes.json();
                    throw new Error(d.error || 'failed to delete');
                }
                localStorage.removeItem('sentinel-cached-orgs');
                switchToHomeView();
                fetchProfile(token);
            } catch (err) {
                errEl.textContent = `error: ${err.message.toLowerCase()}`;
                errEl.style.display = 'block';
                btn.disabled = false;
                btn.textContent = 'confirm delete';
            }
        };

    } catch (err) {
        view.innerHTML = `<div style="color:var(--text-muted);font-family:'JetBrains Mono',monospace;font-size:0.8rem;padding:2rem;">error: ${err.message}</div>`;
    }
}

async function loadTeamFromApi(slug) {
    try {
        const res = await fetch(`/v1/organizations/${slug}/members`, {
            headers: { 'Authorization': `Bearer ${window.supabaseAuthToken}` }
        });
        if (!res.ok) { loadInvitedMembers(slug); return; }
        const data = await res.json();
        teamMembersFullList = [
            ...data.members.map(m => ({
                email: m.username || m.email,
                role: m.role, status: m.status, isYou: m.isYou
            })),
            ...data.pendingInvites.map(inv => ({
                email: inv.email,
                role: inv.role, status: 'invited', isYou: false
            }))
        ];
        currentTeamPage = 1;
        initTeamPagination();
        renderTeamPage();
    } catch (err) {
        loadInvitedMembers(slug);
    }
}

async function fetchPendingInvitations(token) {
    try {
        const res = await fetch('/v1/user/pending-invitations', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        const invites = await res.json();
        renderNotifications(invites, token);
    } catch (err) {}
}

function renderNotifications(invites, token) {
    const section = document.getElementById('notification-section');
    const container = document.getElementById('notification-items');
    const wrapper = document.getElementById('notification-items-wrapper');
    const badge = document.getElementById('notification-badge');
    if (!section || !container) return;

    const notifRow = document.getElementById('notification-row');
    if (!invites || invites.length === 0) {
        if (wrapper) wrapper.style.display = 'none';
        if (badge) { badge.style.display = 'none'; badge.textContent = ''; }
        if (notifRow) notifRow.classList.remove('has-notifications');
        return;
    }

    const count = invites.length;
    if (badge) {
        badge.textContent = count >= 100 ? '99+' : count;
        badge.style.display = '';
    }
    if (wrapper) wrapper.style.display = 'block';
    if (notifRow) notifRow.classList.add('has-notifications');

    container.innerHTML = '';
    invites.forEach(inv => {
        const item = document.createElement('div');
        item.style.cssText = 'padding: 10px 16px; display: flex; flex-direction: column; gap: 6px; border-bottom: 1px solid rgba(255,255,255,0.04);';

        const orgNameSpan = document.createElement('strong');
        orgNameSpan.textContent = inv.orgName;

        const titleDiv = document.createElement('div');
        titleDiv.style.cssText = 'font-size:0.72rem;color:#fff;font-family:\'JetBrains Mono\',monospace;';
        titleDiv.append('invited to ', orgNameSpan);

        const metaSpan = document.createElement('span');
        metaSpan.style.cssText = 'font-size:0.65rem;color:var(--text-muted);font-family:\'JetBrains Mono\',monospace;';
        metaSpan.textContent = `by ${inv.invitedBy} · ${inv.role}`;

        const acceptBtn = document.createElement('button');
        acceptBtn.textContent = 'accept';
        acceptBtn.style.cssText = 'padding:3px 10px;font-size:0.65rem;border-radius:4px;background:rgba(0,240,255,0.1);border:1px solid rgba(0,240,255,0.3);color:var(--neon-blue);cursor:pointer;font-family:\'JetBrains Mono\',monospace;';

        const dismissBtn = document.createElement('button');
        dismissBtn.textContent = 'dismiss';
        dismissBtn.style.cssText = 'padding:3px 10px;font-size:0.65rem;border-radius:4px;background:transparent;border:1px solid rgba(255,255,255,0.08);color:var(--text-muted);cursor:pointer;font-family:\'JetBrains Mono\',monospace;';

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:6px;margin-top:2px;';
        btnRow.append(acceptBtn, dismissBtn);

        item.append(titleDiv, metaSpan, btnRow);

        acceptBtn.onclick = async (e) => {
            e.stopPropagation();
            acceptBtn.disabled = true;
            acceptBtn.textContent = '...';
            try {
                const r = await fetch(`/v1/user/pending-invitations/${inv.id}/accept`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const result = await r.json();
                if (!r.ok) throw new Error(result.error || 'failed');
                if (window.SentinelToast) window.SentinelToast.show(`joined ${inv.orgName} successfully.`, 'success');
                item.remove();
                fetchProfile(token);
                const remaining = container.children.length;
                const w = document.getElementById('notification-items-wrapper');
                if (!remaining && w) w.style.display = 'none';
                if (badge) { badge.textContent = remaining >= 100 ? '99+' : (remaining || ''); badge.style.display = remaining ? '' : 'none'; }
                if (!remaining) { const nr = document.getElementById('notification-row'); if (nr) nr.classList.remove('has-notifications'); }
            } catch (err) {
                if (window.SentinelToast) window.SentinelToast.show(err.message, 'error');
                acceptBtn.disabled = false;
                acceptBtn.textContent = 'accept';
            }
        };

        dismissBtn.onclick = (e) => {
            e.stopPropagation();
            item.remove();
            const remaining = container.children.length;
            const w = document.getElementById('notification-items-wrapper');
            if (!remaining && w) w.style.display = 'none';
            if (badge) { badge.textContent = remaining >= 100 ? '99+' : (remaining || ''); badge.style.display = remaining ? '' : 'none'; }
            if (!remaining) { const nr = document.getElementById('notification-row'); if (nr) nr.classList.remove('has-notifications'); }
        };

        container.appendChild(item);
    });
}

window.onpopstate = (e) => {
    const currentPath = window.location.pathname;
    const orgMatch = currentPath.match(/^\/dashboard\/org\/([a-z0-9]{20})(\/[a-z0-9-]+)?$/);
    if (orgMatch) {
        switchToOrgView(orgMatch[1], orgMatch[2] ? orgMatch[2].substring(1) : 'projects');
    } else if (currentPath === '/dashboard' || currentPath === '/dashboard/organizations' || currentPath === '/dashboard/') {
        switchToHomeView();
    } else {
        window.location.replace('/dashboard/organizations');
    }
};

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

function setUsernamePrefixVisible(visible) {
    const prefUsernamePrefix = document.getElementById('pref-username-prefix');
    if (!prefUsernamePrefix) return;
    prefUsernamePrefix.classList.toggle('prefix-hidden', !visible);
    const wrap = prefUsernamePrefix.closest('.settings-input-prefix-wrap');
    if (wrap) wrap.classList.toggle('no-prefix', !visible);
}

function applyProfileToForm(profile) {
    if (!profile) return;
    const prefEmail = document.getElementById('pref-email');
    const prefUsername = document.getElementById('pref-username');
    const prefFirstName = document.getElementById('pref-first-name');
    const prefLastName = document.getElementById('pref-last-name');
    const hasUsername = Boolean(profile.username);
    if (prefEmail) prefEmail.value = profile.email || '';
    if (prefUsername) {
        prefUsername.value = hasUsername ? profile.username : (profile.email || '');
        prefUsername.dataset.isFallback = hasUsername ? 'false' : 'true';
    }
    setUsernamePrefixVisible(hasUsername);
    if (prefFirstName) prefFirstName.value = profile.firstName || '';
    if (prefLastName) prefLastName.value = profile.lastName || '';
}

async function fetchProfile(token) {
    try {
        const cachedRaw = localStorage.getItem('sentinel-cached-profile');
        if (cachedRaw) {
            try { applyProfileToForm(JSON.parse(cachedRaw)); } catch {}
        }

        const response = await fetch('/v1/user/profile', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) return;
        const profile = await response.json();
        localStorage.setItem('sentinel-cached-profile', JSON.stringify({
            email: profile.email || '',
            username: profile.username || '',
            firstName: profile.firstName || '',
            lastName: profile.lastName || '',
            authProvider: profile.authProvider || 'email'
        }));

        const teamEmailEl = document.getElementById('current-user-email');
        const displayId = profile.username || profile.email;
        if (teamEmailEl && displayId) {
            teamEmailEl.textContent = displayId;
            const teamAvatarEl = document.getElementById('team-owner-avatar');
            if (teamAvatarEl) teamAvatarEl.textContent = displayId.charAt(0).toUpperCase();
        }

        const dropdownEl = document.getElementById('dropdown-email');
        if (dropdownEl) {
            dropdownEl.textContent = profile.username ? `@${profile.username}` : (profile.email || '');
        }
        const topAvatarEl = document.getElementById('org-avatar-circle');
        if (topAvatarEl && displayId) topAvatarEl.textContent = displayId.charAt(0).toUpperCase();

        applyProfileToForm(profile);

        const prefUsernameInput = document.getElementById('pref-username');
        if (prefUsernameInput && !prefUsernameInput.dataset.prefixBound) {
            prefUsernameInput.dataset.prefixBound = 'true';
            const refreshPrefix = () => setUsernamePrefixVisible(prefUsernameInput.dataset.isFallback !== 'true');
            prefUsernameInput.addEventListener('input', () => {
                prefUsernameInput.dataset.isFallback = 'false';
                refreshPrefix();
            });
            prefUsernameInput.addEventListener('focus', refreshPrefix);
            prefUsernameInput.addEventListener('blur', refreshPrefix);
        }

        const saveBtn = document.getElementById('btn-save-preferences');
        if (saveBtn && !saveBtn.dataset.bound) {
            saveBtn.dataset.bound = 'true';
            const notify = (text, kind) => {
                if (window.SentinelToast) window.SentinelToast.show(text, kind);
            };
            const playPulse = (el, cls) => {
                if (!el) return;
                el.classList.remove(cls);
                void el.offsetWidth;
                el.classList.add(cls);
                setTimeout(() => el.classList.remove(cls), 700);
            };
            const resetSaveBtn = () => {
                saveBtn.disabled = false;
                saveBtn.removeAttribute('data-busy');
                saveBtn.textContent = 'save';
            };
            const setSaveBtnBusy = () => {
                saveBtn.disabled = true;
                saveBtn.setAttribute('data-busy', '1');
                saveBtn.textContent = 'saving...';
            };

            const maskEmail = (email) => {
                const [local, domain] = email.split('@');
                if (!domain) return email;
                const visible = local.slice(0, Math.min(2, local.length));
                return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`;
            };

            const makeOtpGroup = (containerSelector, formId) => {
                const boxes = Array.from(document.querySelectorAll(`${containerSelector} .otp-box`));
                const form = document.getElementById(formId);
                const getValue = () => boxes.map(b => b.value).join('');
                const clear = () => boxes.forEach(b => { b.value = ''; b.classList.remove('filled'); });
                boxes.forEach((box, i) => {
                    box.addEventListener('input', () => {
                        const val = box.value.replace(/[^0-9]/g, '');
                        box.value = val.slice(-1);
                        box.classList.toggle('filled', Boolean(box.value));
                        if (box.value && i < boxes.length - 1) boxes[i + 1].focus();
                        if (getValue().length === 6) form.requestSubmit();
                    });
                    box.addEventListener('keydown', (e) => {
                        if (e.key === 'Backspace' && !box.value && i > 0) {
                            boxes[i - 1].value = '';
                            boxes[i - 1].classList.remove('filled');
                            boxes[i - 1].focus();
                        }
                        if (e.key === 'ArrowLeft' && i > 0) boxes[i - 1].focus();
                        if (e.key === 'ArrowRight' && i < boxes.length - 1) boxes[i + 1].focus();
                    });
                    box.addEventListener('paste', (e) => {
                        e.preventDefault();
                        const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '');
                        pasted.split('').slice(0, 6).forEach((ch, j) => {
                            if (boxes[j]) { boxes[j].value = ch; boxes[j].classList.add('filled'); }
                        });
                        const next = boxes[Math.min(pasted.length, 5)];
                        if (next) next.focus();
                        if (pasted.length >= 6) form.requestSubmit();
                    });
                    box.addEventListener('focus', () => box.select());
                });
                return { boxes, getValue, clear };
            };

            const otpOld = makeOtpGroup('#otp-boxes', 'email-verify-code-form');
            const otpNew = makeOtpGroup('#otp-boxes-new', 'email-verify-new-code-form');

            function verifyEmailChangeFlow(currentEmail, mode, newEmail) {
                return new Promise((resolve) => {
                    const overlay = document.getElementById('email-verify-modal-overlay');
                    const stepPassword = document.getElementById('email-verify-step-password');
                    const stepCode = document.getElementById('email-verify-step-code');
                    const stepNewCode = document.getElementById('email-verify-step-new-code');
                    const closeBtn = document.getElementById('btn-close-email-verify');
                    const passwordForm = document.getElementById('email-verify-password-form');
                    const passwordInput = document.getElementById('email-verify-password');
                    const passwordError = document.getElementById('email-verify-password-error');
                    const passwordBtn = document.getElementById('email-verify-password-btn');
                    const codeForm = document.getElementById('email-verify-code-form');
                    const codeError = document.getElementById('email-verify-code-error');
                    const codeBtn = document.getElementById('email-verify-code-btn');
                    const resendBtn = document.getElementById('email-verify-resend-btn');
                    const newCodeForm = document.getElementById('email-verify-new-code-form');
                    const newCodeError = document.getElementById('email-verify-new-code-error');
                    const newCodeBtn = document.getElementById('email-verify-new-code-btn');
                    const resendNewBtn = document.getElementById('email-verify-resend-new-btn');

                    if (!overlay || !stepPassword || !stepCode || !stepNewCode) { resolve(false); return; }

                    const showError = (el, msg) => { el.textContent = msg; el.style.display = 'block'; };
                    const hideError = (el) => { el.style.display = 'none'; el.textContent = ''; };

                    let settled = false;
                    const finish = (result) => {
                        if (settled) return;
                        settled = true;
                        cleanup();
                        overlay.classList.remove('active');
                        document.body.classList.remove('modal-open');
                        resolve(result);
                    };

                    const onClose = () => finish(false);
                    const onOverlayClick = (e) => { if (e.target === overlay) finish(false); };

                    const startCooldown = (btn) => {
                        let secs = 60;
                        btn.disabled = true;
                        btn.textContent = `resend in ${secs}s`;
                        const id = setInterval(() => {
                            secs -= 1;
                            if (secs <= 0) { clearInterval(id); btn.disabled = false; btn.textContent = 'resend code'; }
                            else btn.textContent = `resend in ${secs}s`;
                        }, 1000);
                    };

                    const sendOldCode = async (btn) => {
                        try {
                            const r = await fetch('/v1/user/email-change/send-code', {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
                            });
                            if (r.status === 429) { if (btn) startCooldown(btn); return false; }
                            if (r.ok && btn) startCooldown(btn);
                            return r.ok;
                        } catch { return false; }
                    };

                    const sendNewCode = async (btn) => {
                        try {
                            const r = await fetch('/v1/user/email-change/send-code-new', {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ newEmail })
                            });
                            if (r.status === 429) { if (btn) startCooldown(btn); return false; }
                            if (r.ok && btn) startCooldown(btn);
                            return r.ok;
                        } catch { return false; }
                    };

                    const showCodeStep = () => {
                        stepPassword.style.display = 'none';
                        stepCode.style.display = 'flex';
                        stepNewCode.style.display = 'none';
                        otpOld.clear();
                        hideError(codeError);
                        codeBtn.disabled = false;
                        codeBtn.textContent = 'verify';
                        resendBtn.disabled = false;
                        resendBtn.textContent = 'resend code';
                        const targetEl = document.getElementById('email-verify-code-target');
                        if (targetEl) targetEl.textContent = currentEmail ? maskEmail(currentEmail) : 'your email';
                        otpOld.boxes[0].focus();
                        sendOldCode(resendBtn);
                    };

                    const showNewCodeStep = () => {
                        stepPassword.style.display = 'none';
                        stepCode.style.display = 'none';
                        stepNewCode.style.display = 'flex';
                        otpNew.clear();
                        hideError(newCodeError);
                        newCodeBtn.disabled = false;
                        newCodeBtn.textContent = 'verify';
                        resendNewBtn.disabled = false;
                        resendNewBtn.textContent = 'resend code';
                        const targetEl = document.getElementById('email-verify-new-target');
                        if (targetEl) targetEl.textContent = maskEmail(newEmail);
                        otpNew.boxes[0].focus();
                        sendNewCode(resendNewBtn);
                    };

                    const onPasswordSubmit = async (e) => {
                        e.preventDefault();
                        const pwd = passwordInput.value;
                        if (!pwd) return;
                        hideError(passwordError);
                        passwordBtn.disabled = true;
                        passwordBtn.textContent = 'verifying...';
                        try {
                            const { error } = await sentinelAuth.auth.signInWithPassword({ email: currentEmail, password: pwd });
                            passwordBtn.disabled = false;
                            passwordBtn.textContent = 'continue';
                            if (error) { showError(passwordError, 'error: incorrect password'); return; }
                            passwordInput.value = '';
                            showCodeStep();
                        } catch {
                            passwordBtn.disabled = false;
                            passwordBtn.textContent = 'continue';
                            showError(passwordError, 'error: verification failed. try again');
                        }
                    };

                    const onResend = async (e) => {
                        e.preventDefault();
                        if (resendBtn.disabled) return;
                        resendBtn.disabled = true;
                        resendBtn.textContent = 'sending...';
                        const ok = await sendOldCode(null);
                        if (ok) {
                            notify('a new code has been sent', 'info');
                            startCooldown(resendBtn);
                        } else {
                            resendBtn.disabled = false;
                            resendBtn.textContent = 'resend code';
                            notify('error: please wait before requesting another code', 'error');
                        }
                    };

                    const onResendNew = async (e) => {
                        e.preventDefault();
                        if (resendNewBtn.disabled) return;
                        resendNewBtn.disabled = true;
                        resendNewBtn.textContent = 'sending...';
                        const ok = await sendNewCode(null);
                        if (ok) {
                            notify('a new code has been sent', 'info');
                            startCooldown(resendNewBtn);
                        } else {
                            resendNewBtn.disabled = false;
                            resendNewBtn.textContent = 'resend code';
                            notify('error: please wait before requesting another code', 'error');
                        }
                    };

                    const onCodeSubmit = async (e) => {
                        e.preventDefault();
                        const code = otpOld.getValue();
                        if (!/^[0-9]{6}$/.test(code)) { showError(codeError, 'error: enter all 6 digits'); return; }
                        hideError(codeError);
                        codeBtn.disabled = true;
                        codeBtn.textContent = 'verifying...';
                        try {
                            const r = await fetch('/v1/user/email-change/verify-code', {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ code })
                            });
                            const data = await r.json();
                            codeBtn.disabled = false;
                            codeBtn.textContent = 'verify';
                            if (!r.ok) { showError(codeError, `error: ${data.error || 'incorrect code'}`); return; }
                            showNewCodeStep();
                        } catch {
                            codeBtn.disabled = false;
                            codeBtn.textContent = 'verify';
                            showError(codeError, 'error: verification failed. try again');
                        }
                    };

                    const onNewCodeSubmit = async (e) => {
                        e.preventDefault();
                        const code = otpNew.getValue();
                        if (!/^[0-9]{6}$/.test(code)) { showError(newCodeError, 'error: enter all 6 digits'); return; }
                        hideError(newCodeError);
                        newCodeBtn.disabled = true;
                        newCodeBtn.textContent = 'verifying...';
                        try {
                            const r = await fetch('/v1/user/email-change/verify-code-new', {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ code })
                            });
                            const data = await r.json();
                            newCodeBtn.disabled = false;
                            newCodeBtn.textContent = 'verify';
                            if (!r.ok) { showError(newCodeError, `error: ${data.error || 'incorrect code'}`); return; }
                            finish(true);
                        } catch {
                            newCodeBtn.disabled = false;
                            newCodeBtn.textContent = 'verify';
                            showError(newCodeError, 'error: verification failed. try again');
                        }
                    };

                    function cleanup() {
                        closeBtn.removeEventListener('click', onClose);
                        overlay.removeEventListener('click', onOverlayClick);
                        passwordForm.removeEventListener('submit', onPasswordSubmit);
                        codeForm.removeEventListener('submit', onCodeSubmit);
                        newCodeForm.removeEventListener('submit', onNewCodeSubmit);
                        resendBtn.removeEventListener('click', onResend);
                        resendNewBtn.removeEventListener('click', onResendNew);
                    }

                    closeBtn.addEventListener('click', onClose);
                    overlay.addEventListener('click', onOverlayClick);
                    passwordForm.addEventListener('submit', onPasswordSubmit);
                    codeForm.addEventListener('submit', onCodeSubmit);
                    newCodeForm.addEventListener('submit', onNewCodeSubmit);
                    resendBtn.addEventListener('click', onResend);
                    resendNewBtn.addEventListener('click', onResendNew);

                    hideError(passwordError);
                    hideError(codeError);
                    hideError(newCodeError);
                    passwordInput.value = '';
                    otpOld.clear();
                    otpNew.clear();
                    resendBtn.textContent = 'resend code';
                    resendNewBtn.textContent = 'resend code';
                    passwordBtn.disabled = false;
                    passwordBtn.textContent = 'continue';
                    stepNewCode.style.display = 'none';

                    overlay.classList.add('active');
                    document.body.classList.add('modal-open');
                    if (mode === 'password') {
                        stepPassword.style.display = 'flex';
                        stepCode.style.display = 'none';
                        setTimeout(() => passwordInput.focus(), 100);
                    } else if (mode === 'new-only') {
                        stepPassword.style.display = 'none';
                        stepCode.style.display = 'none';
                        showNewCodeStep();
                    } else {
                        stepPassword.style.display = 'none';
                        showCodeStep();
                    }
                });
            }

            saveBtn.addEventListener('click', async () => {
                const tok = token;
                if (!tok) return;

                const usernameInput = document.getElementById('pref-username');
                const usernameRaw = usernameInput ? usernameInput.value.trim() : '';
                const usernameProvided = Boolean(usernameInput && usernameInput.dataset.isFallback !== 'true');

                if (usernameProvided && usernameRaw.length > 0) {
                    if (/\s/.test(usernameRaw)) {
                        notify('error: username cannot contain spaces', 'error');
                        return;
                    }
                    if (!/^[a-zA-Z0-9]+$/.test(usernameRaw)) {
                        notify('error: username cannot contain symbols', 'error');
                        return;
                    }
                    if (usernameRaw.length < 2 || usernameRaw.length > 16) {
                        notify('error: username must be between 2 and 16 characters', 'error');
                        return;
                    }
                }

                const firstNameRaw = document.getElementById('pref-first-name')?.value.trim() || '';
                const lastNameRaw = document.getElementById('pref-last-name')?.value.trim() || '';
                const NAME_RE = /^[a-zA-Z ]*$/;

                if (!NAME_RE.test(firstNameRaw)) {
                    notify('error: first name cannot contain symbols or numbers', 'error');
                    return;
                }
                if (firstNameRaw.length > 32) {
                    notify('error: first name must be at most 32 characters', 'error');
                    return;
                }
                if (!NAME_RE.test(lastNameRaw)) {
                    notify('error: last name cannot contain symbols or numbers', 'error');
                    return;
                }
                if (lastNameRaw.length > 32) {
                    notify('error: last name must be at most 32 characters', 'error');
                    return;
                }

                const emailInput = document.getElementById('pref-email');
                const emailRaw = emailInput ? emailInput.value.trim() : '';
                const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/;

                if (emailRaw.length === 0) {
                    notify('error: email cannot be empty', 'error');
                    return;
                }
                if (/[^a-zA-Z0-9._%+@-]/.test(emailRaw)) {
                    notify('error: email contains invalid characters', 'error');
                    return;
                }
                if (!EMAIL_RE.test(emailRaw)) {
                    notify('error: invalid email format', 'error');
                    return;
                }

                try {
                    const cachedRawForEmail = localStorage.getItem('sentinel-cached-profile');
                    const cachedForEmail = cachedRawForEmail ? JSON.parse(cachedRawForEmail) : {};
                    const currentEmail = cachedForEmail.email || '';
                    let emailChangeRequested = false;

                    if (emailRaw.toLowerCase() !== currentEmail.toLowerCase() && sentinelAuth) {
                        try {
                            const checkRes = await fetch('/v1/user/check-email', {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${tok}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ email: emailRaw })
                            });
                            const checkData = await checkRes.json();
                            if (!checkData.available) {
                                if (emailInput) emailInput.value = currentEmail;
                                notify('error: this email is already registered to another account', 'error');
                                return;
                            }
                        } catch {
                            notify('error: could not verify email availability', 'error');
                            return;
                        }

                        const authProvider = cachedForEmail.authProvider || 'email';
                        let verificationMode;
                        if (authProvider === 'email') {
                            verificationMode = 'password';
                        } else if (authProvider === 'google' || currentEmail) {
                            verificationMode = 'code';
                        } else {
                            verificationMode = 'new-only';
                        }

                        const verified = await verifyEmailChangeFlow(currentEmail, verificationMode, emailRaw);
                        if (!verified) return;
                    }

                    setSaveBtnBusy();

                    if (emailRaw.toLowerCase() !== currentEmail.toLowerCase() && sentinelAuth) {
                        const { error: emailErr } = await sentinelAuth.auth.updateUser({ email: emailRaw });
                        if (emailErr) {
                            resetSaveBtn();
                            const m = (emailErr.message || '').toLowerCase();
                            if (m.includes('already') || m.includes('registered') || m.includes('exists')) {
                                notify('error: this email is already in use', 'error');
                            } else if (m.includes('invalid') || m.includes('format')) {
                                notify('error: invalid email format', 'error');
                            } else {
                                notify('error: failed to update email', 'error');
                            }
                            return;
                        }
                        emailChangeRequested = true;
                    }

                    const payload = {
                        firstName: firstNameRaw,
                        lastName: lastNameRaw
                    };
                    if (usernameProvided) {
                        payload.username = usernameRaw;
                    }
                    const r = await fetch('/v1/user/profile', {
                        method: 'PATCH',
                        headers: { 'Authorization': `Bearer ${tok}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const data = await r.json();
                    if (r.ok) {
                        resetSaveBtn();
                        if (emailChangeRequested) {
                            notify('changes saved. check your new email inbox to confirm the address change', 'success');
                        } else {
                            notify('all changes saved successfully', 'success');
                        }

                        const cachedRaw = localStorage.getItem('sentinel-cached-profile');
                        const cached = cachedRaw ? JSON.parse(cachedRaw) : {};
                        const newUsername = data.username || '';
                        const fallbackEmail = cached.email || '';
                        const displayId = newUsername || fallbackEmail;
                        const identityChanged = (cached.username || '') !== newUsername;

                        const el = document.getElementById('current-user-email');
                        if (el && displayId) el.textContent = displayId;
                        const av = document.getElementById('team-owner-avatar');
                        if (av && displayId) av.textContent = displayId.charAt(0).toUpperCase();
                        const topAvatar = document.getElementById('org-avatar-circle');
                        if (topAvatar && displayId) topAvatar.textContent = displayId.charAt(0).toUpperCase();
                        const dropdownEmailEl = document.getElementById('dropdown-email');
                        if (dropdownEmailEl) dropdownEmailEl.textContent = newUsername ? `@${newUsername}` : fallbackEmail;

                        if (identityChanged) {
                            playPulse(av, 'identity-flash');
                            playPulse(topAvatar, 'identity-flash');
                            playPulse(el, 'identity-swap');
                            playPulse(dropdownEmailEl, 'identity-swap');
                        }

                        if (usernameInput) {
                            usernameInput.value = newUsername || fallbackEmail;
                            usernameInput.dataset.isFallback = newUsername ? 'false' : 'true';
                        }
                        setUsernamePrefixVisible(Boolean(newUsername));

                        try {
                            localStorage.setItem('sentinel-cached-profile', JSON.stringify({
                                ...cached,
                                username: newUsername,
                                firstName: data.firstName ?? cached.firstName ?? '',
                                lastName: data.lastName ?? cached.lastName ?? ''
                            }));
                        } catch {}
                    } else {
                        resetSaveBtn();
                        notify(`error: ${data.error || 'failed to save changes'}`, 'error');
                    }
                } catch {
                    resetSaveBtn();
                    notify('error: failed to save changes', 'error');
                }
            });
        }

        const orgsRes = await fetch('/v1/organizations', { headers: { 'Authorization': `Bearer ${token}` } });
        const orgs = await orgsRes.json();

        localStorage.setItem('sentinel-cached-orgs', JSON.stringify(orgs));
        updateOrgGrid(orgs);
        updateDropdownOrgList(orgs, currentOrgSlug);
        const _sq = new URLSearchParams(window.location.search).get('q') || '';
        if (_sq) filterOrgGrid(_sq);
    } catch (err) {}
}

function updateDropdownOrgList(orgs, activeSlug) {
    const orgList = document.querySelector('.org-list.org-only');
    if (!orgList) return;
    orgList.innerHTML = '';

    orgs.forEach(org => {
        const isActive = org.slug === activeSlug;
        const item = document.createElement('a');
        item.href = '#';
        item.className = `dropdown-item org-item${isActive ? ' active' : ''}`;

        const avatar = document.createElement('div');
        avatar.className = 'org-avatar small';
        avatar.textContent = org.name.charAt(0).toUpperCase();

        const nameSpan = document.createElement('span');
        nameSpan.className = 'org-name-text';
        nameSpan.textContent = org.name;

        item.append(avatar, nameSpan);

        if (isActive) {
            const checkSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            checkSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            checkSvg.setAttribute('width', '14');
            checkSvg.setAttribute('height', '14');
            checkSvg.setAttribute('viewBox', '0 0 24 24');
            checkSvg.setAttribute('fill', 'none');
            checkSvg.setAttribute('stroke', 'var(--neon-blue)');
            checkSvg.setAttribute('stroke-width', '2');
            checkSvg.setAttribute('stroke-linecap', 'round');
            checkSvg.setAttribute('stroke-linejoin', 'round');
            checkSvg.style.marginLeft = 'auto';
            const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
            poly.setAttribute('points', '20 6 9 17 4 12');
            checkSvg.appendChild(poly);
            item.appendChild(checkSvg);
        }

        item.onclick = (e) => {
            e.preventDefault();
            history.pushState({ slug: org.slug }, '', `/dashboard/org/${org.slug}`);
            switchToOrgView(org.slug, 'projects');
            const trigger = document.getElementById('user-menu-trigger');
            const menu = document.getElementById('user-dropdown');
            trigger?.classList.remove('active');
            menu?.classList.remove('active');
        };

        orgList.appendChild(item);
    });
}

function setupSidebar() {
    const toggle = document.getElementById('sidebar-toggle');
    const popup = document.getElementById('sidebar-popup');
    const helpBtn = document.getElementById('sidebar-help');
    const options = document.querySelectorAll('.state-option');

    if (!toggle || !popup) return;
    if (toggle.dataset.bound) return;
    toggle.dataset.bound = "true";

    toggle.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        popup.classList.toggle('active');
    };

    if (helpBtn) {
        helpBtn.onclick = (e) => {
            e.preventDefault();
            window.open('https://help.sentinelpay.org', '_blank');
        };
    }

    options.forEach(opt => {
        opt.onclick = (e) => {
            e.preventDefault();
            const state = opt.dataset.state;
            
            document.body.classList.remove('sidebar-expanded', 'sidebar-collapsed', 'sidebar-hover');
            if (state === 'expanded') document.body.classList.add('sidebar-expanded');
            else if (state === 'collapsed') document.body.classList.add('sidebar-collapsed');
            else document.body.classList.add('sidebar-hover');

            options.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            
            popup.classList.remove('active');
            localStorage.setItem('sentinel-sidebar-state', state);
        };
    });

    const savedState = localStorage.getItem('sentinel-sidebar-state') || 'hover';
    document.body.classList.remove('sidebar-expanded', 'sidebar-collapsed', 'sidebar-hover');
    if (savedState === 'expanded') document.body.classList.add('sidebar-expanded');
    else if (savedState === 'collapsed') document.body.classList.add('sidebar-collapsed');
    else document.body.classList.add('sidebar-hover');

    options.forEach(o => {
        if (o.dataset.state === savedState) o.classList.add('active');
        else o.classList.remove('active');
    });

    document.addEventListener('click', () => popup.classList.remove('active'));

    const bindOrgNav = (id, subPath, viewName) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.onclick = (e) => {
            e.preventDefault();
            const path = window.location.pathname;
            const orgMatch = path.match(/\/dashboard\/org\/([a-z0-9]{20})/);
            if (orgMatch) {
                const slug = orgMatch[1];
                const newPath = subPath === '' ? `/dashboard/org/${slug}` : `/dashboard/org/${slug}/${subPath}`;
                history.pushState({ slug }, '', newPath);
                switchToOrgView(slug, viewName);
            }
        };
    };

    bindOrgNav('sidebar-item-projects', '', 'projects');
    bindOrgNav('sidebar-item-team', 'team', 'team');
    ['integrations', 'usage', 'billing', 'settings'].forEach(sub => {
        bindOrgNav(`sidebar-item-${sub}`, sub, sub);
    });
}
