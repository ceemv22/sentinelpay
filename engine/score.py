import sys
import json
import requests
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
MIXERS_FILE = DATA_DIR / "mixers.json"

ETHERSCAN_URL = "https://api.etherscan.io/v2/api"
REQUEST_TIMEOUT = 15

def load_mixer_addresses():
    if not MIXERS_FILE.exists():
        print(f"warning: {MIXERS_FILE} not found", file=sys.stderr)
        return []
    
    try:
        with open(MIXERS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            mixers = data.get("mixers", [])
            return [addr.lower() for addr in mixers if addr.startswith("0x")]
    except Exception as e:
        print(f"error loading mixer addresses: {e}", file=sys.stderr)
        return []
    
def check_etherscan_transactions(wallet, api_key, tx_type="normal"):
    action = "txlist" if tx_type == "normal" else "txlistinternal"
    print(f"[DEBUG] Checking {tx_type} txs for {wallet[:10]}... with API key: {api_key[:4]}...", file=sys.stderr)
    params = {
        "chainid": 1,
        "module": "account",
        "action": action,
        "address": wallet,
        "startblock": 0,
        "endblock": 99999999,
        "sort": "asc",
        "apikey": api_key
    }
    try:
        response = requests.get(ETHERSCAN_URL, params=params, timeout=REQUEST_TIMEOUT)
        data = response.json()
        
        if data.get("status") != "1":
            return False
        
        mixers = load_mixer_addresses()
        if not mixers:
            print("[DEBUG] no mixer addresses loaded", file=sys.stderr)
            return False
        
        mixer_set = set(mixers)
        txs = data.get("result", [])
        print(f"[DEBUG] checking {len(txs)} {tx_type} transactions", file=sys.stderr)

        for tx in txs:
            to_addr = tx.get("to", "").lower()
            from_addr = tx.get("from", "").lower()
            if to_addr in mixer_set or from_addr in mixer_set:
                print(f"[DEBUG] mixer interaction found! tx hash: {tx.get('hash')}", file=sys.stderr)
                return True
            
        return False
        
    except requests.exceptions.Timeout:
        print(f"etherscan timeout for {tx_type} txs", file=sys.stderr)
        return False
    except Exception as e:
        print(f"etherscan error ({tx_type}): {e}", file=sys.stderr)
        return False
    
def check_mixer_interaction(wallet, api_key):
    if check_etherscan_transactions(wallet, api_key, "normal"):
        return True
    
    if check_etherscan_transactions(wallet, api_key, "internal"):
        return True
    
    return False

def calculate_score_and_flags(wallet, api_key):
    flags = []

    has_mixer = check_mixer_interaction(wallet, api_key)
    if has_mixer:
        flags.append("mixer_interaction")

    if has_mixer:
        score = 85
        category = "high"
    else:
        score = 10
        category = "low"

    return score, category, flags

def main():
    print("[DEBUG] script started", file=sys.stderr)
    print(f"[DEBUG] Arguments: {sys.argv}", file=sys.stderr)
    if len(sys.argv) != 3:
        print(json.dumps({"error": "usage: python score.py <wallet> <api_key>"}))
        sys.exit(1)

    wallet = sys.argv[1].strip()
    api_key = sys.argv[2].strip()

    if not wallet.startswith("0x") or len(wallet) != 42:
        print(json.dumps({"error": "invalid wallet address format"}))
        sys.exit(1)

    try:
        score, category, flags = calculate_score_and_flags(wallet, api_key)
        print(json.dumps({"score": score, "category": category, "flags": flags}))
    except Exception as e:
        print(json.dumps({"error": f"scoring failed: {str(e)}"}))
        sys.exit(1)

if __name__ == "__main__":
    main()