const supabaseUrl = 'https://aivqwkgjdpklxxuvkxpy.supabase.co';
const supabaseKey = 'sb_publishable_bRfAssaGT6D8oFDQtPARbw_5fyYGWM6';
const sentinelAuth = window.supabase.createClient(supabaseUrl, supabaseKey, {
    auth: {
        flowType: 'pkce',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});

// 0. Pre-Flight State Capture
const initialUrl = window.location.href;
const initialSearch = window.location.search;
const initialHash = window.location.hash;
let isInitialized = false;
let authStartTime = Date.now();

// 1. Setup Auth Listener (Top-Level to catch early events)
sentinelAuth.auth.onAuthStateChange(async (event, session) => {
    console.log('[sentinel-dashboard] auth event:', event, !!session);
    
    if (session) {
        if (!isInitialized) {
            isInitialized = true;
            console.log('[sentinel-dashboard] session stabilized, rendering...');
            setTimeout(scrubHash, 10000); 
            renderDashboard(session);
        }
        return;
    }

    // Only redirect if we are 100% sure there is no session
    // Ignore SIGNED_OUT events in the first 20 seconds (Extreme hydration window)
    if (event === 'SIGNED_OUT' && (Date.now() - authStartTime > 20000)) {
        console.warn('[sentinel-dashboard] truly signed out, redirecting');
        window.location.href = '/auth';
    }
});

// 0. ULTIMATE HASH SCRUBBER (Aggressively kills # trailing fragments)
const scrubHash = () => {
    if (window.location.href.indexOf('#') > -1) {
        window.history.replaceState(null, document.title, window.location.href.split('#')[0]);
    }
    // Also scrub ?code if it exists after a delay
    if (window.location.search.includes('code=')) {
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState(null, document.title, newUrl);
    }
};

const checkSession = async () => {
    try {
        const { data: { session } } = await sentinelAuth.auth.getSession();
        if (session) {
            if (!isInitialized) {
                isInitialized = true;
                renderDashboard(session);
                setTimeout(scrubHash, 10000);
            }
            return true;
        }
        return false;
    } catch (err) {
        return false;
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[sentinel-dashboard] v-final loader active (v18.1)');
    
    // S-Tier Pre-Hydration: Show cached API suffix instantly
    const cachedSuffix = localStorage.getItem('sentinel_key_suffix');
    if (cachedSuffix) {
        const suffixEl = document.getElementById('api-key-suffix');
        if (suffixEl) suffixEl.textContent = cachedSuffix;
    }
    
    // Main Hydration Logic
    (async () => {
        const hasSession = await checkSession();
        if (hasSession) {
            console.log('[sentinel-dashboard] session found on first check');
            return;
        }

        const isAuthRedirect = 
            initialSearch.includes('code=') || 
            initialHash.includes('access_token=') ||
            initialHash.includes('code=') ||
            initialSearch.includes('error=');

        if (isAuthRedirect) {
            console.log('[sentinel-dashboard] auth redirect detected (initial URL), holding for 30s...');
            // Extremely patient retry loop for new accounts
            for (let i = 0; i < 60; i++) {
                await new Promise(r => setTimeout(r, 500));
                if (isInitialized) return;
                if (await checkSession()) return;
            }
            console.warn('[sentinel-dashboard] hydration loop timed out after 30s');
            window.location.href = '/auth';
        } else {
            console.log('[sentinel-dashboard] normal load, no redirect params detected');
            // No session and not a redirect -> wait 10s before bouncing
            setTimeout(async () => {
                if (!isInitialized && !(await checkSession())) {
                    console.warn('[sentinel-dashboard] no session after 10s, redirecting to /auth');
                    window.location.href = '/auth';
                }
            }, 10000);
        }
    })();

    // 3. Logout Logic
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.onclick = async (e) => {
            e.preventDefault();
            console.log('[sentinel-dashboard] manual logout triggered');
            await sentinelAuth.auth.signOut();
            window.location.href = '/auth';
        };
    }

    // --- Setup Sidebar State Toggle (S-Tier UX) ---
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebarPopup = document.getElementById('sidebar-popup');
    
    if (sidebarToggle && sidebarPopup) {
        sidebarToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            sidebarPopup.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (!sidebarToggle.contains(e.target) && !sidebarPopup.contains(e.target)) {
                sidebarPopup.classList.remove('active');
            }
        });

        const stateOptions = sidebarPopup.querySelectorAll('.state-option');
        stateOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                
                stateOptions.forEach(opt => opt.classList.remove('active'));
                option.classList.add('active');
                
                const state = option.getAttribute('data-state');
                
                document.body.classList.remove('sidebar-expanded', 'sidebar-collapsed');
                
                if (state === 'expanded') {
                    document.body.classList.add('sidebar-expanded');
                } else if (state === 'collapsed') {
                    document.body.classList.add('sidebar-collapsed');
                }
                
                setTimeout(() => {
                    sidebarPopup.classList.remove('active');
                }, 150); // slight delay for S-Tier UX
            });
        });
    }

    async function renderDashboard(session) {
        const token = session.access_token;
        const user = session.user;
        
        // --- 1. Immediate Avatar Update (No Delay) ---
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
        
        if (avatarInitial === '?' && displayIdentifier) {
            avatarInitial = displayIdentifier.charAt(0);
        } else if (avatarInitial === '?') {
            displayIdentifier = 'OAuth Account';
            avatarInitial = 'O';
        }

        const avatarEl = document.getElementById('org-avatar-circle');
        if (avatarEl) avatarEl.textContent = avatarInitial.toUpperCase();
        
        const dropdownEmailEl = document.getElementById('dropdown-email');
        if (dropdownEmailEl) dropdownEmailEl.textContent = displayIdentifier;

        // --- Mock Org Initialization (Until Backend is Ready) ---
        const orgNameEl = document.getElementById('current-org-name');
        if (orgNameEl) orgNameEl.textContent = `${displayIdentifier.split('@')[0]}'s Org`;
        const orgDropdownName = document.querySelector('.org-name-text');
        if (orgDropdownName) orgDropdownName.textContent = `${displayIdentifier.split('@')[0]}'s Org`;

        // --- 2. Setup Logout ---
        const logoutBtn = document.getElementById('btn-logout');
        if (logoutBtn) {
            logoutBtn.onclick = async (e) => {
                e.preventDefault();
                await sentinelAuth.auth.signOut();
                window.location.href = '/';
            };
        }

        // --- 3. Setup Dropdown Toggle ---
        const menuTrigger = document.getElementById('user-menu-trigger');
        const dropdownMenu = document.getElementById('user-dropdown');
        
        if (menuTrigger && dropdownMenu) {
            // Remove any old listeners if renderDashboard is called twice
            const newTrigger = menuTrigger.cloneNode(true);
            menuTrigger.parentNode.replaceChild(newTrigger, menuTrigger);
            
            newTrigger.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropdownMenu.classList.toggle('active');
            });

            document.addEventListener('click', (e) => {
                if (!newTrigger.contains(e.target) && !dropdownMenu.contains(e.target)) {
                    dropdownMenu.classList.remove('active');
                }
            });
        }

        // --- 4. Setup API Key Modal ---
        const badgeEl = document.getElementById('header-api-key');
        const modal = document.getElementById('api-modal-overlay');
        const closeBtn = document.getElementById('btn-close-api-modal');
        const modalDisplay = document.getElementById('modal-api-key-display');
        const revealBtn = document.getElementById('modal-btn-reveal');
        const copyBtn = document.getElementById('modal-btn-copy');

        // We will store the full key here once fetched
        let cachedFullKey = null;
        let isRevealed = false;

        if (badgeEl && modal) {
            // Remove old listeners by cloning
            const newBadge = badgeEl.cloneNode(true);
            badgeEl.parentNode.replaceChild(newBadge, badgeEl);

            newBadge.addEventListener('click', async (e) => {
                e.preventDefault();
                document.body.classList.add('modal-open');
                modal.style.display = 'flex';
                setTimeout(() => {
                    modal.classList.add('active');
                }, 10);
                
                // Show masked key immediately in modal
                if (cachedFullKey) {
                    const prefix = 'sp_live_';
                    const suffix = cachedFullKey.slice(-4);
                    const dotsCount = cachedFullKey.length - prefix.length - 4;
                    const dots = '•'.repeat(dotsCount > 0 ? dotsCount : 24);
                    modalDisplay.textContent = `${prefix}${dots}${suffix}`;
                } else {
                    // Fetch if not cached
                    await fetchHeaderApiKey(token, (fullKey) => {
                        cachedFullKey = fullKey;
                        const prefix = 'sp_live_';
                        const suffix = fullKey.slice(-4);
                        const dotsCount = fullKey.length - prefix.length - 4;
                        const dots = '•'.repeat(dotsCount > 0 ? dotsCount : 24);
                        modalDisplay.textContent = `${prefix}${dots}${suffix}`;
                    });
                }
            });

            closeBtn.onclick = () => {
                document.body.classList.remove('modal-open');
                modal.classList.remove('active');
                setTimeout(() => {
                    modal.style.display = 'none';
                }, 300);
            };

            modal.onclick = (e) => {
                if (e.target === modal) {
                    closeBtn.click();
                }
            };

            const rollBtn = document.getElementById('modal-btn-roll');
            const rollConfirmModal = document.getElementById('roll-confirm-modal');
            const cancelRollBtn = document.getElementById('btn-cancel-roll');
            const confirmRollActionBtn = document.getElementById('btn-confirm-roll-action');
            const closeRollModalBtn = document.getElementById('btn-close-roll-modal');

            if (rollBtn && rollConfirmModal) {
                rollBtn.onclick = () => {
                    rollConfirmModal.style.display = 'flex';
                    setTimeout(() => rollConfirmModal.classList.add('active'), 10);
                };

                const closeRoll = () => {
                    document.body.classList.remove('modal-open');
                    rollConfirmModal.classList.remove('active');
                    setTimeout(() => rollConfirmModal.style.display = 'none', 300);
                };

                cancelRollBtn.onclick = closeRoll;
                if (closeRollModalBtn) closeRollModalBtn.onclick = closeRoll;
                
                rollConfirmModal.onclick = (e) => {
                    if (e.target === rollConfirmModal) closeRoll();
                };

                confirmRollActionBtn.onclick = async () => {
                    try {
                        confirmRollActionBtn.disabled = true;
                        confirmRollActionBtn.textContent = 'rolling...';
                        
                        const res = await fetch('/v1/user/api-key/roll', {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        const result = await res.json();
                        
                        if (res.ok && result.apiKey) {
                            cachedFullKey = result.apiKey;
                            const prefix = 'sp_live_';
                            const suffix = cachedFullKey.slice(-4);
                            const dotsCount = cachedFullKey.length - prefix.length - 4;
                            const dots = '•'.repeat(dotsCount > 0 ? dotsCount : 24);
                            modalDisplay.textContent = `${prefix}${dots}${suffix}`;
                            
                            // Update header suffix and cache
                            const last4 = suffix;
                            const suffixEl = document.getElementById('api-key-suffix');
                            if (suffixEl) suffixEl.textContent = last4;
                            localStorage.setItem('sentinel_key_suffix', last4);

                            if (window.SentinelToast) window.SentinelToast.show('API key rolled successfully!', 'success');
                            
                            // Close confirm modal
                            cancelRollBtn.click();
                        } else {
                            throw new Error(result.error || 'Failed to roll key');
                        }
                    } catch (err) {
                        console.error(err);
                        if (window.SentinelToast) window.SentinelToast.show('Error rolling key.', 'error');
                    } finally {
                        confirmRollActionBtn.disabled = false;
                        confirmRollActionBtn.textContent = 'confirm roll';
                    }
                };
            }

            copyBtn.onclick = () => {
                if (!cachedFullKey) return;
                
                const originalHTML = copyBtn.innerHTML;
                navigator.clipboard.writeText(cachedFullKey).then(() => {
                    // S-Tier Feedback: Swap icon to green checkmark
                    copyBtn.classList.add('copied');
                    copyBtn.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    `;
                    
                    setTimeout(() => {
                        copyBtn.classList.remove('copied');
                        copyBtn.innerHTML = originalHTML;
                    }, 3000);
                });
            };
        }

        // Setup UI (Prioritize API Key for S-Tier instant load)
        fetchHeaderApiKey(token, (fullKey) => {
            cachedFullKey = fullKey;
        });
        fetchProfile(token);
    }

    async function fetchHeaderApiKey(token, onKeyFetched) {
        const suffixEl = document.getElementById('api-key-suffix');
        
        // 1. Instant Load from Cache
        const cachedSuffix = localStorage.getItem('sentinel_key_suffix');
        if (cachedSuffix && suffixEl) {
            suffixEl.textContent = cachedSuffix;
        }

        try {
            const res = await fetch('/v1/user/api-key/reveal', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            
            if (res.ok && result.apiKey) {
                const fullKey = result.apiKey;
                const last4 = fullKey.slice(-4);
                
                // 2. Update UI and Cache
                if (suffixEl) suffixEl.textContent = last4;
                localStorage.setItem('sentinel_key_suffix', last4);
                
                if (onKeyFetched) onKeyFetched(fullKey);
            }
        } catch (err) {
            console.error('Failed to fetch header API key:', err);
        }
    }

    async function fetchProfile(token) {
        try {
            const response = await fetch('/v1/user/profile', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to load profile');

            const data = await response.json();
            
            let displayIdentifier = data.email;
            let avatarInitial = '?';
            
            if (data.authProvider === 'twitter' && data.username) {
                displayIdentifier = `@${data.username}`;
                avatarInitial = data.username.charAt(0);
            } else if (!data.email && data.username) {
                displayIdentifier = data.username;
                avatarInitial = data.username.charAt(0);
            } else if (data.email) {
                avatarInitial = data.email.charAt(0);
            } else {
                displayIdentifier = data.authProvider === 'twitter' ? 'Linked via X' : 'OAuth Account';
                avatarInitial = 'O';
            }

            // Update avatar and dropdown header
            const avatarEl = document.getElementById('org-avatar-circle');
            if (avatarEl) avatarEl.textContent = avatarInitial.toUpperCase();
            
            const dropdownEmailEl = document.getElementById('dropdown-email');
            if (dropdownEmailEl) dropdownEmailEl.textContent = displayIdentifier;

            const orgNameEl = document.getElementById('current-org-name');
            if (orgNameEl) orgNameEl.textContent = `${displayIdentifier.split('@')[0]}'s Org`;
            const orgDropdownName = document.querySelector('.org-name-text');
            if (orgDropdownName) orgDropdownName.textContent = `${displayIdentifier.split('@')[0]}'s Org`;

            // --- Org Home View Logic ---
            // 1. Fetch real organizations from backend
            try {
                const orgsRes = await fetch('/v1/organizations', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const orgs = await orgsRes.json();
                
                const orgCardsGrid = document.querySelector('.org-cards-grid');
                if (orgCardsGrid) {
                    orgCardsGrid.innerHTML = '';
                    
                    if (orgs.length === 0) {
                        // Empty state: User must create their first org
                        orgCardsGrid.innerHTML = `
                            <div style="grid-column: 1/-1; text-align: center; padding: 4rem 2rem; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); border-radius: 16px;">
                                <p style="color: var(--text-muted); margin-bottom: 1.5rem;">you don't have any organizations yet.</p>
                                <button class="submit-btn" style="width: auto; padding: 0.6rem 1.5rem;" onclick="document.getElementById('mock-new-org-btn').click()">create your first organization</button>
                            </div>
                        `;
                    } else {
                        orgs.forEach(org => {
                            const card = document.createElement('div');
                            card.className = 'org-card-item';
                            card.innerHTML = `
                                <div class="org-card-avatar">${org.name.charAt(0).toUpperCase()}</div>
                                <div class="org-card-info">
                                    <span class="org-card-name">${org.name}</span>
                                    <span class="org-card-meta">${org.role || 'Member'} • ${org.id.slice(0,8)}</span>
                                </div>
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: auto; opacity: 0.3;"><path d="m9 18 6-6-6-6"></path></svg>
                            `;
                            card.onclick = () => enterDashboard(org);
                            orgCardsGrid.appendChild(card);
                        });
                    }
                }
            } catch (err) {
                console.error('[sentinel-dashboard] failed to fetch organizations:', err);
            }

            document.body.classList.add('state-org-home');

            // 2. Setup New Org Button
            const newOrgBtn = document.getElementById('mock-new-org-btn');
            if (newOrgBtn) {
                newOrgBtn.onclick = async () => {
                    const orgName = prompt('enter organization name:');
                    if (!orgName) return;
                    
                    try {
                        const res = await fetch('/v1/organizations', {
                            method: 'POST',
                            headers: { 
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ name: orgName })
                        });
                        
                        if (res.ok) {
                            location.reload(); // Refresh to show new org
                        } else {
                            const err = await res.json();
                            alert('failed to create organization: ' + err.error);
                        }
                    } catch (err) {
                        console.error('Org creation error:', err);
                    }
                };
            }

            function enterDashboard(org) {
                console.log('[sentinel-dashboard] entering dashboard for org:', org?.name);
                document.body.classList.remove('state-org-home');
                const orgHomeView = document.getElementById('org-home-view');
                const dashboardView = document.getElementById('dashboard-view');
                if (orgHomeView) orgHomeView.classList.add('hidden');
                if (dashboardView) dashboardView.classList.remove('hidden');
                
                if (org) {
                    const orgNameEl = document.getElementById('current-org-name');
                    if (orgNameEl) orgNameEl.textContent = org.name;
                }

                // Ensure 'overview' is active in sidebar
                document.querySelectorAll('.sidebar-item').forEach(item => {
                    item.classList.remove('active');
                    const label = item.querySelector('.item-label');
                    if (label && label.textContent.toLowerCase().includes('overview')) {
                        item.classList.add('active');
                    }
                });
            }

            // 3. Search Filtering (S-Tier Feel)
            const searchInput = document.querySelector('.org-search-input');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    const term = e.target.value.toLowerCase();
                    document.querySelectorAll('.org-card-item').forEach(card => {
                        const name = card.querySelector('.org-card-name').textContent.toLowerCase();
                        card.style.display = name.includes(term) ? 'flex' : 'none';
                    });
                });
            }

            const userEmailEl = document.getElementById('user-email');
            if (userEmailEl) userEmailEl.textContent = displayIdentifier;
            const creditCountEl = document.getElementById('credit-count');
            if (creditCountEl) creditCountEl.textContent = data.credits;

            const historyContainer = document.getElementById('history-container');
            if (historyContainer) {
                historyContainer.replaceChildren();

                if (data.history.length === 0) {
                    const emptyMsg = document.createElement('p');
                    emptyMsg.style.cssText = 'color: var(--text-secondary); text-align: center; padding: 2rem;';
                    emptyMsg.textContent = 'No scans yet.';
                    historyContainer.appendChild(emptyMsg);
                } else {
                    data.history.forEach(item => {
                        const el = document.createElement('div');
                        el.className = `history-item`;
                        
                        const dateRaw = new Date(item.timestamp);
                        const dateStr = dateRaw.toLocaleDateString() + ' ' + dateRaw.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                        
                        el.innerHTML = `
                            <div class="history-meta">
                                <strong class="history-wallet">${item.wallet.slice(0, 10)}...${item.wallet.slice(-8)}</strong>
                                <span class="history-time">${dateStr}</span>
                            </div>
                            <div class="history-score">
                                <span class="score-badge ${item.category}">${item.score}</span>
                            </div>
                        `;
                        historyContainer.appendChild(el);
                    });
                }
            }
        } catch (err) {
            console.error(err);
            const userEmailEl = document.getElementById('user-email');
            if (userEmailEl) userEmailEl.textContent = 'Error loading profile.';
        }
    }
});
