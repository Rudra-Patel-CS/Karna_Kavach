# Karnakavach Backend Guide

This directory contains the Python ML backend for **KarnaKavach**.

## Project Architecture

- `preprocessing/`: Text cleaning and parsing
- `feature_engineering/`: Feature extraction and combination pipelines
- `models/`: TF-IDF Vectorizer and LogisticRegression classifier
- `training/`: The training pipeline script
- `inference/`: Prediction functions using the trained models
- `main.py`: The FastAPI application

## Recommended Datasets

For academic and personal projects, these public datasets are highly recommended:
1. **Phishing Email Dataset on Kaggle (by Nazario / Subhajournal)**: A great, balanced dataset containing labeled phishing and legitimate emails.
2. **Enron Email Dataset**: Pure legitimate emails (often used for the 'ham' class).
3. **SpamAssassin Public Corpus**: Classic dataset with hard ham, easy ham, and spam/phishing labels.

*Note: Ensure your dataset is a CSV with columns: `subject`, `body`, and `label` (where 0=Legitimate, 1=Phishing). An optional `sender` column is parsed if available.*

## How to use

### 1. Install dependencies
```bash
cd karnakavach_backend
pip install -r requirements.txt
```

### 2. Train the Model
First, place your dataset (e.g. `dataset.csv`) inside this directory or somewhere accessible.
```bash
python training/train.py --dataset path/to/your/dataset.csv
```
This will train the Logistic Regression model, evaluate it, and save the pickle artifacts `tfidf_vectorizer.pkl` and `phishing_model.pkl` in the `models/` directory.

### 3. Start the API Server
```bash
# Starts the server on http://0.0.0.0:8000
python main.py
# Or via uvicorn directly
uvicorn main:app --reload
```

### 4. Test the API Endpoints
Endpoints available:
- **`GET /`** : Health check
- **`POST /predict`** : Run an email through the model

Example cURL request:
```bash
curl -X 'POST' \
  'http://localhost:8000/predict' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "sender": "admin@paypal-security.com",
  "subject": "URGENT: Your account will be locked",
  "body": "Dear user, please click the link below to verify your identity immediately."
}'
```

The response includes:
- `prediction`: Phishing/Legitimate
- `confidence_score`
- Explanations based on influential words isolated by TF-IDF coefficients.
