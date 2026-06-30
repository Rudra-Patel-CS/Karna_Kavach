"""
KarnaKavach — Professional Rule Engine
Applies deterministic phishing detection rules on top of the ML model.
Returns a risk score (0-100), list of triggered rules, and threat category.
"""

import re
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from feature_engineering.url_analyzer import analyze_url, extract_urls

# ── URL shorteners ────────────────────────────────────────────────────────────
SHORTENERS = {
    "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd",
    "buff.ly", "adf.ly", "bit.do", "cutt.ly", "rb.gy", "shorte.st",
}

# ── Credential-harvest keywords ───────────────────────────────────────────────
CREDENTIAL_KEYWORDS = [
    r'\bpassword\b', r'\bpasswd\b', r'\bpin\b', r'\botp\b',
    r'\bseed phrase\b', r'\bprivate key\b', r'\bsocial security\b',
    r'\bbank account\b', r'\bcredit card\b', r'\bdebit card\b',
    r'\bcvv\b', r'\bssn\b', r'\bverify your account\b',
    r'\bconfirm your details\b', r'\benter your credentials\b',
    r'\bupdate your payment\b', r'\bsign in to verify\b',
    r'\bclick here to verify\b', r'\bclick here to confirm\b',
]

# ── Urgency keywords ──────────────────────────────────────────────────────────
URGENCY_KEYWORDS = [
    r'\burgent\b', r'\bact now\b', r'\bimmediately\b', r'\bwithin 24 hours\b',
    r'\bexpires today\b', r'\byour account will be (suspended|closed|terminated)\b',
    r'\blast warning\b', r'\bfinal notice\b', r'\baction required\b',
    r'\byour access will be (revoked|blocked)\b', r'\bdo not ignore\b',
]

# ── Lottery / prize keywords ──────────────────────────────────────────────────
LOTTERY_KEYWORDS = [
    r'\bcongratulations\b', r'\byou have won\b', r'\byou are a winner\b',
    r'\bprize\b', r'\blottery\b', r'\bgift card\b', r'\bfree money\b',
    r'\bclaim (your|the) prize\b', r'\bmillion dollar\b', r'\bsweepstakes\b',
]

# Threat categories
CATEGORY_PATTERNS = {
    "Credential Theft":            CREDENTIAL_KEYWORDS,
    "Lottery Scam":                LOTTERY_KEYWORDS,
    "Bank Scam":                   [r'\bbank\b', r'\bwire transfer\b', r'\bbill payment\b', r'\baccount balance\b', r'\btransaction\b'],
    "Invoice Scam":                [r'\binvoice\b', r'\bbilling\b', r'\bpayment due\b', r'\bpurchase order\b', r'\bpay now\b', r'\brefund\b'],
    "Technical Support Scam":      [r'\btech support\b', r'\bcustomer support\b', r'\bwindows defender\b', r'\bvirus detected\b', r'\bcall now\b'],
    "Delivery Scam":               [r'\byour package\b', r'\bdelivery failed\b', r'\bcustoms fee\b', r'\btrack your shipment\b'],
    "Business Email Compromise":   [r'\bwire transfer\b', r'\bchange.*payment.*details\b', r'\burgent.*transfer\b', r'\bceo\b.*\bpayment\b'],
    "Crypto Scam":                 [r'\bcrypto\b', r'\bbitcoin\b', r'\bethereum\b', r'\bnft\b', r'\bwallet\b', r'\bseed phrase\b'],
}


def _count_capital_letters(text: str) -> int:
    return sum(1 for c in text if c.isupper())


def _count_keywords(text: str, patterns: list) -> int:
    text_lower = text.lower()
    return sum(1 for p in patterns if re.search(p, text_lower, re.IGNORECASE))


