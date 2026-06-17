import sys
import json
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from inference.predict import predict_email

if __name__ == "__main__":
    try:
        input_data = sys.stdin.read()
        if not input_data:
            print(json.dumps({"error": "No input provided"}))
            sys.exit(1)
        data = json.loads(input_data)
        
        sender = data.get("sender", "")
        subject = data.get("subject", "")
        body = data.get("body", "")
        
        result = predict_email(sender, subject, body)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
