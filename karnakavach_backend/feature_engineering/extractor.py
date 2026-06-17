import sys
import os
import re
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from preprocessing.text_cleaner import clean_text

# Domains that are highly trusted — emails from these are almost never phishing
TRUSTED_DOMAINS = {
    "google.com", "gmail.com", "classroom.google.com", "accounts.google.com",
    "microsoft.com", "outlook.com", "office365.com", "live.com", "hotmail.com",
    "apple.com", "icloud.com",
    "amazon.com", "amazon.in",
    "paypal.com",
    "github.com", "github.io",
    "linkedin.com",
    "twitter.com", "x.com",
    "facebook.com", "instagram.com",
    "youtube.com",
    "netflix.com",
    "spotify.com",
    "dropbox.com",
    "slack.com",
    "zoom.us",
    "atlassian.com", "jira.com", "confluence.com",
    "stripe.com",
    "notion.so",
    "figma.com",
    "canva.com",
    "udemy.com", "coursera.org", "edx.org", "khanacademy.org",
    "nptel.ac.in", "swayam.gov.in", "skillindia.gov.in",
    "medium.com", "substack.com",
    "techcrunch.com", "hackernews.com",
    "stackoverflow.com",
    "wordpress.com",
    "hubspot.com",
    "zendesk.com",
    "quickbooks.com",
    "digitalocean.com",
    "aws.amazon.com",
    "forms.google.com",
    "trello.com",
    "eventbrite.com",
    "meetup.com",
    "airbnb.com", "booking.com",
    "glassdoor.com", "indeed.com", "naukri.com",
    "grammarly.com",
    "duolingo.com",
    "producthunt.com",
    "razorpay.com", "paytm.com",
    # Indian academic / institutional
    "charusat.ac.in", "charusat.edu.in", "iit.ac.in", "iim.ac.in",
    "nationalgeographic.com", "bestbuy.com",
}

# Suspicious TLDs that are cheap and commonly used in phishing
SUSPICIOUS_TLDS = {
    ".xyz", ".tk", ".ml", ".ga", ".cf", ".gq", ".info",
    ".click", ".top", ".loan", ".work", ".stream", ".download",
    ".win", ".racing", ".review", ".accountant", ".webcam",
    ".date", ".faith", ".party", ".science", ".trade", ".cricket",
}

# Phishing urgency signals in subject/body
URGENCY_PATTERNS = [
    r'\burgent\b', r'\bimmediately\b', r'\bact now\b', r'\bsuspended\b',
    r'\blocked\b', r'\bverify now\b', r'\bexpire[sd]?\b', r'\bdeactivat',
    r'\bunauthorized\b', r'\bsuspicious activity\b', r'\bsecurity breach\b',
    r'\byour account will be\b', r'\brestore access\b', r'\bclaim your prize\b',
    r'\bcongratulations you (have been|are) (selected|winner)\b',
    r'\bprovide your (bank|credit card|password|seed phrase)\b',
    r'\benter your (credentials|password|details)\b',
]


def _extract_sender_domain(sender: str) -> str:
    """Extract just the domain part from a sender string."""
    email_match = re.search(r'@([\w.\-]+)', sender or "")
    if email_match:
        return email_match.group(1).lower()
    return ""


def _is_trusted_domain(domain: str) -> bool:
    """Check if a domain matches any trusted domain exactly or as subdomain."""
    domain = domain.lower().strip()
    for trusted in TRUSTED_DOMAINS:
        if domain == trusted or domain.endswith("." + trusted):
            return True
    return False


def _has_suspicious_tld(domain: str) -> bool:
    """Check if the domain uses a suspicious TLD."""
    for tld in SUSPICIOUS_TLDS:
        if domain.endswith(tld):
            return True
    return False


def _count_urgency_signals(text: str) -> int:
    """Count how many urgency/threat patterns are in the text."""
    text_lower = text.lower()
    count = 0
    for pattern in URGENCY_PATTERNS:
        if re.search(pattern, text_lower):
            count += 1
    return count


def _domain_mismatch(sender: str, body: str) -> bool:
    """
    Detect domain mismatch: sender claims to be a known brand but
    the actual sending domain is different.
    e.g. display name says 'PayPal' but email is paypal-secure.net
    """
    brand_keywords = {
        "paypal": "paypal.com",
        "netflix": "netflix.com",
        "amazon": "amazon.com",
        "apple": "apple.com",
        "microsoft": "microsoft.com",
        "google": "google.com",
        "facebook": "facebook.com",
        "instagram": "instagram.com",
        "chase": "chase.com",
        "wellsfargo": "wellsfargo.com",
        "bankofamerica": "bankofamerica.com",
        "irs": "irs.gov",
    }
    sender_lower = (sender or "").lower()
    domain = _extract_sender_domain(sender)
    for brand, official_domain in brand_keywords.items():
        # If brand name appears in the display name but domain is NOT the official one
        if brand in sender_lower and not domain.endswith(official_domain):
            return True
    return False


def extract_features(sender: str, subject: str, body: str) -> str:
    """
    Combines sender, subject, and body into a single structured feature string.
    Injects synthetic tokens that represent structural and trust-level signals
    so the TF-IDF model can learn from metadata, not just raw word frequency.
    """
    domain = _extract_sender_domain(sender)
    combined_raw = f"{subject or ''} {body or ''}"

    # --- Structural signal tokens (injected as pseudo-words) ---
    signal_tokens = []

    # Trust domain signal
    if domain and _is_trusted_domain(domain):
        # Inject trust token multiple times to give it strong weight
        signal_tokens.extend(["TRUSTED_DOMAIN"] * 4)
    elif domain and _has_suspicious_tld(domain):
        signal_tokens.extend(["SUSPICIOUS_TLD"] * 4)

    # Domain mismatch (brand impersonation)
    if _domain_mismatch(sender, body):
        signal_tokens.extend(["BRAND_IMPERSONATION"] * 5)

    # Urgency / threat signals
    urgency_count = _count_urgency_signals(combined_raw)
    if urgency_count >= 3:
        signal_tokens.extend(["HIGH_URGENCY"] * 4)
    elif urgency_count >= 1:
        signal_tokens.extend(["LOW_URGENCY"] * 2)

    # Numeric TLDs / hyphens in domain (phishing pattern)
    if domain and (re.search(r'\d', domain) or domain.count('-') >= 2):
        signal_tokens.extend(["NUMERIC_HYPHEN_DOMAIN"] * 3)

    # Legitimate institutional context (gov, edu, ac.in domains)
    if domain and (
        domain.endswith(".edu") or domain.endswith(".gov") or
        domain.endswith(".ac.in") or domain.endswith(".edu.in") or
        domain.endswith(".gov.in") or domain.endswith(".org")
    ):
        signal_tokens.extend(["INSTITUTIONAL_DOMAIN"] * 3)

    # Google Forms / known registration links — legitimate
    if "forms.gle" in (body or "") or "forms.google.com" in (body or ""):
        signal_tokens.extend(["GOOGLE_FORMS_LINK"] * 3)

    # Clean text for TF-IDF
    cleaned_subject = clean_text(subject)
    cleaned_body = clean_text(body)

    # Build final feature string:
    # Subject is repeated to give it extra weight over body
    combined_text = (
        " ".join(signal_tokens) + " " +
        cleaned_subject + " " + cleaned_subject + " " +
        cleaned_body
    )

    return combined_text.strip()