def run_rule_engine(sender: str, subject: str, body: str, reply_to: str = "", attachments: list = None) -> dict:
    """
    Run deterministic phishing rules on email fields.

    Returns:
      rule_score: 0-100 composite risk score
      triggered_rules: list of dicts {rule, severity, description}
      threat_category: best matching category string
      urgency_score: 0-10
      credential_request: bool
      sender_mismatch: bool
      suspicious_keyword_count: int
      brand_detected: str
    """
    triggered = []
    score = 0
    text = f"{subject or ''} {body or ''}"
    text_lower = text.lower()
    sender_lower = (sender or "").lower()
    attachments_list = attachments or []

    def add_rule(rule: str, severity: str, description: str, points: int):
        triggered.append({"rule": rule, "severity": severity, "description": description})
        nonlocal score
        score += points

    # ── Rule 1: HTTP links (not HTTPS) ────────────────────────────────────────
    http_links = re.findall(r'http://[^\s"\'<>]+', text)
    if http_links:
        add_rule("HTTP_LINKS", "medium",
                 f"{len(http_links)} unencrypted HTTP link(s) found.", 15)

    # ── Rule 2: IP address URL ────────────────────────────────────────────────
    ip_urls = re.findall(r'https?://\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}', text)
    if ip_urls:
        add_rule("IP_ADDRESS_URL", "high",
                 f"IP-based URL detected — phishing sites often hide behind IPs.", 35)

    # ── Rule 3: Shortened URLs ────────────────────────────────────────────────
    urls = extract_urls(text)
    short_urls = [u for u in urls if any(s in u for s in SHORTENERS)]
    if short_urls:
        add_rule("SHORTENED_URLS", "medium",
                 f"{len(short_urls)} URL shortener(s) used to disguise real destination.", 20)

    # ── Rule 4: Unicode Domains / IDN Homographs ─────────────────────────────
    unicode_urls = [u for u in urls if "xn--" in u.lower() or any(ord(c) > 127 for c in u)]
    if unicode_urls:
        add_rule("UNICODE_DOMAIN", "high",
                 "Unicode/Punycode domain detected in URLs — homograph spoofing indicator.", 30)

    # ── Rule 5: Suspicious TLD ────────────────────────────────────────────────
    suspicious_tlds = [".xyz", ".tk", ".ml", ".ga", ".cf", ".gq", ".info", ".click", ".top", ".loan"]
    sender_domain = re.search(r'@([\w.\-]+)', sender_lower)
    if sender_domain:
        domain = sender_domain.group(1)
        if any(domain.endswith(tld) for tld in suspicious_tlds):
            add_rule("SUSPICIOUS_TLD", "high",
                     f"Sender domain '{domain}' uses a TLD commonly associated with phishing.", 30)

    # ── Rule 6: Credential request ────────────────────────────────────────────
    cred_hits = _count_keywords(text, CREDENTIAL_KEYWORDS)
    credential_request = cred_hits > 0
    if cred_hits >= 2:
        add_rule("CREDENTIAL_HARVEST", "critical",
                 f"Email requests sensitive credentials ({cred_hits} indicators detected).", 40)
    elif cred_hits == 1:
        add_rule("CREDENTIAL_MENTION", "high",
                 "Email mentions credential-related terms.", 20)

    # ── Rule 7: Urgency language ──────────────────────────────────────────────
    urgency_hits = _count_keywords(text, URGENCY_KEYWORDS)
    urgency_score = min(10, urgency_hits * 2)
    if urgency_hits >= 3:
        add_rule("HIGH_URGENCY", "high",
                 f"{urgency_hits} high-urgency phrases detected — classic social engineering.", 30)
    elif urgency_hits >= 1:
        add_rule("URGENCY_LANGUAGE", "medium",
                 f"{urgency_hits} urgency phrase(s) detected.", 15)

    # ── Rule 8: Lottery / prize keywords ─────────────────────────────────────
    lottery_hits = _count_keywords(text, LOTTERY_KEYWORDS)
    if lottery_hits >= 2:
        add_rule("LOTTERY_SCAM", "high",
                 "Multiple lottery/prize keywords detected.", 35)

    # ── Rule 9: Excessive capital letters ────────────────────────────────────
    caps = _count_capital_letters(text)
    cap_ratio = caps / max(len(text), 1)
    if cap_ratio > 0.25 and len(text) > 50:
        add_rule("EXCESSIVE_CAPS", "low",
                 f"{int(cap_ratio*100)}% capital letters — spam formatting pattern.", 10)

    # ── Rule 10: Too many URLs ─────────────────────────────────────────────────
    if len(urls) > 5:
        add_rule("TOO_MANY_URLS", "medium",
                 f"{len(urls)} URLs found — legitimate emails rarely have this many.", 15)

    # ── Rule 11: Reply-To / sender mismatch ───────────────────────────────────
    reply_to_email = reply_to or ""
    if not reply_to_email:
        reply_to_match = re.search(r'Reply-To:\s*(\S+)', text, re.IGNORECASE)
        if reply_to_match:
            reply_to_email = reply_to_match.group(1)

    sender_mismatch = False
    if reply_to_email:
        reply_domain_match = re.search(r'@([\w.\-]+)', reply_to_email)
        sender_dom_match = re.search(r'@([\w.\-]+)', sender_lower)
        if reply_domain_match and sender_dom_match:
            rep_dom = reply_domain_match.group(1).lower().strip()
            snd_dom = sender_dom_match.group(1).lower().strip()
            if rep_dom != snd_dom and rep_dom not in snd_dom and snd_dom not in rep_dom:
                sender_mismatch = True
                add_rule("REPLY_TO_MISMATCH", "high",
                         f"Reply-To domain '{rep_dom}' differs from sender domain '{snd_dom}'.", 30)

    # ── Rule 12: Domain lookalike (homograph) / Typosquatting ─────────────────
    if re.search(r'paypa[l1]|arnazon|rnicros0ft|go0gle|app1e|faceb00k|netf1ix', sender_lower + text_lower):
        add_rule("HOMOGRAPH_DOMAIN", "critical",
                 "Lookalike/typosquatting domain detected — character substitution.", 45)

    # ── Rule 13: Brand Impersonation check ───────────────────────────────────
    brand_keywords = {
        "paypal": "PayPal",
        "netflix": "Netflix",
        "amazon": "Amazon",
        "apple": "Apple",
        "microsoft": "Microsoft",
        "google": "Google",
        "facebook": "Facebook",
        "instagram": "Instagram",
        "chase": "Chase Bank",
        "wellsfargo": "Wells Fargo",
        "bankofamerica": "Bank of America",
        "irs": "IRS",
    }
    brand_detected = ""
    for kw, brand_name in brand_keywords.items():
        if kw in sender_lower:
            brand_detected = brand_name
            break

    from feature_engineering.extractor import _domain_mismatch
    if _domain_mismatch(sender, body):
        add_rule("BRAND_IMPERSONATION", "critical",
                 f"Sender display name mimics a known brand ({brand_detected or 'External Brand'}), but domain is not official.", 35)

    # ── Rule 14: Fake System Sender Mimicry ──────────────────────────────────
    sender_mimic_keywords = ["no-reply", "noreply", "security", "support", "billing", "admin", "service", "account", "verify"]
    sender_domain_str = sender_domain.group(1).lower() if sender_domain else ""
    is_free_provider = any(free in sender_domain_str for free in ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com", "icloud.com", "protonmail.com", "mail.com"])
    
    sender_mimics = False
    if is_free_provider:
        for kw in sender_mimic_keywords:
            if kw in sender_lower.split('@')[0]:
                sender_mimics = True
                break
    if sender_mimics:
        add_rule("FAKE_SYSTEM_SENDER", "high",
                 "System keywords (e.g. 'security', 'support') detected in email prefix of a free provider.", 30)

    # ── Rule 15: Fake payment / invoice ──────────────────────────────────────
    payment_hits = _count_keywords(text, [r'\bpay now\b', r'\binvoice\b', r'\bpayment failed\b',
                                          r'\byour payment\b', r'\brefund\b'])
    if payment_hits >= 2:
        add_rule("FAKE_PAYMENT", "high",
                 "Multiple payment/invoice-related phrases detected.", 25)

    # ── Rule 16: Attachment Risk Detections ──────────────────────────────────
    dangerous_exts = {".exe", ".scr", ".bat", ".vbs", ".js", ".lnk", ".docm", ".xlsm", ".msi", ".ps1", ".cab"}
    archive_exts = {".zip", ".rar", ".7z", ".tar", ".gz"}
    
    for att in attachments_list:
        filename = att.get("filename", "").lower()
        ext = os.path.splitext(filename)[1]
        
        if ext in dangerous_exts:
            add_rule("DANGEROUS_ATTACHMENT", "critical",
                     f"Dangerous executable or script attachment '{filename}' detected.", 45)
        elif ext in archive_exts:
            add_rule("ARCHIVE_ATTACHMENT", "medium",
                     f"Archive attachment '{filename}' detected — potential malware container.", 25)
        elif ext in {".pdf", ".docx", ".xlsx", ".html"}:
            if any(kw in filename for kw in ["invoice", "receipt", "bill", "payment", "statement", "salary"]):
                add_rule("SUSPICIOUS_DOCUMENT_ATTACHMENT", "high",
                         f"Document attachment '{filename}' contains billing or invoice terms.", 30)

    # ── Determine threat category ─────────────────────────────────────────────
    best_category = "General Phishing"
    best_count = 0
    for category, patterns in CATEGORY_PATTERNS.items():
        hits = _count_keywords(text, patterns)
        if hits > best_count:
            best_count = hits
            best_category = category

    # Calculate aggregate suspicious keyword count
    all_keyword_patterns = CREDENTIAL_KEYWORDS + URGENCY_KEYWORDS + LOTTERY_KEYWORDS + \
        [r'\bbank\b', r'\bwire transfer\b', r'\bbill payment\b', r'\baccount balance\b', r'\btransaction\b'] + \
        [r'\binvoice\b', r'\bbilling\b', r'\bpayment due\b', r'\bpurchase order\b', r'\bpay now\b', r'\brefund\b'] + \
        [r'\btech support\b', r'\bcustomer support\b', r'\bwindows defender\b', r'\bvirus detected\b', r'\bcall now\b'] + \
        [r'\byour package\b', r'\bdelivery failed\b', r'\bcustoms fee\b', r'\btrack your shipment\b'] + \
        [r'\bcrypto\b', r'\bbitcoin\b', r'\bethereum\b', r'\bnft\b', r'\bwallet\b', r'\bseed phrase\b']
    
    suspicious_keyword_count = _count_keywords(text, all_keyword_patterns)

    # Cap score at 100
    score = min(100, score)

    return {
        "rule_score":        score,
        "triggered_rules":   triggered,
        "threat_category":   best_category,
        "urgency_score":     urgency_score,
        "credential_request": credential_request,
        "sender_mismatch":   sender_mismatch,
        "url_count":         len(urls),
        "urls_analyzed":     [analyze_url(u) for u in urls[:5]],
        "suspicious_keyword_count": suspicious_keyword_count,
        "brand_detected":    brand_detected
    }
