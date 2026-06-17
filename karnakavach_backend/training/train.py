import os
import sys
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix

# Add parent directory to path so we can import internal modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.classifier import get_vectorizer, get_model, save_artifacts
from feature_engineering.extractor import extract_features

def train_pipeline(csv_path: str):
    """
    Complete pipeline to load data, preprocess, train, evaluate, and save models.
    Expects CSV with columns: 'sender', 'subject', 'body', 'label' (0=Legitimate, 1=Phishing)
    """
    print(f"Loading dataset from {csv_path}...")
    try:
        df = pd.read_csv(csv_path)
    except Exception as e:
        print(f"Error loading CSV: {e}")
        return
        
    # Check necessary columns
    required_cols = ['subject', 'body', 'label']
    for col in required_cols:
        if col not in df.columns:
            raise ValueError(f"Missing required column: {col}. Ensure your dataset uses these column names.")
    
    # Handle missing sender if it's not present
    if 'sender' not in df.columns:
        df['sender'] = ''
        
    df.fillna('', inplace=True)
    
    print("Extracting features...")
    # Apply feature extraction
    df['combined_text'] = df.apply(lambda row: extract_features(row['sender'], row['subject'], row['body']), axis=1)
    
    X = df['combined_text']
    y = df['label']
    
    print("Splitting dataset...")
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    print("Vectorizing text...")
    vectorizer = get_vectorizer()
    X_train_vec = vectorizer.fit_transform(X_train)
    X_test_vec = vectorizer.transform(X_test)
    
    print("Training Logistic Regression model...")
    model = get_model()
    model.fit(X_train_vec, y_train)
    
    print("Evaluating model...")
    y_pred = model.predict(X_test_vec)
    y_prob = model.predict_proba(X_test_vec)[:, 1]
    
    # Metrics
    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred)
    rec = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_prob)
    cm = confusion_matrix(y_test, y_pred)
    
    print(f"--- Evaluation Metrics ---")
    print(f"Accuracy:  {acc:.4f}")
    print(f"Precision: {prec:.4f}")
    print(f"Recall:    {rec:.4f}")
    print(f"F1-score:  {f1:.4f}")
    print(f"ROC-AUC:   {auc:.4f}")
    print(f"Confusion Matrix:\n{cm}")
    
    print("Saving model artifacts...")
    save_artifacts(vectorizer, model)
    print("Training complete! Model is ready for inference.")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Train the KarnaKavach Phishing Detection Model")
    parser.add_argument("--dataset", type=str, required=True, help="Path to the training CSV file")
    args = parser.parse_args()
    
    train_pipeline(args.dataset)
