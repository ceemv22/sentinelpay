import sys
import json
import time
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
            valid = [
                addr.lower() for addr in mixers
                if isinstance(addr, str)
                and addr.startswith("0x")
                and len(addr) == 42
            ]
            print(f"[DEBUG] loaded {len(valid)} valid mixer addresses", file=sys.stderr)
            return valid
    except Exception as e:
        print(f"error loading mixer addresses: {e}", file=sys.stderr)
        return []

def fetch_transactions(wallet, api_key, tx_type="normal"):
    action = "txlist" if tx_type == "normal" else "txlistinternal"
    print(f"[DEBUG] fetching {tx_type} txs for {wallet[:10]}...", file=sys.stderr)
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
            msg = data.get("message", "unknown error")
            print(f"[DEBUG] etherscan {tx_type} returned status!=1: {msg}", file=sys.stderr)
            return []
        txs = data.get("result", [])
        print(f"[DEBUG] got {len(txs)} {tx_type} transactions", file=sys.stderr)
        return txs
    except requests.exceptions.Timeout:
        print(f"[DEBUG] etherscan timeout for {tx_type} txs", file=sys.stderr)
        return []
    except Exception as e:
        print(f"[DEBUG] etherscan error ({tx_type}): {e}", file=sys.stderr)
        return []

def fetch_all_transactions(wallet, api_key):
    normal = fetch_transactions(wallet, api_key, "normal")
    internal = fetch_transactions(wallet, api_key, "internal")
    return normal, internal

def check_mixer_interaction(wallet, api_key, normal_txs, internal_txs):
    mixer_set = set(load_mixer_addresses())
    if not mixer_set:
        print("[DEBUG] no mixer addresses loaded", file=sys.stderr)
        return False
    for txs, tx_type in [(normal_txs, "normal"), (internal_txs, "internal")]:
        for tx in txs:
            to_addr = tx.get("to", "").lower()
            from_addr = tx.get("from", "").lower()
            if to_addr in mixer_set or from_addr in mixer_set:
                print(f"[DEBUG] mixer found in {tx_type}: {tx.get('hash')}", file=sys.stderr)
                return True
    return False

def check_wallet_age(normal_txs):
    if not normal_txs:
        return True
    try:
        first_tx_time = int(normal_txs[0].get("timeStamp", 0))
        age_days = (time.time() - first_tx_time) / 86400
        print(f"[DEBUG] wallet age: {age_days:.1f} days", file=sys.stderr)
        return age_days < 30
    except Exception as e:
        print(f"[DEBUG] wallet age error: {e}", file=sys.stderr)
        return False

def check_high_velocity(normal_txs):
    if not normal_txs:
        return False
    try:
        now = time.time()
        recent = [tx for tx in normal_txs if now - int(tx.get("timeStamp", 0)) < 86400]
        print(f"[DEBUG] txs in last 24h: {len(recent)}", file=sys.stderr)
        return len(recent) > 50
    except Exception as e:
        print(f"[DEBUG] velocity error: {e}", file=sys.stderr)
        return False

def check_inbound_outbound_imbalance(wallet, normal_txs):
    if not normal_txs:
        return False
    wallet_lower = wallet.lower()
    inbound = sum(1 for tx in normal_txs if tx.get("to", "").lower() == wallet_lower)
    outbound = sum(1 for tx in normal_txs if tx.get("from", "").lower() == wallet_lower)
    print(f"[DEBUG] inbound: {inbound}, outbound: {outbound}", file=sys.stderr)
    if inbound == 0 or outbound == 0:
        return True
    ratio = max(inbound, outbound) / min(inbound, outbound)
    return ratio > 10

def calculate_score_and_flags(wallet, api_key):
    flags = []
    score = 0

    normal_txs, internal_txs = fetch_all_transactions(wallet, api_key)

    if check_mixer_interaction(wallet, api_key, normal_txs, internal_txs):
        flags.append("mixer_interaction")
        score += 50

    if check_wallet_age(normal_txs):
        flags.append("new_wallet")
        score += 20

    if check_high_velocity(normal_txs):
        flags.append("high_velocity")
        score += 20

    if check_inbound_outbound_imbalance(wallet, normal_txs):
        flags.append("io_imbalance")
        score += 10

    score = min(score, 100)

    if score >= 60:
        category = "high"
    elif score >= 30:
        category = "medium"
    else:
        category = "low"

    print(f"[DEBUG] final score: {score}, category: {category}, flags: {flags}", file=sys.stderr)
    return score, category, flags

def main():
    print("[DEBUG] score.py started", file=sys.stderr)
    print(f"[DEBUG] wallet: {sys.argv[1] if len(sys.argv) > 1 else 'none'}", file=sys.stderr)

    if len(sys.argv) != 3:
        print(json.dumps({"error": "usage: python score.py <wallet> <api_key>"}))
        sys.exit(1)

    wallet = sys.argv[1].strip()
    api_key = sys.argv[2].strip()

    if not wallet.startswith("0x") or len(wallet) != 42:
        print(json.dumps({"error": "invalid wallet address format"}))
        sys.exit(1)

    if not api_key or api_key == "your_api_key_here":
        print(json.dumps({"error": "missing or placeholder ETHERSCAN_API_KEY"}))
        sys.exit(1)

    try:
        score, category, flags = calculate_score_and_flags(wallet, api_key)
        print(json.dumps({"score": score, "category": category, "flags": flags}))
    except Exception as e:
        print(json.dumps({"error": f"scoring failed: {str(e)}"}))
        sys.exit(1)

if __name__ == "__main__":
    main()