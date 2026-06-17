import re
from email import message_from_string
from email.policy import default
from typing import Dict, Any, List

def parse_raw_email(raw_text: str) -> Dict[str, Any]:
    """
    Intelligently parses a raw string of email content (e.g., pasted by a user) 
    and extracts structured information. Handles standard email headers if present, 
    or uses heuristic regex matching if pasted free-form from clients like Gmail.
    """
    parsed_data = {
        "from_name": "",
        "from_email": "",
        "to": "",
        "reply_to": "",
        "subject": "",
        "date": "",
        "cc": "",
        "bcc": "",
        "body": "",
        "urls": [],
        "parsed_successfully": False,
        "confidence_scores": {
            "from_name": 0.0,
            "from_email": 0.0,
            "subject": 0.0,
            "date": 0.0,
            "body": 0.0
        }
    }
    
    if not isinstance(raw_text, str) or not raw_text.strip():
        return parsed_data
    
    # Extract URLs from the raw text
    url_pattern = re.compile(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\(\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+')
    parsed_data["urls"] = list(set(re.findall(url_pattern, raw_text)))

    # Check if it looks like a standard MIME email format (contains headers)
    if re.search(r"^(From:|Subject:|Date:|To:)\s", raw_text, re.IGNORECASE | re.MULTILINE):
        msg = message_from_string(raw_text, policy=default)
        
        from_raw = msg.get("From", "")
        parsed_data["to"] = msg.get("To", "")
        parsed_data["subject"] = msg.get("Subject", "")
        if parsed_data["subject"]: parsed_data["confidence_scores"]["subject"] = 1.0
        
        parsed_data["date"] = msg.get("Date", "")
        if parsed_data["date"]: parsed_data["confidence_scores"]["date"] = 1.0
        
        parsed_data["reply_to"] = msg.get("Reply-To", "")
        parsed_data["cc"] = msg.get("Cc", "")
        parsed_data["bcc"] = msg.get("Bcc", "")
        
        name_email_match = re.match(r"(.*?)\s*<([^>]+)>", from_raw)
        if name_email_match:
            parsed_data["from_name"] = name_email_match.group(1).strip(' \'"')
            parsed_data["from_email"] = name_email_match.group(2).strip()
            parsed_data["confidence_scores"]["from_name"] = 0.99
            parsed_data["confidence_scores"]["from_email"] = 0.99
        else:
            email_only_match = re.search(r"([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})", from_raw)
            if email_only_match:
                parsed_data["from_email"] = email_only_match.group(1)
                parsed_data["confidence_scores"]["from_email"] = 0.95
            else:
                parsed_data["from_name"] = from_raw
                parsed_data["confidence_scores"]["from_name"] = 0.90

        # Extract body
        body_parts = []
        if msg.is_multipart():
            for part in msg.walk():
                content_type = part.get_content_type()
                content_disp = str(part.get('Content-Disposition'))
                if 'attachment' not in content_disp:
                    try:
                        payload = part.get_payload(decode=True)
                        if payload:
                            decoded = payload.decode(part.get_content_charset() or 'utf-8', errors='ignore')
                            if content_type == "text/plain":
                                body_parts.append(decoded)
                    except Exception:
                        pass
        else:
            try:
                payload = msg.get_payload(decode=True)
                if payload:
                    body_parts.append(payload.decode(msg.get_content_charset() or 'utf-8', errors='ignore'))
            except Exception:
                body_parts.append(msg.get_payload())
                
        parsed_data["body"] = "\n".join(body_parts) if body_parts else str(msg.get_payload() or "")
        if parsed_data["body"]: parsed_data["confidence_scores"]["body"] = 1.0
        parsed_data["parsed_successfully"] = True

    else:
        # Heuristic parsing for free-form pasted text (Gmail, Outlook, etc)
        raw_lines = raw_text.splitlines()
        
        # Interface noise from copy-pastes
        noise_patterns = [
            r'^inbox$', r'^starred$', r'^promotions$', r'^to me$', 
            r'^reply$', r'^forward$', r'^drafts$', r'^sent$', r'^spam$', 
            r'^important$', r'^trash$'
        ]
        
        cleaned_lines = []
        for line in raw_lines:
            stripped = line.strip().lower()
            if stripped and not any(re.match(p, stripped) for p in noise_patterns):
                cleaned_lines.append(line.strip())
        
        body_start_idx = 0
        from_found = False
        subject_found = False
        date_found = False
        
        for i, line in enumerate(cleaned_lines[:15]):
            email_match = re.search(r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', line)
            
            explicit_from = re.match(r"(?:From|Sender):\s*(.*)", line, re.IGNORECASE)
            explicit_subj = re.match(r"(?:Subject|Title):\s*(.*)", line, re.IGNORECASE)
            explicit_date = re.match(r"(?:Date|Sent):\s*(.*)", line, re.IGNORECASE)
            explicit_to = re.match(r"(?:To|Recipient):\s*(.*)", line, re.IGNORECASE)
            
            if explicit_from:
                from_found = True
                raw_f = explicit_from.group(1).strip()
                n_e_m = re.match(r"(.*?)\s*<([^>]+)>", raw_f)
                if n_e_m:
                    parsed_data["from_name"] = n_e_m.group(1).strip(' \'"')
                    parsed_data["from_email"] = n_e_m.group(2).strip()
                    parsed_data["confidence_scores"]["from_name"] = 0.98
                    parsed_data["confidence_scores"]["from_email"] = 0.98
                elif email_match:
                    parsed_data["from_email"] = email_match.group(1)
                    parsed_data["confidence_scores"]["from_email"] = 0.95
                else:
                    parsed_data["from_name"] = raw_f.strip()
                    parsed_data["confidence_scores"]["from_name"] = 0.90
                body_start_idx = max(body_start_idx, i + 1)
                
            elif explicit_subj:
                subject_found = True
                parsed_data["subject"] = explicit_subj.group(1).strip()
                parsed_data["confidence_scores"]["subject"] = 0.98
                body_start_idx = max(body_start_idx, i + 1)
                
            elif explicit_date:
                date_found = True
                parsed_data["date"] = explicit_date.group(1).strip()
                parsed_data["confidence_scores"]["date"] = 0.98
                body_start_idx = max(body_start_idx, i + 1)
                
            elif explicit_to:
                parsed_data["to"] = explicit_to.group(1).strip()
                body_start_idx = max(body_start_idx, i + 1)
                
            elif not from_found and email_match:
                from_found = True
                parsed_data["from_email"] = email_match.group(1)
                parsed_data["confidence_scores"]["from_email"] = 0.90
                n_e_m = re.search(r"(.*?)\s*<([^>]+)>", line)
                if n_e_m:
                    parsed_data["from_name"] = n_e_m.group(1).strip(' \'"')
                    parsed_data["confidence_scores"]["from_name"] = 0.85
                else:
                    possible_name = line.replace(email_match.group(1), '').replace('<', '').replace('>', '').strip()
                    if possible_name:
                        parsed_data["from_name"] = possible_name
                        parsed_data["confidence_scores"]["from_name"] = 0.80
                body_start_idx = max(body_start_idx, i + 1)
                
            elif not subject_found and i == 0 and not email_match:
                # Top header is commonly subject in Gmail
                if len(line.split()) < 25 and not re.match(r'^\d+$', line):
                    subject_found = True
                    parsed_data["subject"] = line.strip()
                    parsed_data["confidence_scores"]["subject"] = 0.85
                    body_start_idx = max(body_start_idx, i + 1)
                    
            elif not date_found and re.search(r'([A-Za-z]{3},\s+[A-Za-z]{3}\s+\d{1,2},.*|\d{4}-\d{2}-\d{2}|[A-Za-z]{3,10}\s+\d{1,2},\s+\d{4}|^\d{1,2}/\d{1,2}/\d{2,4})', line):
                date_found = True
                date_str = re.search(r'([A-Za-z]{3},\s+[A-Za-z]{3}\s+\d{1,2},.*|\d{4}-\d{2}-\d{2}|[A-Za-z]{3,10}\s+\d{1,2},\s+\d{4}|^\d{1,2}/\d{1,2}/\d{2,4})', line).group(1)
                parsed_data["date"] = date_str.strip()
                parsed_data["confidence_scores"]["date"] = 0.85
                body_start_idx = max(body_start_idx, i + 1)
        
        parsed_data["body"] = "\n".join(cleaned_lines[body_start_idx:]).strip()
        if parsed_data["body"]:
            parsed_data["confidence_scores"]["body"] = 0.90
            
        parsed_data["parsed_successfully"] = bool(from_found or subject_found or len(parsed_data["body"]) > 0)

    # Fallback missing data
    if not parsed_data["from_email"] and not parsed_data["subject"] and not parsed_data["body"]:
        parsed_data["body"] = raw_text
        parsed_data["confidence_scores"]["body"] = 0.50

    return parsed_data
