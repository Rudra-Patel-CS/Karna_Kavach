# Security Specification: Vigilance AI

This document establishes the security invariants, threat vectors (the "Dirty Dozen" payloads), and rules definitions to harden the Firestore instance for Vigilance AI's email phishing assessment logs.

## 1. Data Invariants

1. **User Ownership**: No user can read, list, create, update, or delete scan logs created by another user (`userId` MUST match `request.auth.uid`).
2. **Strict Structure**:
   - `riskScore` must be an integer between 0 and 100.
   - `riskLevel` must be either `'HIGH'`, `'MEDIUM'`, or `'LOW'`.
   - String fields (`sender`, `subject`, `body`, `summary`) must be constrained in size to prevent "Denial of Wallet" resource exhaustion.
3. **Temporal Integrity**: `createdAt` must be set to the server-managed timestamp `request.time`.
4. **Immutability**: Once created, a scan document is completely immutable. No updates or revisions are authorized.

## 2. The "Dirty Dozen" Payloads

Here are 12 malicious payloads and operations that MUST be blocked by security rules:

1. **Unauthenticated Write**: An offline attacker attempting to write a scan without signing in.
2. **UID Hijacking**: Logged-in user `userA` attempting to write a scan with `userId = "userB"`.
3. **Cross-Tenant List Scraping**: Logged-in user `userA` attempting to perform a blanket scan list query without specifying their own `userId`.
4. **Cross-Tenant Document Read**: Logged-in user `userA` attempting to fetch `/scans/some_scan_id` owned by `userB`.
5. **Score Injection Attack**: Logged-in user trying to write a payload with `riskScore = 999` (outside [0, 100] limits).
6. **Malicious Risk Level**: User writes a fake payload with `riskLevel = "CRITICAL_THREAT"` (must only be "HIGH", "MEDIUM", or "LOW").
7. **Junk ID Poisoning**: A client attempts to create a document with an ID of 1000 arbitrary characters.
8. **Resource Exhaustion Payload**: A client attempts to write a scan with a `body` size exceeding 100,000 characters.
9. **Faked Client Timestamp**: User attempts to submit `createdAt = "2020-01-01T00:00:00Z"` instead of using the mandatory server timestamp.
10. **Malicious Scan Mutation / Update**: User attempts to update an existing scan to clear their scan record history elements or spoof classifications.
11. **Malicious Scan Destruction**: User attempts to delete a logged scan to cover up suspicious phishing markers.
12. **Shadow Field Injection**: User attempts to write a scan containing a hidden administration flag `isAdmin: true` inside the document root.

## 3. Firestore Rules draft (`firestore.rules`)

The security rules require enforcing maximum strictness. Every write (create only, since updates and deletes are blocked) must validate all incoming fields.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 1. Global Safety Net
    match /{document=**} {
      allow read, write: if false;
    }

    // Common helper functions
    function isSignedIn() {
      return request.auth != null;
    }

    function isValidId(id) {
      return id is string && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$');
    }

    function incoming() {
      return request.resource.data;
    }

    // Scan Schema Validation
    function isValidScan(data) {
      return data.keys().hasAll(['sender', 'subject', 'body', 'riskScore', 'riskLevel', 'createdAt', 'summary', 'confidence', 'userId'])
        && data.keys().size() == 9
        && data.sender is string && data.sender.size() <= 256
        && data.subject is string && data.subject.size() <= 512
        && data.body is string && data.body.size() <= 65536
        && data.riskScore is int && data.riskScore >= 0 && data.riskScore <= 100
        && data.riskLevel is string && (data.riskLevel == 'HIGH' || data.riskLevel == 'MEDIUM' || data.riskLevel == 'LOW')
        && data.createdAt is timestamp && data.createdAt == request.time
        && data.summary is string && data.summary.size() <= 10240
        && data.confidence is int && data.confidence >= 0 && data.confidence <= 100
        && data.userId is string && data.userId == request.auth.uid;
    }

    // Scans Match Group Routing Block
    match /scans/{scanId} {
      allow create: if isSignedIn()
        && isValidId(scanId)
        && isValidScan(incoming());

      allow read, list: if isSignedIn()
        && resource.data.userId == request.auth.uid;

      // Updates and Deletions are forbidden to protect integrity of the audit trails
      allow update, delete: if false;
    }
  }
}
```
