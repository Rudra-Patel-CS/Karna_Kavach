import re
from urllib.parse import urlparse
from typing import Dict, Any, List

SHORTENERS = [
    "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", 
    "buff.ly", "adf.ly", "bit.do", "mcaf.ee", "su.pr", "cutt.ly"
]

SUSPICIOUS_KEYWORDS = [
    "login", "verify", "secure", "update", "bank", "password", 
    "confirm", "wallet", "gift", "free", "reward", "urgent", 
    "account", "billing", "invoice", "payment", "support",
    "auth", "credential", "locked", "suspended"
]

def extract_urls(text: str) -> List[str]:
    """Extracts all URLs from a given text string."""
    url_pattern = re.compile(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\(\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+')
    urls = re.findall(url_pattern, text)
    return list(set(urls))

def analyze_url(url: str) -> Dict[str, Any]:
    """
    Analyzes a URL for common phishing indicators and returns a risk score
    along with reasons and classification.
    """
    reasons = []
    risk_score = 0
    
    if not url:
        return {
            "url": url,
            "classification": "Safe",
            "risk_score": 0,
            "reasons": []
        }
        
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        path = parsed.path.lower()
        query = parsed.query.lower()
        
        # 1. Check for IP address instead of domain name
        domain_no_port = domain.split(':')[0]
        if re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", domain_no_port):
            reasons.append("Uses an IP address instead of a domain name")
            risk_score += 50
            
        # 2. Check length (excessively long URLs hide the real domain or parameters)
        if len(url) > 75:
            reasons.append("Excessively long URL (over 75 characters)")
            risk_score += 15
            
        # 3. Check URL shorteners
        if any(shortener in domain for shortener in SHORTENERS):
            reasons.append("Uses a known URL shortening service")
            risk_score += 40
            
        # 4. Check suspicious keywords anywhere in the URL
        url_lower = url.lower()
        found_keywords = [kw for kw in SUSPICIOUS_KEYWORDS if kw in url_lower]
        if found_keywords:
            reasons.append(f"Contains suspicious keywords: {', '.join(found_keywords)}")
            risk_score += 20 + (len(found_keywords) * 5)
            
        # 5. Check excessive subdomains (rough heuristic: more than 3 dots usually = many subdomains)
        # e.g., login.secure.paypal.com.scam.net
        parts = domain.split('.')
        # Exclude simple IP cases from subdomain logic
        if len(parts) > 3 and not domain_no_port.replace('.', '').isnumeric():
            reasons.append("Contains excessive subdomains")
            risk_score += 30
            
        # 6. Check HTTP vs HTTPS
        if parsed.scheme == "http":
            reasons.append("Uses unencrypted HTTP instead of HTTPS")
            risk_score += 20
            
        # 7. Check encoded or obfuscated characters (e.g. %20, %40 etc)
        if "%" in domain or len(re.findall(r"%[0-9a-f]{2}", path, re.I)) > 3:
            reasons.append("Contains encoded or obfuscated characters")
            risk_score += 25

        # 8. High entropy / Base64 patterns in URL (looks like a long tracking or evasion payload)
        if re.search(r"[a-zA-Z0-9+/=]{40,}", path + query):
            reasons.append("Contains very long random or encoded strings (high entropy)")
            risk_score += 20
            
    except Exception as e:
        reasons.append(f"Malformed URL structure")
        risk_score += 60

    # Cap score at 100
    risk_score = min(risk_score, 100)
    
    # Classify
    classification = "Safe"
    if risk_score >= 70:
        classification = "High Risk"
    elif risk_score >= 40:
        classification = "Suspicious"
        
    return {
        "url": url,
        "classification": classification,
        "risk_score": risk_score,
        "reasons": reasons
    }
