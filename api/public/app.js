document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('wallet-input');
    const btn = document.getElementById('scan-btn');
    const shareBtn = document.getElementById('share-btn');
    const resultCard = document.getElementById('result-card');
    const statusMsg = document.getElementById('status-message');
    
    const lights = {
        high: document.getElementById('light-high'),
        medium: document.getElementById('light-medium'),
        low: document.getElementById('light-low')
    };
    
    const scoreValue = document.getElementById('score-value');
    const flagsContainer = document.getElementById('flags-container');
    const authNavBtn = document.getElementById('auth-nav-btn');

    // Supabase Auth and Fingerprint Init
    const supabaseUrl = 'https://aivqwkgjdpklxxuvkxpy.supabase.co';
    const supabaseKey = 'sb_publishable_bRfAssaGT6D8oFDQtPARbw_5fyYGWM6';
    const supabaseClient = window.supabase ? window.supabase.createClient(supabaseUrl, supabaseKey) : null;
    let cachedSession = null;

    if (!localStorage.getItem('sentinel_fp')) {
        localStorage.setItem('sentinel_fp', crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2));
    }
    const fingerprint = localStorage.getItem('sentinel_fp');

    if (supabaseClient) {
        supabaseClient.auth.getSession().then(({ data: { session } }) => {
            cachedSession = session;
            if (session) {
                if (authNavBtn) {
                    authNavBtn.textContent = 'dashboard';
                    authNavBtn.href = '/dashboard';
                }
            }
        });
    }

    let lastResult = null;

    function resetUI() {
        resultCard.classList.add('hidden');
        shareBtn.classList.add('hidden');
        statusMsg.style.display = 'none';
        Object.values(lights).forEach(l => l.classList.remove('active'));
        flagsContainer.innerHTML = '';
        scoreValue.style.color = 'var(--text-main)';
        scoreValue.textContent = '00';
    }

    function showError(msg) {
        statusMsg.textContent = msg;
        statusMsg.style.display = 'block';
    }

    function setLight(category) {
        if (category === 'high') lights.high.classList.add('active');
        else if (category === 'medium') lights.medium.classList.add('active');
        else if (category === 'low') lights.low.classList.add('active');
    }

    function scrambleScore(finalScore, category) {
        let iterations = 0;
        const maxIterations = 20;
        const interval = setInterval(() => {
            scoreValue.textContent = Math.floor(Math.random() * 100).toString().padStart(2, '0');
            iterations++;
            
            if (iterations > maxIterations) {
                clearInterval(interval);
                scoreValue.textContent = finalScore.toString().padStart(2, '0');
                if (category === 'high') scoreValue.style.color = 'var(--color-red)';
                if (category === 'medium') scoreValue.style.color = 'var(--color-yellow)';
                if (category === 'low') scoreValue.style.color = 'var(--color-green)';
            }
        }, 40);
    }

    function typeFlag(text, isSafe) {
        const badge = document.createElement('div');
        badge.className = isSafe ? 'flag-badge safe' : 'flag-badge';
        flagsContainer.appendChild(badge);
        
        let i = 0;
        const typeInterval = setInterval(() => {
            badge.textContent += text.charAt(i);
            i++;
            if (i >= text.length) clearInterval(typeInterval);
        }, 30);
    }

    btn.addEventListener('click', async () => {
        const wallet = input.value.trim();
        if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
            showError('error: invalid eth address hex');
            return;
        }

        resetUI();
        btn.disabled = true;
        btn.textContent = 'scanning...';

        try {
            const endpoint = cachedSession ? '/v1/user/score' : '/v1/public/score';
            const headers = {
                'Content-Type': 'application/json',
                'x-fingerprint': fingerprint
            };

            if (cachedSession) {
                headers['Authorization'] = `Bearer ${cachedSession.access_token}`;
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ wallet })
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 403 && data.requiresAuth) {
                    throw new Error('free limit reached. please login/register to continue.');
                }
                if (response.status === 403 && data.requiresUpgrade) {
                    throw new Error('out of credits. go to dashboard to refill.');
                }
                if (response.status === 429) throw new Error('rate_limit_exceeded (try later)');
                throw new Error(data.error || 'sys_error');
            }

            lastResult = data;
            resultCard.classList.remove('hidden');
            scrambleScore(data.score, data.category);
            
            setTimeout(() => {
                setLight(data.category);
                if (data.flags && data.flags.length > 0) {
                    data.flags.forEach((flag, idx) => {
                        setTimeout(() => typeFlag(flag, false), idx * 400); 
                    });
                } else {
                    typeFlag('no_risk_detected', true);
                }
                
                // Show share button after a small delay
                setTimeout(() => shareBtn.classList.remove('hidden'), 1000);
            }, 800);

        } catch (err) {
            showError(`[err_code]: ${err.message}`);
        } finally {
            btn.disabled = false;
            btn.textContent = 'scan wallet';
        }
    });

    shareBtn.addEventListener('click', () => {
        if (!lastResult) return;
        const text = encodeURIComponent(`Wallet [${lastResult.wallet.slice(0, 6)}...] flagged as ${lastResult.category.toUpperCase()} risk (${lastResult.score}/100) by @sentinelpayorg. \n\nProtect your B2B crypto flow: sentinelpay.org`);
        window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
    });

    // Eye-Cursor Tracking Logic
    const pupil = document.getElementById('eye-pupil');
    if (pupil) {
        document.addEventListener('mousemove', (e) => {
            const windowCenterX = window.innerWidth / 2;
            const windowCenterY = window.innerHeight / 2;
            
            // Calculate offset from -1 to 1
            const offsetX = (e.clientX - windowCenterX) / windowCenterX;
            const offsetY = (e.clientY - windowCenterY) / windowCenterY;
            
            // Max movement in SVG coordinate space
            const maxMove = 3; 
            const moveX = offsetX * maxMove;
            const moveY = offsetY * maxMove;
            
            pupil.style.transform = `translate(${moveX}px, ${moveY}px)`;
        });
    }
});
