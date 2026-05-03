const supabaseUrl = 'https://aivqwkgjdpklxxuvkxpy.supabase.co';
const supabaseKey = 'sb_publishable_bRfAssaGT6D8oFDQtPARbw_5fyYGWM6';
const sentinelAuth = window.supabase.createClient(supabaseUrl, supabaseKey);

// 0. ULTIMATE HASH SCRUBBER (Aggressively kills # trailing fragments)
const scrubHash = () => {
    if (window.location.href.indexOf('#') > -1) {
        window.history.replaceState(null, document.title, window.location.href.split('#')[0]);
    }
};

// The scrubber function is defined above; execution moved inside DOMContentLoaded after session validation.

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[sentinel-dashboard] v-final loader active');
    
    // 1. Check auth state
    // We MUST let Supabase read the hash before we delete it!
    const { data: { session }, error } = await sentinelAuth.auth.getSession();
    
    if (error || !session) {
        // If there's an error or no session, we might be in the middle of a redirect
        // but if we are on /dashboard without a session, we MUST go to /auth
        console.warn('[sentinel-dashboard] no session found, redirecting to auth');
        window.location.href = '/auth';
        return;
    }

    // 2. NOW it is safe to scrub the URL
    setTimeout(scrubHash, 500);
    // Aggressive interval removed to prevent race conditions with Supabase token processing.

    const token = session.access_token;
    
    // 3. Setup Logout
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await sentinelAuth.auth.signOut();
            window.location.href = '/';
        });
    }

    // CSP Fix: Setup Reveal Key Button
    const revealBtn = document.getElementById('btn-reveal-key');
    if (revealBtn) {
        revealBtn.addEventListener('click', async () => {
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
                    if (window.SentinelToast) window.SentinelToast.show('API Key revealed! Save it securely, it will NOT be shown again.', 'success');
                    else alert('API Key revealed! Save it securely, it will NOT be shown again.');
                } else {
                    if (window.SentinelToast) window.SentinelToast.show(result.error || 'Failed to reveal key', 'error');
                    else alert(result.error || 'Failed to reveal key');
                    revealBtn.textContent = 'reveal';
                    revealBtn.disabled = false;
                }
            } catch (err) {
                console.error(err);
                if (window.SentinelToast) window.SentinelToast.show('Network error revealing key', 'error');
                else alert('Network error revealing key');
                revealBtn.textContent = 'reveal';
                revealBtn.disabled = false;
            }
        });
    }

    const buyBtn = document.getElementById('btn-buy-credits');
    if (buyBtn) {
        buyBtn.addEventListener('click', () => {
            if (window.SentinelToast) window.SentinelToast.show('Stripe connection offline. Phase 3 rollout pending.', 'info');
        });
    }

    // 4. Fetch Dashboard Data
    try {
        const response = await fetch('/v1/user/profile', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load profile data');
        }

        const data = await response.json();
        
        // 5. Render Data
        document.getElementById('user-email').textContent = data.email;
        document.getElementById('credit-count').textContent = data.credits;

        const historyContainer = document.getElementById('history-container');
        
        if (data.history.length === 0) {
            historyContainer.replaceChildren();
            const emptyMsg = document.createElement('p');
            emptyMsg.style.cssText = 'color: var(--text-secondary); text-align: center; padding: 2rem;';
            emptyMsg.textContent = 'no scans yet. go back to the scanner to check a wallet.';
            historyContainer.appendChild(emptyMsg);
        } else {
            historyContainer.replaceChildren();
            
            data.history.forEach(item => {
                const el = document.createElement('div');
                el.className = `history-item ${item.category}`; // high, medium, low
                
                const dateRaw = new Date(item.timestamp);
                const dateStr = dateRaw.toLocaleDateString() + ' ' + dateRaw.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                // Secure DOM construction
                const infoDiv = document.createElement('div');
                infoDiv.style.cssText = 'display:flex; flex-direction: column; gap: 0.25rem;';
                
                const walletLabel = document.createElement('strong');
                walletLabel.style.color = 'var(--text)';
                walletLabel.textContent = item.wallet;
                
                const timeLabel = document.createElement('span');
                timeLabel.style.cssText = 'color: var(--text-secondary); font-size: 0.75rem;';
                timeLabel.textContent = dateStr;
                
                infoDiv.appendChild(walletLabel);
                infoDiv.appendChild(timeLabel);

                const scoreDiv = document.createElement('div');
                scoreDiv.style.cssText = 'display: flex; gap: 1rem; align-items: center;';
                const scoreBadge = document.createElement('span');
                scoreBadge.style.cssText = 'background: rgba(255,255,255,0.1); padding: 0.2rem 0.6rem; border-radius: 4px;';
                scoreBadge.textContent = `Score: ${item.score}`;
                scoreDiv.appendChild(scoreBadge);

                el.appendChild(infoDiv);
                el.appendChild(scoreDiv);
                historyContainer.appendChild(el);
            });
        }
    } catch (err) {
        console.error(err);
        document.getElementById('user-email').textContent = 'error loading profile.';
    }
});
