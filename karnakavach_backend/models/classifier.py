import os
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.calibration import CalibratedClassifierCV

# Define paths for saving/loading models
MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
VECTORIZER_PATH = os.path.join(MODEL_DIR, "tfidf_vectorizer.pkl")
MODEL_PATH = os.path.join(MODEL_DIR, "phishing_model.pkl")

def get_vectorizer() -> TfidfVectorizer:
    return TfidfVectorizer(
        max_features=8000,
        ngram_range=(1, 3),      # include trigrams for better phrase detection
        stop_words='english',
        sublinear_tf=True,       # dampens high-frequency word dominance
        min_df=1,                # include all tokens (small dataset)
        analyzer='word',
    )

def get_model() -> LogisticRegression:
    return LogisticRegression(
        class_weight='balanced',
        max_iter=2000,
        C=0.8,                   # slightly stronger regularisation to reduce overfitting
        solver='lbfgs',
    )

def save_artifacts(vectorizer: TfidfVectorizer, model: LogisticRegression):
    joblib.dump(vectorizer, VECTORIZER_PATH)
    joblib.dump(model, MODEL_PATH)

def load_artifacts():
    if not os.path.exists(VECTORIZER_PATH) or not os.path.exists(MODEL_PATH):
        raise FileNotFoundError("Model artifacts not found. Please train the model first.")
    vectorizer = joblib.load(VECTORIZER_PATH)
    model = joblib.load(MODEL_PATH)
    return vectorizer, model
