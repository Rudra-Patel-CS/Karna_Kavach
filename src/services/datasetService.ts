/**
 * KarnaKavach — Dataset Management Service
 *
 * Prepares, validates, deduplicates, analyzes, and exports training data
 * from the Firestore `feedback` collection.
 */

import {
  collection,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db, isDummy } from "../firebase";
import type { FeedbackRecord } from "../types";

// ── Realistic Mock Dataset for Offline/Simulation Mode ────────────────────────
const MOCK_FEEDBACK_DATA: Omit<FeedbackRecord, "feedbackId">[] = [
  {
    userId: "agent_demo_user",
    scanId: "scan_mock_1",
    engine: "Gemini AI",
    sender: "billing@amazon-security.support",
    subject: "Urgent: Update your payment details within 24 hours",
    body: "We detected unauthorized access attempts on your Amazon account. Please confirm your billing address and credit card details immediately by visiting: http://amazon-payment-verification.sec-login.link",
    predictedLabel: "Phishing",
    correctLabel: "Phishing",
    confidence: 96.5,
    verified: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 hrs ago
  },
  {
    userId: "agent_demo_user",
    scanId: "scan_mock_2_a",
    engine: "Machine Learning",
    sender: "security@paypal-alert.com",
    subject: "Your account is temporarily suspended",
    body: "Dear Customer, we noticed unusual login activity on your PayPal account. Click here to verify your identity: http://paypal-identity-check.security-update.com",
    predictedLabel: "Phishing",
    correctLabel: "Phishing",
    confidence: 85.0,
    verified: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), // 12 hrs ago (Older duplicate)
  },
  {
    userId: "agent_demo_user",
    scanId: "scan_mock_2_b",
    engine: "Machine Learning",
    sender: "security@paypal-alert.com",
    subject: "Your account is temporarily suspended",
    body: "Dear Customer, we noticed unusual login activity on your PayPal account. Click here to verify your identity: http://paypal-identity-check.security-update.com",
    predictedLabel: "Phishing",
    correctLabel: "Phishing",
    confidence: 88.0,
    verified: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hrs ago (Newer duplicate)
  },
  {
    userId: "agent_demo_user",
    scanId: "scan_mock_3",
    engine: "Gemini AI",
    sender: "support@github.com",
    subject: "[GitHub] Security Alert: New SSH key added to your account",
    body: "The following SSH key was recently added to your account: sha256:abcd1234efgh5678. If this was you, no action is needed. If this wasn't you, please visit security settings.",
    predictedLabel: "Legitimate",
    correctLabel: "Legitimate",
    confidence: 99.1,
    verified: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
  },
  {
    userId: "agent_demo_user",
    scanId: "scan_mock_4",
    engine: "Machine Learning",
    sender: "newsletter@crypto-weekly-bonus.info",
    subject: "Get 500 Free tokens instantly! Limited time offer!",
    body: "Congratulations! You have been selected to claim 500 free tokens. Join our community and connect your wallet: http://claim-tokens.crypto-rewards.info",
    predictedLabel: "Phishing",
    correctLabel: "Suspicious",
    confidence: 72.4,
    verified: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
  },
  {
    userId: "agent_demo_user",
    scanId: "scan_mock_5",
    engine: "Gemini AI",
    sender: "hr@karnakavach-internal.ai",
    subject: "Mandatory Cybersecurity Training Q3",
    body: "Please ensure you complete the Q3 security training by July 15. The training module is available in your workspace portal under training tab.",
    predictedLabel: "Legitimate",
    correctLabel: "Legitimate",
    confidence: 98.4,
    verified: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), // 6 hours ago
  },
  {
    userId: "agent_demo_user",
    scanId: "scan_mock_6",
    engine: "Machine Learning",
    sender: "refunds@tax-returns-portal.gov.in",
    subject: "Tax Refund Voucher Ready - Claim Online",
    body: "Income tax department has approved your refund voucher. Click here to credit it to your bank: http://it-refunds-dept.gov-portal-login.in",
    predictedLabel: "Phishing",
    correctLabel: "Phishing",
    confidence: 92.1,
    verified: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(), // 3 days ago
  },
  {
    userId: "agent_demo_user",
    scanId: "scan_mock_7",
    engine: "Gemini AI",
    sender: "admin@karnakavach.ai",
    subject: "Scheduled system maintenance this Saturday",
    body: "All systems will be offline from 02:00 to 04:00 UTC on Saturday for scheduled security updates. Please save your work prior to this window.",
    predictedLabel: "Legitimate",
    correctLabel: "Legitimate",
    confidence: 99.9,
    verified: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
  },
  {
    userId: "agent_demo_user",
    scanId: "scan_mock_8",
    engine: "Machine Learning",
    sender: "promotions@mega-shopping-deal.xyz",
    subject: "You won a $1000 Walmart Gift Card!",
    body: "You have been selected! Claim your Walmart gift card now by completing this quick customer questionnaire: http://survey-rewards.mega-shopping-deal.xyz",
    predictedLabel: "Phishing",
    correctLabel: "Phishing",
    confidence: 81.3,
    verified: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
  },
  {
    userId: "agent_demo_user",
    scanId: "scan_mock_9",
    engine: "Gemini AI",
    sender: "services@slack.com",
    subject: "New login detected on Slack web client",
    body: "A new login was detected on Slack web client for your organization. Device: Windows 11 Chrome. IP: 192.168.1.55. If this was you, please ignore.",
    predictedLabel: "Legitimate",
    correctLabel: "Legitimate",
    confidence: 96.2,
    verified: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
  },
  {
    userId: "agent_demo_user",
    scanId: "scan_mock_10",
    engine: "Machine Learning",
    sender: "alerts@google-security-verify.com",
    subject: "Critical Alert: Someone has your password",
    body: "Google blocked a suspicious sign-in attempt on your account. Please change your password immediately to secure your files: http://google.security-account-recovery.net",
    predictedLabel: "Phishing",
    correctLabel: "Phishing",
    confidence: 95.5,
    verified: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
  },
  {
    userId: "agent_demo_user",
    scanId: "scan_mock_11",
    engine: "Gemini AI",
    sender: "no-reply@medium.com",
    subject: "Your daily read: 5 stories about AI security",
    body: "Here are the top picks for you on Medium today, including 'How Agentic AI changes coding interfaces' and 'Security analysis of neural models'.",
    predictedLabel: "Legitimate",
    correctLabel: "Legitimate",
    confidence: 98.0,
    verified: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
  },
  {
    userId: "agent_demo_user",
    scanId: "scan_mock_12",
    engine: "Machine Learning",
    sender: "hiring@tech-talents-hr.com",
    subject: "Job Offer: Remote Cybersecurity Consultant",
    body: "Hi Agent, your profile was recommended to us. We have an exciting remote consultant role available. Please review details: http://hr-attachments-portal.com/job_desc.pdf",
    predictedLabel: "Legitimate",
    correctLabel: "Suspicious",
    confidence: 74.0,
    verified: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 15).toISOString(),
  },
  {
    userId: "agent_demo_user",
    scanId: "scan_mock_13",
    engine: "Gemini AI",
    sender: "support@netflix-renewals.co",
    subject: "Update payment details: Subscription suspended",
    body: "We were unable to process your monthly subscription payment. Please update your payment details here: http://netflix-billing-renew.co/update",
    predictedLabel: "Phishing",
    correctLabel: "Phishing",
    confidence: 89.6,
    verified: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 150).toISOString(),
  },
  {
    userId: "agent_demo_user",
    scanId: "scan_mock_14",
    engine: "Machine Learning",
    sender: "shipping@dhl-tracking-express.com",
    subject: "Your package couldn't be delivered",
    body: "DHL Express Courier was unable to deliver your package because the home address was incomplete. Update details and pay delivery fee: http://dhl-address-resolution.com",
    predictedLabel: "Phishing",
    correctLabel: "Phishing",
    confidence: 91.2,
    verified: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 110).toISOString(),
  },
  {
    userId: "agent_demo_user",
    scanId: "scan_mock_15",
    engine: "Gemini AI",
    sender: "noreply@jira-server.local",
    subject: "[Jira] Task assigned: Audit user access tokens",
    body: "Jira-2849 has been assigned to you. Description: Audit active sessions, OAuth consents and API key permissions in the production database.",
    predictedLabel: "Legitimate",
    correctLabel: "Legitimate",
    confidence: 97.5,
    verified: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
  },
  {
    userId: "agent_demo_user",
    scanId: "scan_mock_16",
    engine: "Machine Learning",
    sender: "contact@linkedin-connections.com",
    subject: "John Doe wants to connect on LinkedIn",
    body: "John Doe, Principal Architect at CyberDefense, has invited you to connect on LinkedIn. View invitation and respond.",
    predictedLabel: "Legitimate",
    correctLabel: "Legitimate",
    confidence: 94.8,
    verified: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
  },
  {
    userId: "agent_demo_user",
    scanId: "scan_mock_17",
    engine: "Gemini AI",
    sender: "finance@karnakavach.ai",
    subject: "Updated travel expense policy document",
    body: "All employees traveling on business are required to adhere to the revised travel reimbursement caps detailed in this PDF memo.",
    predictedLabel: "Legitimate",
    correctLabel: "Legitimate",
    confidence: 99.5,
    verified: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 200).toISOString(),
  },
  {
    userId: "agent_demo_user",
    scanId: "scan_mock_18",
    engine: "Machine Learning",
    sender: "spammer@junk-marketing-clicks.online",
    subject: "Increase your SEO rankings by 500% now!",
    body: "Hello! We specialize in driving organic traffic to web portals. Contact us for bulk advertising packages at low cost.",
    predictedLabel: "Phishing",
    correctLabel: "Legitimate",
    confidence: 61.2,
    verified: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 180).toISOString(),
  },
  // ── Invalid samples for filtering verification ──
  {
    userId: "agent_demo_user",
    scanId: "scan_mock_inv_1",
    engine: "Gemini AI",
    sender: "", // Empty sender
    subject: "Notification: Disk quota exceeded",
    body: "Your storage is 95% full. Free up space.",
    predictedLabel: "Legitimate",
    correctLabel: "Legitimate",
    confidence: 90.0,
    verified: true,
    createdAt: new Date().toISOString(),
  },
  {
    userId: "agent_demo_user",
    scanId: "scan_mock_inv_2",
    engine: "Machine Learning",
    sender: "alerts@system-monitor.net",
    subject: "", // Empty subject
    body: "Service daemon crashed at 12:44:09",
    predictedLabel: "Legitimate",
    correctLabel: "Legitimate",
    confidence: 85.0,
    verified: true,
    createdAt: new Date().toISOString(),
  },
  {
    userId: "agent_demo_user",
    scanId: "scan_mock_inv_3",
    engine: "Gemini AI",
    sender: "support@service.com",
    subject: "Help ticket #9422",
    body: "", // Empty body
    predictedLabel: "Legitimate",
    correctLabel: "Legitimate",
    confidence: 90.0,
    verified: true,
    createdAt: new Date().toISOString(),
  },
  {
    userId: "agent_demo_user",
    scanId: "scan_mock_inv_4",
    engine: "Gemini AI",
    sender: "support@service.com",
    subject: "Help ticket #9423",
    body: "My application keeps failing.",
    predictedLabel: undefined as any, // Missing predictedLabel
    correctLabel: "Legitimate",
    confidence: 90.0,
    verified: true,
    createdAt: new Date().toISOString(),
  },
  {
    userId: "agent_demo_user",
    scanId: "scan_mock_inv_5",
    engine: "Gemini AI",
    sender: "support@service.com",
    subject: "Help ticket #9424",
    body: "Database backup log file.",
    predictedLabel: "Legitimate",
    correctLabel: undefined as any, // Missing correctLabel
    confidence: 90.0,
    verified: true,
    createdAt: new Date().toISOString(),
  },
];

