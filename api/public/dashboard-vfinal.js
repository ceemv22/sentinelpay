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

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[sentinel-dashboard] v-final loader active (v17.4)');
    
    // S-Tier Pre-Hydration: Show cached API suffix instantly
    const cachedSuffix = localStorage.getItem('sentinel_key_suffix');
    if (cachedSuffix) {
        const suffixEl = document.getElementById('api-key-suffix');
        if (suffixEl) suffixEl.textContent = cachedSuffix;
    }
    
    let isInitialized = false;

    // 1. Setup Auth Listener (S-Tier Patient Flow)
    sentinelAuth.auth.onAuthStateChange(async (event, session) => {
        console.log('[sentinel-dashboard] auth event:', event, !!session);
        
        if (session) {
            if (!isInitialized) {
                isInitialized = true;
                setTimeout(scrubHash, 2000); // Wait longer before scrubbing to ensure session stability
                renderDashboard(session);
            }
            return;
        }

        // Only redirect if we are 100% sure there is no session AND no incoming code
        if (event === 'SIGNED_OUT') {
            const hasAuthParams = 
                window.location.search.includes('code=') || 
                window.location.hash.includes('access_token=') || 
                window.location.hash.includes('code=');

            if (!hasAuthParams) {
                console.warn('[sentinel-dashboard] truly signed out, redirecting');
                window.location.href = '/auth';
            } else {
                console.log('[sentinel-dashboard] SIGNED_OUT event ignored due to active OAuth redirect params');
            }
        }
    });

    // 2. Immediate Session Check with PKCE Awareness
    try {
        const { data: { session: initialSession } } = await sentinelAuth.auth.getSession();
        if (initialSession) {
            isInitialized = true;
            renderDashboard(initialSession);
            setTimeout(scrubHash, 2000);
        } else {
            // Wait up to 5 seconds for PKCE exchange if we see a code in URL
            const isAuthRedirect = window.location.search.includes('code=') || window.location.hash.includes('access_token=');
            
            if (isAuthRedirect) {
                console.log('[sentinel-dashboard] redirect detected, holding for hydration (10s timeout)...');
                setTimeout(async () => {
                    const { data: { session: retrySession } } = await sentinelAuth.auth.getSession();
                    if (retrySession) {
                        if (!isInitialized) {
                            isInitialized = true;
                            renderDashboard(retrySession);
                            setTimeout(scrubHash, 2000);
                        }
                    } else {
                        console.warn('[sentinel-dashboard] PKCE exchange timed out after 10s');
                        window.location.href = '/auth';
                    }
                }, 10000);
            } else {
                // No session and not a redirect -> give it 1.5s then bounce
                setTimeout(async () => {
                    const { data: { session: finalCheck } } = await sentinelAuth.auth.getSession();
                    if (!finalCheck && !isInitialized) {
                        console.warn('[sentinel-dashboard] no session detected, bouncing to auth');
                        window.location.href = '/auth';
                    }
                }, 1500);
            }
        }
    } catch (err) {
        console.error('[sentinel-dashboard] session check failed', err);
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

        const avatarEl = document.getElementById('user-avatar-circle');
        if (avatarEl) avatarEl.textContent = avatarInitial.toUpperCase();
        
        const dropdownEmailEl = document.getElementById('dropdown-email');
        if (dropdownEmailEl) dropdownEmailEl.textContent = displayIdentifier;

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
            const avatarEl = document.getElementById('user-avatar-circle');
            if (avatarEl) avatarEl.textContent = avatarInitial.toUpperCase();
            
            const dropdownEmailEl = document.getElementById('dropdown-email');
            if (dropdownEmailEl) dropdownEmailEl.textContent = displayIdentifier;

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
