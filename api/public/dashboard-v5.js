const supabaseUrl = 'https://aivqwkgjdpklxxuvkxpy.supabase.co';
const supabaseKey = 'sb_publishable_bRfAssaGT6D8oFDQtPARbw_5fyYGWM6';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[sentinel-dashboard] v5 loader active');
    // 1. Check auth state
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
        window.location.href = '/auth';
        return;
    }

    // ABSOLUTE BRUTE FORCE: Repeatedly scrub the URL over 2 seconds
    let scrubCount = 0;
    const scrubber = setInterval(() => {
        if (window.location.href.includes('#access_token')) {
            window.history.replaceState(null, '', window.location.pathname);
        }
        if (++scrubCount > 20) clearInterval(scrubber);
    }, 100);

    const token = session.access_token;
    
    // 2. Setup Logout
    document.getElementById('btn-logout').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '/';
    });

    // 3. Fetch Dashboard Data
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
        
        // 4. Render Data
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
                
                // Secure DOM construction vs innerHTML
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