const LOCAL_FEEDBACK_KEY = "karnakavach_feedback_local";

// ── getDataset ────────────────────────────────────────────────────────────────
/**
 * Reads all feedback records from the Firestore `feedback` collection.
 * In offline fallback mode, retrieves mock data and caches it in localStorage.
 */
export async function getDataset(): Promise<FeedbackRecord[]> {
  if (isDummy || !db) {
    // Offline simulation mode
    try {
      const stored = localStorage.getItem(LOCAL_FEEDBACK_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
      
      // Pre-populate if empty
      const initialList: FeedbackRecord[] = MOCK_FEEDBACK_DATA.map((item, index) => ({
        ...item,
        feedbackId: `mock_${index + 1}`,
      }));
      localStorage.setItem(LOCAL_FEEDBACK_KEY, JSON.stringify(initialList));
      return initialList;
    } catch {
      return [];
    }
  }

  try {
    const snap = await getDocs(collection(db, "feedback"));
    const records: FeedbackRecord[] = [];

    snap.forEach((docSnap) => {
      const d = docSnap.data();
      let createdAt = new Date().toISOString();
      
      if (d.createdAt instanceof Timestamp) {
        createdAt = d.createdAt.toDate().toISOString();
      } else if (d.createdAt && typeof d.createdAt === 'object' && 'seconds' in d.createdAt) {
        createdAt = new Date((d.createdAt as any).seconds * 1000).toISOString();
      } else if (d.createdAt) {
        createdAt = new Date(d.createdAt).toISOString();
      }

      records.push({
        feedbackId:     docSnap.id,
        userId:         d.userId || "",
        scanId:         d.scanId || "",
        engine:         d.engine || "Gemini AI",
        sender:         d.sender || "",
        subject:        d.subject || "",
        body:           d.body || "",
        predictedLabel: d.predictedLabel || "",
        correctLabel:   d.correctLabel || "",
        confidence:     d.confidence ?? 0,
        verified:       d.verified ?? false,
        createdAt,
      });
    });

    return records;
  } catch (err: any) {
    console.error("[DatasetService] Failed to load Firestore dataset:", err?.message);
    throw err;
  }
}

// ── validateDataset ───────────────────────────────────────────────────────────
/**
 * Filters the feedback collection into valid and invalid groups.
 * Rejects records that have:
 * - Empty sender
 * - Empty subject
 * - Empty body
 * - Missing correctLabel
 * - Missing predictedLabel
 */
export function validateDataset(records: FeedbackRecord[]): {
  valid: FeedbackRecord[];
  invalid: FeedbackRecord[];
} {
  const valid: FeedbackRecord[] = [];
  const invalid: FeedbackRecord[] = [];

  records.forEach((r) => {
    const hasEmptySender = !r.sender || String(r.sender).trim() === "";
    const hasEmptySubject = !r.subject || String(r.subject).trim() === "";
    const hasEmptyBody = !r.body || String(r.body).trim() === "";
    const hasMissingPredicted = !r.predictedLabel || String(r.predictedLabel).trim() === "";
    const hasMissingCorrect = !r.correctLabel || String(r.correctLabel).trim() === "";

    if (hasEmptySender || hasEmptySubject || hasEmptyBody || hasMissingPredicted || hasMissingCorrect) {
      invalid.push(r);
    } else {
      valid.push(r);
    }
  });

  return { valid, invalid };
}

// ── removeDuplicates ──────────────────────────────────────────────────────────
/**
 * Detects and removes duplicate feedback using: sender + subject + body.
 * Keeps only the newest record (by createdAt date).
 */
export function removeDuplicates(records: FeedbackRecord[]): {
  cleanRecords: FeedbackRecord[];
  duplicatesRemoved: number;
} {
  const groups: Record<string, FeedbackRecord[]> = {};

  records.forEach((r) => {
    // Exact match key by trimming sender, subject and body
    const key = `${r.sender.trim()}|||${r.subject.trim()}|||${r.body.trim()}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(r);
  });

  const cleanRecords: FeedbackRecord[] = [];
  let duplicatesRemoved = 0;

  Object.values(groups).forEach((group) => {
    // Sort descending by createdAt time so the newest is first
    group.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // Keep the first (newest) record
    cleanRecords.push(group[0]);
    
    // Add the rest to duplicates count
    duplicatesRemoved += group.length - 1;
  });

  // Sort final output by date descending as well
  cleanRecords.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return { cleanRecords, duplicatesRemoved };
}

// ── calculateDatasetStatistics ────────────────────────────────────────────────
export interface DatasetStatistics {
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  duplicatesRemoved: number;
  uniqueEmails: number;
  phishingSamples: number;
  legitimateSamples: number;
  suspiciousSamples: number;
  aiFeedbackCount: number;
  mlFeedbackCount: number;
  latestFeedbackDate: string | null;
}

/**
 * Calculates dataset aggregated stats based on processed lists.
 */
export function calculateDatasetStatistics(
  allRecords: FeedbackRecord[],
  cleanRecords: FeedbackRecord[],
  invalidRecords: FeedbackRecord[],
  duplicatesRemovedCount: number
): DatasetStatistics {
  const uniqueEmailsSet = new Set(cleanRecords.map((r) => r.sender.trim().toLowerCase()));
  
  let phishingSamples = 0;
  let legitimateSamples = 0;
  let suspiciousSamples = 0;
  let aiFeedbackCount = 0;
  let mlFeedbackCount = 0;

  cleanRecords.forEach((r) => {
    if (r.correctLabel === "Phishing") phishingSamples++;
    else if (r.correctLabel === "Legitimate") legitimateSamples++;
    else if (r.correctLabel === "Suspicious") suspiciousSamples++;

    if (r.engine === "Gemini AI") aiFeedbackCount++;
    else if (r.engine === "Machine Learning") mlFeedbackCount++;
  });

  // Latest date from clean records (or all records if clean is empty)
  let latestFeedbackDate: string | null = null;
  if (allRecords.length > 0) {
    const dates = allRecords
      .map((r) => new Date(r.createdAt).getTime())
      .filter((t) => !isNaN(t));
    if (dates.length > 0) {
      latestFeedbackDate = new Date(Math.max(...dates)).toISOString();
    }
  }

  return {
    totalRecords: allRecords.length,
    validRecords: allRecords.length - invalidRecords.length,
    invalidRecords: invalidRecords.length,
    duplicatesRemoved: duplicatesRemovedCount,
    uniqueEmails: uniqueEmailsSet.size,
    phishingSamples,
    legitimateSamples,
    suspiciousSamples,
    aiFeedbackCount,
    mlFeedbackCount,
    latestFeedbackDate,
  };
}

// ── exportDatasetCSV ──────────────────────────────────────────────────────────
function escapeCsvField(value: any): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Formats clean training records to CSV and triggers a browser download.
 * File Name: feedback_dataset.csv
 */
export function exportDatasetCSV(cleanRecords: FeedbackRecord[]): void {
  const headers = [
    "sender",
    "subject",
    "body",
    "predictedLabel",
    "correctLabel",
    "confidence",
    "engine",
    "createdAt",
  ];

  const rows = cleanRecords.map((r) => [
    r.sender,
    r.subject,
    r.body,
    r.predictedLabel,
    r.correctLabel,
    r.confidence,
    r.engine,
    r.createdAt,
  ].map(escapeCsvField).join(","));

  const csvContent = [headers.join(","), ...rows].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "feedback_dataset.csv";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
