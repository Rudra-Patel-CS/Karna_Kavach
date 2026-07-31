import sys
import json
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from preprocessing.email_parser import parse_raw_email

if __name__ == "__main__":
    if hasattr(sys.stdin, 'reconfigure'):
        sys.stdin.reconfigure(encoding='utf-8', errors='replace')
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')

    try:
        raw_text = sys.stdin.read()
        parsed_data = parse_raw_email(raw_text)
        print(json.dumps(parsed_data))
    except Exception as e:
        print(json.dumps({"parsed_successfully": False, "error": str(e)}))
        sys.exit(1)
