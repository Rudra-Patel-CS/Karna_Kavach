import sys
import json
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from feature_engineering.url_analyzer import analyze_url

if __name__ == "__main__":
    if len(sys.argv) > 1:
        url_input = sys.argv[1].strip()
        result = analyze_url(url_input)
        print(json.dumps(result))
    else:
        print(json.dumps({"error": "No URL provided"}))
        sys.exit(1)
