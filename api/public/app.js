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
            const response = await fetch('/v1/public/score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet })
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 429) throw new Error('rate_limit_exceeded');
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
        const text = encodeURIComponent(`Wallet [${lastResult.wallet.slice(0, 6)}...] flagged as ${lastResult.category.toUpperCase()} risk (${lastResult.score}/100) by @SentinelPay. \n\nProtect your B2B crypto flow: sentinelpay.org`);
        window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
    });
});
