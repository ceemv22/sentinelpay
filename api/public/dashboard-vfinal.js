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
    console.log('[sentinel-dashboard] v-final loader active (v17.3)');
    
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
        
        // 3. Setup Logout
        const logoutBtn = document.getElementById('btn-logout');
        if (logoutBtn) {
            logoutBtn.onclick = async (e) => {
                e.preventDefault();
                await sentinelAuth.auth.signOut();
                window.location.href = '/';
            };
        }

        // 4. Setup Dropdown Toggle
        const menuTrigger = document.getElementById('user-menu-trigger');
        const dropdownMenu = document.getElementById('user-dropdown');
        if (menuTrigger && dropdownMenu) {
            menuTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdownMenu.classList.toggle('active');
            });

            document.addEventListener('click', (e) => {
                if (!menuTrigger.contains(e.target) && !dropdownMenu.contains(e.target)) {
                    dropdownMenu.classList.remove('active');
                }
            });
        }

        // Setup UI
        setupRevealKey(token);
        setupCopyKey();
        setupBuyCredits();
        fetchProfile(token);
    }

    function setupRevealKey(token) {
        const revealBtn = document.getElementById('btn-reveal-key');
        if (revealBtn) {
            revealBtn.onclick = async () => {
                try {
                    revealBtn.disabled = true;
                    const originalIcon = revealBtn.innerHTML;
                    revealBtn.innerHTML = '...';

                    const res = await fetch('/v1/user/api-key/reveal', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const result = await res.json();
                    
                    if (res.ok && result.apiKey) {
                        document.getElementById('api-key-display').textContent = result.apiKey;
                        document.getElementById('api-key-display').style.color = 'var(--neon-blue)';
                        revealBtn.style.display = 'none';
                        if (window.SentinelToast) window.SentinelToast.show('API Key revealed! Save it securely.', 'success');
                    } else {
                        if (window.SentinelToast) window.SentinelToast.show(result.error || 'Failed to reveal key', 'error');
                        revealBtn.disabled = false;
                        revealBtn.innerHTML = originalIcon;
                    }
                } catch (err) {
                    console.error(err);
                    revealBtn.disabled = false;
                }
            };
        }
    }

    function setupCopyKey() {
        const copyBtn = document.getElementById('btn-copy-key');
        if (copyBtn) {
            copyBtn.onclick = () => {
                const keyText = document.getElementById('api-key-display').textContent;
                if (keyText.includes('•')) {
                    if (window.SentinelToast) window.SentinelToast.show('Please reveal the key before copying.', 'warning');
                    return;
                }
                navigator.clipboard.writeText(keyText).then(() => {
                    if (window.SentinelToast) window.SentinelToast.show('API Key copied to clipboard!', 'success');
                });
            };
        }
    }

    function setupBuyCredits() {
        const buyBtn = document.getElementById('btn-buy-credits');
        if (buyBtn) {
            buyBtn.onclick = () => {
                if (window.SentinelToast) window.SentinelToast.show('Stripe connection offline. Phase 3 pending.', 'info');
            };
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
            document.getElementById('credit-count').textContent = data.credits;

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
