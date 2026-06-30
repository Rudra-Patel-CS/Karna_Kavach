export interface UrlAnalysis {
  url: string;
  classification: string;
  risk_score: number;
  reasons: string[];
}

export interface ThreatVector {
  title: string;
  description: string;
  badge: string;
  type: 'critical' | 'warning' | 'info' | 'success';
}

export interface Scan {
  id: string;
  sender: string;
  subject: string;
  body: string;
  replyTo?: string;
  attachments?: { filename: string; contentType: string; sizeBytes: number }[];
  riskScore: number;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  createdAt: string;
  summary: string;
  confidence: number;
  threatVectors: ThreatVector[];
  isSimulated?: boolean;
  urlAnalysis?: UrlAnalysis[];
  engine?: "Gemini AI" | "Machine Learning" | "Hybrid";
  // Hybrid analysis extras
  threatCategory?: string;
  scoreBreakdown?: { rule: number; ml: number; ai: number | null; weights: { rule: number; ml: number; ai: number } };
  recommendations?: string[];
  emailIntel?: Record<string, any>;
  mlResult?: { verdict: string; confidence: number; score: number; reasons: string[] };
  ruleResult?: { score: number; triggered: any[]; category: string; urgency: number };
  ruleVectors?: ThreatVector[];
  comparison?: {
    mlResult: { verdict: string; confidence: number; reasons?: string[] };
    aiResult: { verdict: string; confidence: number; summary: string } | null;
    agreement: boolean;
    reason: string;
  };
}

export interface DashboardStats {
  totalScans: number;
  threatsBlocked: number;
  avgConfidence: number;
  highRiskEmails: number;
}

export interface MLMetrics {
  version: number;
  training_date: string;
  dataset_size: number;
  n_legitimate: number;
  n_phishing: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  roc_auc: number;
  confusion_matrix: number[][];
}

export interface MLStatus {
  version: number;
  version_label: string;
  last_trained: string | null;
  dataset_size: number;
  feedback_size: number;
  feedback_stats: {
    total: number;
    correct: number;
    corrections: number;
    phishing: number;
    legitimate: number;
  };
  metrics: MLMetrics | null;
  should_auto_retrain: boolean;
  auto_retrain_threshold: number | null;
}

export interface FeedbackPayload {
  sender: string;
  subject: string;
  body: string;
  urls: string[];
  predicted_label: "Phishing" | "Legitimate";
  correct_label: "Phishing" | "Legitimate";
  confidence: number;
  label_verified: boolean;
}

// ── Firestore Feedback types ──────────────────────────────────────────────────

export type FeedbackLabel = "Phishing" | "Legitimate" | "Suspicious";

export interface FeedbackRecord {
  feedbackId: string;       // Firestore document ID
  userId: string;
  scanId: string;
  engine: "Gemini AI" | "Machine Learning" | "Hybrid";
  sender: string;
  subject: string;
  body: string;
  predictedLabel: FeedbackLabel;
  correctLabel: FeedbackLabel;
  confidence: number;
  verified: boolean;         // true = user agreed with prediction
  createdAt: string;         // ISO string (converted from Firestore Timestamp)
}

export interface FeedbackStats {
  total: number;
  correct: number;
  incorrect: number;
  estimatedAccuracy: number; // percentage 0–100
}

// ── ML Center / Model Versioning types ───────────────────────────────────────

export interface ModelVersion {
  id: string;             // Firestore document ID
  version: string;        // e.g. "v1.0.0"
  modelType: string;      // e.g. "TF-IDF + Logistic Regression"
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  rocAuc: number;
  datasetSize: number;
  feedbackCount: number;
  nLegitimate: number;
  nPhishing: number;
  confusionMatrix: number[][];
  trainedAt: string;      // ISO string
  active: boolean;
  trainingDurationMs?: number;
}

export type TrainingJobStatus = "idle" | "running" | "completed" | "failed";

export interface TrainingJob {
  status: TrainingJobStatus;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  logs: string[];
  error: string | null;
  resultVersion: ModelVersion | null;
}
