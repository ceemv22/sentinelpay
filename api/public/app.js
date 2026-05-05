document.addEventListener('DOMContentLoaded', () => {
    // Intercept Double-Verification Errors before scrubbing
    const interceptAuthErrors = () => {
        const hash = window.location.hash;
        if (hash && hash.includes('error_description=Email+link+is+invalid+or+has+expired')) {
            if (window.SentinelToast) {
                window.SentinelToast.show("Verification link expired or already used. Please login.", "warning");
            }
        }
    };
    interceptAuthErrors();

    // 0. ULTIMATE HASH SCRUBBER (Aggressively kills # trailing fragments)
    const scrubHash = () => {
        if (window.location.href.indexOf('#') > -1) {
            window.history.replaceState(null, document.title, window.location.href.split('#')[0]);
        }
    };

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
            // Scrub hash AFTER Supabase has read the token from the URL
            scrubHash();
            let appScrubInterval = setInterval(scrubHash, 50);
            setTimeout(() => clearInterval(appScrubInterval), 3000);

            cachedSession = session;
            if (session) {
                const authContainer = document.getElementById('auth-nav-container');
                if (authContainer) {
                    authContainer.replaceChildren();
                    const dashboardLink = document.createElement('a');
                    dashboardLink.href = '/dashboard';
                    dashboardLink.className = 'auth-nav-btn';
                    dashboardLink.textContent = 'Dashboard';
                    authContainer.appendChild(dashboardLink);
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
        flagsContainer.replaceChildren();
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
            showError('Error: Invalid Ethereum address format.');
            return;
        }

        let bodyData = { wallet };

        if (!cachedSession) {
            const turnstileToken = window.explicitScannerToken || document.querySelector('[name="cf-turnstile-response"]')?.value;
            
            // If no token, render the CAPTCHA and halt execution
            if (!turnstileToken) {
                if (!window.turnstileScannerWidgetId && window.turnstile) {
                    btn.disabled = true;
                    btn.textContent = 'Please solve CAPTCHA...';
                    window.turnstileScannerWidgetId = window.turnstile.render('#turnstile-scanner', {
                        sitekey: '0x4AAAAAADGpMozD1QOtWPkP',
                        theme: 'dark',
                        callback: function(token) {
                            window.explicitScannerToken = token;
                            btn.disabled = false;
                            btn.textContent = 'Scan Wallet';
                            btn.click(); // Auto-trigger the scan once solved
                        }
                    });
                }
                return; // Wait for user to solve CAPTCHA
            }
            bodyData['cf-turnstile-response'] = turnstileToken;
        }

        resetUI();
        btn.disabled = true;
        btn.textContent = 'Scanning...';

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
                body: JSON.stringify(bodyData)
            });

            // Remove turnstile after attempt to prevent infinite looping
            if (!cachedSession && window.turnstile && window.turnstileScannerWidgetId !== undefined) {
                window.turnstile.remove(window.turnstileScannerWidgetId);
                window.turnstileScannerWidgetId = undefined;
                window.explicitScannerToken = null;
            }

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 403 && data.requiresAuth) {
                    throw new Error('Free limit reached. Please log in or register to continue.');
                }
                if (response.status === 403 && data.requiresUpgrade) {
                    throw new Error('Out of credits. Please visit your dashboard to add more.');
                }
                if (response.status === 429) throw new Error('Rate limit exceeded. Please try again later.');
                throw new Error(data.error || 'Internal system error.');
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
                    typeFlag('No Risk Detected', true);
                }
                
                // Show share button after a small delay
                setTimeout(() => shareBtn.classList.remove('hidden'), 1000);
            }, 800);

        } catch (err) {
            showError(`error: ${err.message}`);
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
    // Navigation persistence logic
    const loginNav = document.getElementById('nav-login-btn');
    const registerNav = document.getElementById('nav-register-btn');
    if (loginNav) loginNav.addEventListener('click', () => sessionStorage.setItem('sentinel_auth_tab', 'login'));
    if (registerNav) registerNav.addEventListener('click', () => sessionStorage.setItem('sentinel_auth_tab', 'register'));
});
