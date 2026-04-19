import json
import requests
import re
import sys
from pathlib import Path

# Data Sources (Using Raw Regex to pull addresses from JS, CSV, and JSON)
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
    address_regex = re.compile(r"0x[a-fA-F0-9]{40}") # Case insensitive search
    
    # Keep current addresses as a base
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
            
            # Find all 0x addresses in any text format
            found = address_regex.findall(response.text)
            print(f"    [+] Found {len(found)} candidates.")
            all_addresses.update(found)
                    
        except Exception as e:
            print(f"    [-] Error fetching {source['name']}: {e}")

    # Validation & Normalization
    valid_addresses = set()
    for addr in all_addresses:
        if not isinstance(addr, str):
            continue
        cleaned = addr.strip().lower()
        if len(cleaned) == 42: # Ensure full length
            valid_addresses.add(cleaned)
    
    return sorted(list(valid_addresses))

def main():
    print("=== SentinelPay Mixer Database Updater ===")
    
    # Ensure data directory exists
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    addresses = fetch_addresses()
    
    if not addresses:
        print("[-] No valid addresses found. Aborting update.")
        sys.exit(1)

    print(f"[+] Found {len(addresses)} unique high-risk addresses.")
    
    # Save to JSON
    output = {
        "updated_at": "2026-04-20T01:12:00Z", # Placeholder for manual run timestamp if needed
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
