# Google Keep → Drive Backup

Does NOT work

A Google Apps Script intended to back up all your Google Keep notes (including text, metadata, and embedded images) into a single Drive folder named `Google Keep Backup`, exporting each note as a Google Doc and saving attachments alongside it.

## Features

* Iterates over every Google Keep note via the (official) Keep REST API.
* Exports each note to a Google Doc, preserving title, creation time, labels, and text content.
* Downloads image attachments as separate files and inserts links to them in the corresponding Doc.
* Stores all exported Docs and images in one Drive folder, overwriting previous exports each run.
* Logs each successful run or error into `backup-log.txt` in the backup folder.
* Schedules a weekly (Sunday 02:00 GMT) time‑driven trigger to run the backup automatically.
* Sends an email notification if a backup run fails.

## Prerequisites & Deployment

### 1. Workspace Domain‑wide Delegation

The official Keep API scopes (`https://www.googleapis.com/auth/keep.readonly`) are **restricted to Google Workspace** and require domain‑wide delegation:

1. In your Workspace **Admin console** → **Security → API controls → Domain‑wide delegation**, add the OAuth Client ID of your Apps Script project and grant these scopes:

   * `https://www.googleapis.com/auth/keep.readonly`
   * `https://www.googleapis.com/auth/script.external_request`
   * `https://www.googleapis.com/auth/script.send_mail`
   * `https://www.googleapis.com/auth/documents`
   * `https://www.googleapis.com/auth/drive` (or `drive.file` for least privilege)

2. In Cloud Console, ensure your OAuth consent screen is set to **Internal** so domain users can authorize the script.

### 2. Enable APIs

* In the linked Cloud project, enable **Google Keep API** under **APIs & Services → Library**.
* In Apps Script **Project settings**, enable **Show `appsscript.json` manifest file** and update its `oauthScopes` to match the list above.

### 3. Authorize & Install

1. In the Apps Script editor, manually run the `backupKeep` function once to trigger the OAuth consent flow and approve the Keep scopes.
2. Then run the `install` function to set up the weekly trigger.

## Why It Doesn’t Work in Personal or Paid Google Apps

* **Keep API scopes are enterprise-only.** Even in paid Google Workspace (formerly G Suite), the `https://www.googleapis.com/auth/keep.readonly` scope is restricted by default. You must have **domain-wide delegation** and, in practice, use a **service account** to obtain a valid access token for Keep.
* **Standard OAuth clients can’t request Keep scopes.** Whether you’re on a free Gmail account or a paid Workspace plan, the built-in Apps Script OAuth client will refuse to surface Keep-related scopes on the consent screen, leading to 403 **PERMISSION\_DENIED** or 400 **invalid\_scope** errors.
* **Triggers keep running until removed.** Any existing time-driven trigger will continue invoking `backupKeep()`, causing repeated failures until you manually delete the trigger in the Apps Script **Triggers** panel.

## The Only Fully Supported Solutions

1. **Workspace + Domain‑wide Delegation** + Service Account: use an Apps Script OAuth2 library with a service account delegated in your domain.
2. **Unofficial Python library (`gkeepapi`)**: run outside Apps Script, e.g. on Cloud Run, to bypass Google’s scope restrictions.
3. **Google Takeout → Drive ingestion**: periodically export Keep via Takeout and import into Drive using Apps Script.

## Conclusion

This script illustrates the dream of a simple, automated Keep backup in Apps Script—but due to Google’s current API restrictions, it requires Workspace‑level configuration or a different environment (Python) to function. Until Google offers a public consumer‑friendly Keep API, this project can’t run end‑to‑end under a free Gmail account.
