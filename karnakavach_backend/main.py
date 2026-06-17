from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from inference.predict import predict_email
from preprocessing.email_parser import parse_raw_email
import logging

# Setup basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="KarnaKavach Phishing Detection API",
    description="API for detecting phishing emails using Machine Learning",
    version="1.0.0"
)

# Pydantic schema for the request
class EmailRequest(BaseModel):
    sender: str
    subject: str
    body: str

# Schema for raw pasted email request
class RawEmailRequest(BaseModel):
    raw_text: str

# Schema for url analysis
class UrlAnalysis(BaseModel):
    url: str
    classification: str
    risk_score: int
    reasons: List[str]

# Pydantic schema for the prediction response
class PredictionResponse(BaseModel):
    prediction: str
    confidence_score: float
    probability_phishing: float
    probability_legitimate: float
    explanation: str
    url_analysis: List[UrlAnalysis] = []

# Schema for parsing response
class ParseEmailResponse(BaseModel):
    from_name: str
    from_email: str
    to: str
    reply_to: str
    subject: str
    date: str
    cc: str
    bcc: str
    body: str
    urls: List[str]
    parsed_successfully: bool
    confidence_scores: dict

@app.get("/")
def read_root():
    return {"message": "KarnaKavach API is running. Use /predict to scan emails."}

@app.post("/parse_email", response_model=ParseEmailResponse)
def parse_email(req: RawEmailRequest):
    try:
        parsed_data = parse_raw_email(req.raw_text)
        return ParseEmailResponse(
            from_name=parsed_data.get("from_name", ""),
            from_email=parsed_data.get("from_email", ""),
            to=parsed_data.get("to", ""),
            reply_to=parsed_data.get("reply_to", ""),
            subject=parsed_data.get("subject", ""),
            date=parsed_data.get("date", ""),
            cc=parsed_data.get("cc", ""),
            bcc=parsed_data.get("bcc", ""),
            body=parsed_data.get("body", ""),
            urls=parsed_data.get("urls", []),
            parsed_successfully=parsed_data.get("parsed_successfully", False),
            confidence_scores=parsed_data.get("confidence_scores", {})
        )
    except Exception as e:
        logger.error(f"Email parsing error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during parsing.")

@app.post("/predict", response_model=PredictionResponse)
def predict(email: EmailRequest):
    try:
        # Call the inference module
        result = predict_email(email.sender, email.subject, email.body)
        return PredictionResponse(**result)
    except RuntimeError as e:
        # e.g., model not trained yet
        logger.error(f"Runtime error: {str(e)}")
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Prediction error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during prediction.")

if __name__ == "__main__":
    import uvicorn
    # Make sure to run this via 'uvicorn main:app --reload'
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
