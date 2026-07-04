# 🛡️ KarnaKavach

**AI & Machine Learning Based Phishing Email and Malicious URL Detection Platform**

KarnaKavach is an intelligent cybersecurity platform designed to detect phishing emails and malicious URLs using a hybrid approach that combines Rule-Based Detection, Machine Learning, and Google Gemini AI. The application provides detailed threat analysis, secure authentication, scan history, user feedback, and a retraining pipeline to continuously improve the machine learning model.

---

# ✨ Features

- 📧 Phishing Email Analysis
- 🔗 Malicious URL Detection
- 🤖 Google Gemini AI Analysis
- 🧠 Machine Learning Prediction (TF-IDF + Logistic Regression)
- 🛡️ Hybrid Threat Detection
- 📊 Interactive Dashboard
- 🔐 Firebase Authentication (Email, Google & GitHub)
- ☁️ Firebase Firestore Database
- 📝 Scan History
- 👍 User Feedback System
- 🔄 Machine Learning Retraining Pipeline
- 📄 Security Report Generation
- 📱 Responsive User Interface

---

# 🏗️ Technology Stack

| Category | Technologies |
|----------|--------------|
| Frontend | React.js, TypeScript, Vite, Tailwind CSS |
| Backend | Python, Node.js |
| Machine Learning | Scikit-learn, TF-IDF, Logistic Regression |
| Artificial Intelligence | Google Gemini API |
| Database | Firebase Firestore |
| Authentication | Firebase Authentication |
| Deployment | Vercel |
| Development Tools | Git, GitHub, VS Code |

---

# 📂 Project Structure

```text
KarnaKavach/
│
├── src/
│   ├── components/
│   ├── services/
│   ├── hooks/
│   ├── types/
│   ├── utils/
│   └── assets/
│
├── karnakavach_backend/
│   ├── preprocessing/
│   ├── feature_engineering/
│   ├── inference/
│   ├── models/
│   ├── training/
│   └── main.py
│
├── public/
├── README.md
└── package.json
```

---

# 🚀 How It Works

1. User logs in using Firebase Authentication.
2. User submits an email or URL for analysis.
3. The system validates and preprocesses the input.
4. Features are extracted from the content.
5. Rule-Based Detection performs security checks.
6. Machine Learning predicts phishing probability.
7. Google Gemini AI analyzes the context.
8. Results are combined into a hybrid risk assessment.
9. Final analysis is displayed to the user.
10. Scan history and feedback are stored in Firestore.
11. User feedback can be used to retrain the ML model.

---

# 🧠 Machine Learning

The ML engine uses:

- TF-IDF Vectorizer
- Logistic Regression Classifier
- Feedback-based Retraining Pipeline
- Model Versioning
- Performance Metrics

---

# 🤖 Artificial Intelligence

Google Gemini API provides:

- Context-aware phishing analysis
- Threat explanation
- Risk reasoning
- Security recommendations

---

# 🔥 Firebase Services

- Firebase Authentication
- Cloud Firestore
- User Profiles
- Scan History
- Feedback Collection
- User Settings

---

# ⚙️ Installation

## Clone Repository

```bash
git clone https://github.com/Rudra-Patel-CS/Karna_Kavach.git
cd Karna_Kavach
```

## Install Frontend Dependencies

```bash
npm install
```

## Configure Environment Variables

Create a `.env.local` file and add the required Firebase and Gemini API credentials.

Example:

```env
VITE_FIREBASE_API_KEY=YOUR_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=YOUR_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
VITE_GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

## Run Frontend

```bash
npm run dev
```

---

# 🐍 Python Backend

Go to the backend directory:

```bash
cd karnakavach_backend
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run the backend:

```bash
python main.py
```

---

# 📊 Main Modules

- Authentication
- Dashboard
- Email Analyzer
- URL Analyzer
- AI Engine
- Machine Learning Engine
- History
- Feedback
- Settings
- Retraining Pipeline

---

# 🎯 Future Scope

- Browser Extension
- Gmail Add-on
- Outlook Plugin
- Threat Intelligence APIs
- VirusTotal Integration
- Google Safe Browsing
- Real-Time Email Monitoring

---

# 👨‍💻 Author

**Rudra Patel**

Computer Science Engineering Student

GitHub:
https://github.com/Rudra-Patel-CS

---

# 📜 License

This project is developed for educational and academic purposes.
