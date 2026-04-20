const supabaseUrl = 'https://aivqwkgjdpklxxuvkxpy.supabase.co';
const supabaseKey = 'sb_publishable_bRfAssaGT6D8oFDQtPARbw_5fyYGWM6';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Check auth state
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
        // Not logged in, redirect
        window.location.href = '/auth';
        return;
    }

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
            historyContainer.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">no scans yet. go back to the scanner to check a wallet.</p>';
        } else {
            historyContainer.innerHTML = ''; // clear
            
            data.history.forEach(item => {
                const el = document.createElement('div');
                el.className = `history-item ${item.category}`; // high, medium, low
                
                const dateRaw = new Date(item.timestamp);
                const dateStr = dateRaw.toLocaleDateString() + ' ' + dateRaw.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                el.innerHTML = `
                    <div style="display:flex; flex-direction: column; gap: 0.25rem;">
                        <strong style="color: var(--text);">${item.wallet}</strong>
                        <span style="color: var(--text-secondary); font-size: 0.75rem;">${dateStr}</span>
                    </div>
                    <div style="display: flex; gap: 1rem; align-items: center;">
                        <span style="background: rgba(255,255,255,0.1); padding: 0.2rem 0.6rem; border-radius: 4px;">Score: ${item.score}</span>
                    </div>
                `;
                historyContainer.appendChild(el);
            });
        }
    } catch (err) {
        console.error(err);
        document.getElementById('user-email').textContent = 'error loading profile.';
    }
});
