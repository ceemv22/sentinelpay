import json
import requests
import re
import sys
from pathlib import Path

SOURCES = [
    {
        "name": "OFAC Sanctions (ultrasoundmoney CSV)",
        "url": "https://raw.githubusercontent.com/ultrasoundmoney/ofac-ethereum-addresses/main/data.csv"
    },
    {
        "name": "Tornado Cash Core Config",
        "url": "https://raw.githubusercontent.com/TornadoCash/tornado-core/master/src/config.js"
    },
    {
        "name": "Tornado Anonymity Mining Config",
        "url": "https://raw.githubusercontent.com/tornadocash/tornado-anonymity-mining/master/config/networks.json"
    }
]

DATA_DIR = Path(__file__).parent.parent / "data"
MIXERS_FILE = DATA_DIR / "mixers.json"

def fetch_addresses():
    all_addresses = set()
    address_regex = re.compile(r"0x[a-fA-F0-9]{40}")

    if MIXERS_FILE.exists():
        try:
            with open(MIXERS_FILE, "r") as f:
                data = json.load(f)
                all_addresses.update(data.get("mixers", []))
        except Exception as e:
            print(f"[-] Could not load existing mixers.json: {e}")

    for source in SOURCES:
        print(f"[*] Fetching {source['name']}...")
        try:
            response = requests.get(source['url'], timeout=15)
            response.raise_for_status()
            found = address_regex.findall(response.text)
            print(f"    [+] Found {len(found)} candidates.")
            all_addresses.update(found)
        except Exception as e:
            print(f"    [-] Error fetching {source['name']}: {e}")

    WHITELIST = {
        "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        "0xdac17f958d2ee523a2206206994597c13d831ec7",
        "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        "0x6b175474e89094c44da98b954eedeac495271d0f",
    }

    valid_addresses = set()
    for addr in all_addresses:
        if not isinstance(addr, str):
            continue
        cleaned = addr.strip().lower()
        if len(cleaned) == 42 and cleaned not in WHITELIST:
            valid_addresses.add(cleaned)

    return sorted(list(valid_addresses))

def main():
    print("=== sentinelpay Mixer Database Updater ===")

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    addresses = fetch_addresses()

    if not addresses:
        print("[-] No valid addresses found. Aborting update.")
        sys.exit(1)

    print(f"[+] Found {len(addresses)} unique high-risk addresses.")

    output = {
        "updated_at": "2026-04-20T01:12:00Z",
        "mixers": addresses
    }

    try:
        with open(MIXERS_FILE, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=4)
        print(f"[!] Successfully updated {MIXERS_FILE}")
    except Exception as e:
        print(f"[-] Failed to write to {MIXERS_FILE}: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
