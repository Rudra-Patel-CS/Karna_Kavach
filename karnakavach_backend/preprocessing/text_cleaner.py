import re

def clean_text(text: str) -> str:
    """
    Cleans raw email text for feature extraction.
    - Converts to lowercase
    - Removes special characters and excessive whitespace
    - Future expansion: remove HTML tags, stop words.
    """
    if not isinstance(text, str):
        return ""
    
    # Convert to lowercase
    text = text.lower()
    
    # Remove special characters, keeping only alphanumeric and spaces
    text = re.sub(r'[^a-zA-Z0-9\s]', ' ', text)
    
    # Replace multiple spaces with a single space
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text
