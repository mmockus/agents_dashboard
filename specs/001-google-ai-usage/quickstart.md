# Quickstart: Google AI Quota Usage

**Feature**: 001-google-ai-usage
**Date**: 2026-03-15

This guide explains how to configure the Google AI quota panel on a new installation.

---

## Prerequisites

- A GCP project with the Gemini API (`generativelanguage.googleapis.com`) enabled
- Billing enabled on the GCP project (required for Tier 1 quotas)
- The following APIs enabled on your GCP project:
  - `monitoring.googleapis.com` (Cloud Monitoring)
  - `serviceusage.googleapis.com` (Service Usage)

---

## Option A: Service Account Key (Recommended for Docker/Production)

1. **Create a service account** in Google Cloud Console:
   - IAM & Admin → Service Accounts → Create
   - Role: `Monitoring Viewer` + `Service Usage Viewer`

2. **Download the JSON key file**:
   - Service Accounts → your account → Keys → Add Key → JSON

3. **Configure the server**:
   ```bash
   # In server/.env or your environment
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
   GOOGLE_PROJECT_ID=your-gcp-project-id
   ```

4. **Restart the server** — the Google AI quota panel will appear automatically.

---

## Option B: Application Default Credentials (Local Dev)

```bash
gcloud auth application-default login \
  --scopes=https://www.googleapis.com/auth/monitoring.read,https://www.googleapis.com/auth/cloud-platform.read-only

# Then set only the project ID:
export GOOGLE_PROJECT_ID=your-gcp-project-id
```

Restart the server. `google-auth-library` auto-detects ADC credentials.

---

## Disabling the Panel

Simply omit `GOOGLE_PROJECT_ID` from the environment. The panel renders in "not configured" state and does not make any GCP API calls.

---

## Verifying Setup

```bash
curl http://localhost:3001/api/google-quota | jq '.configured, .error'
# Should output: true, null
```

If `configured` is false, check the `error` field for the specific issue.
