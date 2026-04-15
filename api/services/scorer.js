const { spawn } = require('child_process');
const path = require('path');

function runScoringEngine(wallet) {
    return new Promise((resolve, reject) => {
        const apiKey = process.env.ETHERSCAN_API_KEY;
        if (!apiKey) {
            return reject({ status: 500, error: 'ETHERSCAN_API_KEY not configured', code: 500 });
        }

        const scriptPath = path.join(__dirname, '..', '..', 'engine', 'score.py');
        const python = spawn('python3', [scriptPath, wallet, apiKey]);

        let output = '';
        let errorOutput = '';
        let responded = false;

        const timer = setTimeout(() => {
            python.kill();
            if (!responded) {
                responded = true;
                console.error(`[timeout] scoring engine killed after 25s | wallet: ${wallet}`);
                reject({ status: 504, error: 'scoring engine timeout', code: 504 });
            }
        }, 25000);

        python.stdout.on('data', (data) => { output += data.toString(); });
        python.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        python.on('close', (code) => {
            clearTimeout(timer);
            if (responded) return;
            responded = true;

            try {
                const result = JSON.parse(output.trim());
                if (result.error) {
                    return reject({ status: 500, error: result.error, code: 500 });
                }
                resolve(result);
            } catch (e) {
                console.error('[parse error]', e.message, '| raw output:', output);
                reject({ status: 500, error: 'scoring engine returned invalid response', code: 500 });
            }
        });

        python.on('error', (err) => {
            clearTimeout(timer);
            if (responded) return;
            responded = true;
            console.error('[spawn error]', err);
            reject({ status: 500, error: 'failed to start scoring engine', code: 500 });
        });
    });
}

module.exports = { runScoringEngine };
