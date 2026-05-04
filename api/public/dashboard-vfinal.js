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
            logoutBtn.onclick = async () => {
                await sentinelAuth.auth.signOut();
                window.location.href = '/';
            };
        }

        // Setup UI
        setupRevealKey(token);
        setupBuyCredits();
        fetchProfile(token);
    }

    function setupRevealKey(token) {
        const revealBtn = document.getElementById('btn-reveal-key');
        if (revealBtn) {
            revealBtn.onclick = async () => {
                try {
                    revealBtn.textContent = 'revealing...';
                    revealBtn.disabled = true;

                    const res = await fetch('/v1/user/api-key/reveal', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const result = await res.json();
                    
                    if (res.ok && result.apiKey) {
                        document.getElementById('api-key-display').textContent = result.apiKey;
                        revealBtn.style.display = 'none';
                        if (window.SentinelToast) window.SentinelToast.show('API Key revealed! Save it securely.', 'success');
                    } else {
                        if (window.SentinelToast) window.SentinelToast.show(result.error || 'Failed to reveal key', 'error');
                        revealBtn.textContent = 'reveal';
                        revealBtn.disabled = false;
                    }
                } catch (err) {
                    console.error(err);
                    revealBtn.textContent = 'reveal';
                    revealBtn.disabled = false;
                }
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
            if (data.authProvider === 'twitter' && data.username) {
                displayIdentifier = `@${data.username}`;
            } else if (!data.email && data.username) {
                displayIdentifier = data.username;
            } else if (!data.email) {
                displayIdentifier = data.authProvider === 'twitter' ? 'linked_via_x' : 'oauth_account';
            }

            document.getElementById('user-email').textContent = displayIdentifier;
            document.getElementById('credit-count').textContent = data.credits;

            const historyContainer = document.getElementById('history-container');
            if (historyContainer) {
                historyContainer.replaceChildren();

                if (data.history.length === 0) {
                    const emptyMsg = document.createElement('p');
                    emptyMsg.style.cssText = 'color: var(--text-secondary); text-align: center; padding: 2rem;';
                    emptyMsg.textContent = 'no scans yet.';
                    historyContainer.appendChild(emptyMsg);
                } else {
                    data.history.forEach(item => {
                        const el = document.createElement('div');
                        el.className = `history-item ${item.category}`;
                        
                        const dateRaw = new Date(item.timestamp);
                        const dateStr = dateRaw.toLocaleDateString() + ' ' + dateRaw.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                        
                        el.innerHTML = `
                            <div style="display:flex; flex-direction: column; gap: 0.25rem;">
                                <strong style="color: var(--text)">${item.wallet}</strong>
                                <span style="color: var(--text-secondary); font-size: 0.75rem;">${dateStr}</span>
                            </div>
                            <div style="display: flex; gap: 1rem; align-items: center;">
                                <span style="background: rgba(255,255,255,0.1); padding: 0.2rem 0.6rem; border-radius: 4px;">Score: ${item.score}</span>
                            </div>
                        `;
                        historyContainer.appendChild(el);
                    });
                }
            }
        } catch (err) {
            console.error(err);
            const userEmailEl = document.getElementById('user-email');
            if (userEmailEl) userEmailEl.textContent = 'error loading profile.';
        }
    }
});
