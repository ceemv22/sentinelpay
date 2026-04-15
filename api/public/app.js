document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('wallet-input');
    const btn = document.getElementById('scan-btn');
    const resultCard = document.getElementById('result-card');
    const statusMsg = document.getElementById('status-message');
    
    const lights = {
        high: document.getElementById('light-high'),
        medium: document.getElementById('light-medium'),
        low: document.getElementById('light-low')
    };
    
    const scoreValue = document.getElementById('score-value');
    const flagsContainer = document.getElementById('flags-container');

    function resetUI() {
        resultCard.classList.add('hidden');
        statusMsg.style.display = 'none';
        Object.values(lights).forEach(l => l.classList.remove('active'));
        flagsContainer.innerHTML = '';
        scoreValue.style.color = 'var(--text-main)';
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

    function renderScore(score, category) {
        let current = 0;
        const target = score;
        const duration = 1000;
        const stepTime = Math.max(16, duration / (target + 1));
        
        const timer = setInterval(() => {
            scoreValue.textContent = current;
            if (current >= target) {
                clearInterval(timer);
                if (category === 'high') scoreValue.style.color = 'var(--color-red)';
                if (category === 'medium') scoreValue.style.color = 'var(--color-yellow)';
                if (category === 'low') scoreValue.style.color = 'var(--color-green)';
            }
            current++;
            if(current > 100) current = 100;
        }, stepTime);
    }

    input.addEventListener('input', () => {
        if (statusMsg.style.display === 'block') {
            statusMsg.style.display = 'none';
        }
    });

    btn.addEventListener('click', async () => {
        const wallet = input.value.trim();
        if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
            showError('Invalid wallet address format');
            return;
        }

        resetUI();
        btn.disabled = true;
        btn.textContent = 'Scanning...';

        try {
            const response = await fetch('/v1/public/score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet })
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error('Rate limit exceeded. Try again later.');
                }
                throw new Error(data.error || 'Server error');
            }

            // Show results
            resultCard.classList.remove('hidden');
            setLight(data.category);
            renderScore(data.score, data.category);

            if (data.flags && data.flags.length > 0) {
                data.flags.forEach(flag => {
                    const badge = document.createElement('div');
                    badge.className = 'flag-badge';
                    badge.textContent = flag;
                    flagsContainer.appendChild(badge);
                });
            } else {
                const badge = document.createElement('div');
                badge.className = 'flag-badge safe';
                badge.textContent = 'NO_FLAGS_DETECTED';
                flagsContainer.appendChild(badge);
            }

        } catch (err) {
            showError(err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Scan Wallet';
        }
    });
});
