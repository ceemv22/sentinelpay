import sys
import json
import time
import requests
import os
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
MIXERS_FILE = DATA_DIR / "mixers.json"

ETHERSCAN_URL = "https://api.etherscan.io/v2/api"
REQUEST_TIMEOUT = 15


class UpstreamDataError(Exception):
    pass

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
            return valid
    except Exception as e:
        print(f"error loading mixer addresses: {e}", file=sys.stderr)
        return []

def fetch_etherscan(params, timeout=REQUEST_TIMEOUT):
    try:
        response = requests.get(ETHERSCAN_URL, params=params, timeout=timeout)
        response.raise_for_status()
        data = response.json()
        if data.get("status") == "1":
            return data.get("result", [])

        message = str(data.get("message", "")).lower()
        result = data.get("result", "")
        if "no transactions found" in message or "no records found" in str(result).lower():
            return []

        raise UpstreamDataError(f"etherscan rejected request: {result or message or 'unknown error'}")
    except Exception as e:
        if isinstance(e, UpstreamDataError):
            raise
        raise UpstreamDataError(f"etherscan error: {e}") from e

def fetch_all_relevant_txs(wallet, api_key):
    # OWASP S-Tier Hardening: We limit the scan depth to the latest 200 transactions.
    # This provides a statistically significant sample for risk analysis while 
    # preventing Resource Exhaustion (DDoS) attacks from extremely deep wallets.
    base_params = {
        "chainid": 1,
        "module": "account",
        "address": wallet,
        "sort": "desc",
        "page": 1,
        "offset": 200, 
        "apikey": api_key,
        "endblock": 999999999
    }

    print(f"[DEBUG] fetching latest 200 txs for {wallet[:10]}...", file=sys.stderr)
    
    normal = fetch_etherscan({**base_params, "action": "txlist"})
    internal = fetch_etherscan({**base_params, "action": "txlistinternal"})
    tokens = fetch_etherscan({**base_params, "action": "tokentx"})
    
    return normal, internal, tokens

def get_wallet_birth_timestamp(wallet, api_key):
    # Specifically fetch the OLDEST transaction to determine wallet age accurately
    params = {
        "chainid": 1,
        "module": "account",
        "action": "txlist",
        "address": wallet,
        "startblock": 0,
        "endblock": 999999999,
        "sort": "asc",
        "page": 1,
        "offset": 1,
        "apikey": api_key
    }
    res = fetch_etherscan(params)
    if res and len(res) > 0:
        return int(res[0].get("timeStamp", 0))
    return None

def check_mixer_interaction(wallet, normal_txs, internal_txs, token_txs):
    mixer_set = set(load_mixer_addresses())
    if not mixer_set:
        return False
        
    for tx_list in [normal_txs, internal_txs, token_txs]:
        for tx in tx_list:
            to_addr = tx.get("to", "").lower()
            from_addr = tx.get("from", "").lower()
            if to_addr in mixer_set or from_addr in mixer_set:
                return True
    return False

def check_wallet_age(birth_ts):
    if birth_ts is None:
        return True
    age_days = (time.time() - birth_ts) / 86400
    return age_days < 30

def check_high_velocity(normal_txs):
    if not normal_txs: return False
    now = time.time()
    # Since we fetched with sort=desc, recent txs are at the beginning
    recent = [tx for tx in normal_txs if now - int(tx.get("timeStamp", 0)) < 86400]
    return len(recent) > 50

def check_inbound_outbound_imbalance(wallet, normal_txs):
    if not normal_txs: return False
    wallet_lower = wallet.lower()
    inbound = sum(1 for tx in normal_txs if tx.get("to", "").lower() == wallet_lower)
    outbound = sum(1 for tx in normal_txs if tx.get("from", "").lower() == wallet_lower)
    if inbound == 0 or outbound == 0: return True
    ratio = max(inbound, outbound) / min(inbound, outbound)
    return ratio > 10

def calculate_score_and_flags(wallet, api_key):
    flags = []
    score = 0

    normal_txs, internal_txs, token_txs = fetch_all_relevant_txs(wallet, api_key)
    
    # Check if the address ITSELF is sanctioned or a known mixer/scammer
    mixer_set = set(load_mixer_addresses())
    if wallet.lower() in mixer_set:
        flags.append("sanctioned_entity")
        score = 100
        return score, "high", flags

    if check_mixer_interaction(wallet, normal_txs, internal_txs, token_txs):
        flags.append("mixer_interaction")
        score += 50

    birth_ts = get_wallet_birth_timestamp(wallet, api_key)
    if check_wallet_age(birth_ts):
        flags.append("new_wallet")
        score += 20

    if check_high_velocity(normal_txs):
        flags.append("high_velocity")
        score += 20

    if check_inbound_outbound_imbalance(wallet, normal_txs):
        flags.append("io_imbalance")
        score += 10

    score = min(score, 100)
    category = "high" if score >= 60 else ("medium" if score >= 30 else "low")
    
    return score, category, flags

def main():
    if len(sys.argv) != 2:
        print(json.dumps({"error": "usage: python score.py <wallet>"}))
        sys.exit(1)

    wallet = sys.argv[1].strip()
    api_key = os.environ.get("ETHERSCAN_API_KEY")

    if not wallet.startswith("0x") or len(wallet) != 42:
        print(json.dumps({"error": "invalid wallet address format"}))
        sys.exit(1)

    if not api_key:
        print(json.dumps({"error": "ETHERSCAN_API_KEY environment variable not set"}))
        sys.exit(1)

    try:
        score, category, flags = calculate_score_and_flags(wallet, api_key)
        print(json.dumps({"score": score, "category": category, "flags": flags}))
    except Exception as e:
        print(json.dumps({"error": f"scoring failed: {str(e)}"}))
        sys.exit(1)

if __name__ == "__main__":
    main()
