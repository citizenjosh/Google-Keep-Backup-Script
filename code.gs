// Google Keep -> Drive weekly backup  (overwrite mode)
// ----------------------------------------------------------
// Repository: https://github.com/citizenjosh/Google-Keep-Backup-Script
// Author: Josh (@citizenjosh)
// Last updated: 2025-05-01
//
// DEPLOYMENT (stand‑alone Apps Script, Gmail account)
// 1. In Google Drive click  New → Apps Script  and paste this entire file.
// 2. Open ⚙︎ Project settings. Under **Google Cloud Platform (GCP) project** click
//    **Change project** → **Link a Cloud project** → **New project** (or pick an
//    existing one). When linked, click **Open in Google Cloud Console**.
// 2a. In Project settings enable “Mostrar el archivo de manifiesto 'appsscript.json'”
//    so you can edit the manifest.
// 3. In the file list open **appsscript.json** and replace its contents with:
//    {
//      "timeZone": "Etc/GMT",
//      "exceptionLogging": "STACKDRIVER",
//      "oauthScopes": [
//        "https://www.googleapis.com/auth/script.external_request",
//        "https://www.googleapis.com/auth/drive",
//        "https://www.googleapis.com/auth/documents",
//        "https://www.googleapis.com/auth/script.send_mail",
//        "https://www.googleapis.com/auth/keep.readonly"
//      ]
//    }
//    This grants the script access to Google Keep, Drive, Docs, and Mail.
// 4. Back in Apps Script choose function **install** in the dropdown and press ▶️
//    Run. Grant the OAuth consent screen, including “See and download your Google Keep content.”
// 5. The script performs the first backup and installs a weekly trigger (Sunday
//    02:00 GMT by default). Edit `DEFAULT_WEEKDAY` / `DEFAULT_TRIGGER_HR` or run
//    `setupWeeklyTrigger()` to change the schedule.
// ----------------------------------------------------------

/* ===== CONFIGURATION ===== */
var BACKUP_FOLDER_NAME = 'Google Keep Backup';
var LOG_FILE_NAME      = 'backup-log.txt';
var DEFAULT_WEEKDAY    = ScriptApp.WeekDay.SUNDAY; // ScriptApp.WeekDay value
var DEFAULT_TRIGGER_HR = 2;                        // 24‑h clock, GMT

/* ===== MENU (container‑bound only) ===== */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('Keep Backup')
      .addItem('Run Backup Now', 'backupKeep')
      .addSeparator()
      .addItem('Reset Weekly Schedule', 'setupWeeklyTrigger')
      .addItem('View Log', 'showLog')
      .addToUi();
  } catch (e) {
    /* stand‑alone script, no UI */
  }
}

/* ===== MAIN ===== */
function backupKeep() {
  var userEmail = Session.getActiveUser().getEmail();
  try {
    var folder = getOrCreateFolder_(BACKUP_FOLDER_NAME);
    var notes  = listAllKeepNotes_();
    notes.forEach(function(note){ saveNote_(note, folder); });
    logLine_(folder, '✔ Backup OK  – ' + new Date().toISOString());
  } catch (err) {
    var folder = getOrCreateFolder_(BACKUP_FOLDER_NAME);
    logLine_(folder, '✖ BACKUP FAILED – ' + new Date().toISOString() + '\n' + err.stack);
    MailApp.sendEmail(userEmail, '[Keep Backup] ERROR', err.stack);
    throw err;
  }
}

/* ===== NOTE -> DRIVE ===== */
function saveNote_(note, folder) {
  var titleSafe = sanitiseFilename_(note.title || 'Untitled');
  deleteExistingFiles_(folder, titleSafe); // overwrite mode

  var doc = DocumentApp.create(titleSafe);
  var body = doc.getBody();
  body.appendParagraph('# ' + (note.title || 'Untitled'));
  body.appendParagraph('Created ' + new Date(note.createTime).toUTCString())
      .setItalic(true);
  if (note.labels && note.labels.length) {
    body.appendParagraph('Labels: ' + note.labels.join(', '))
        .setFontSize(9).setItalic(true);
  }
  body.appendHorizontalRule();
  body.appendParagraph(note.text || '');

  (note.attachments || []).forEach(function(att, i){
    var blob = Utilities.newBlob(Utilities.base64Decode(att.data), att.mimeType,
                                 titleSafe + ' - ' + (i+1));
    var imgFile = folder.createFile(blob);
    body.appendParagraph('Image ' + (i+1) + ': ' + imgFile.getUrl())
        .setLinkUrl(imgFile.getUrl());
  });

  doc.saveAndClose();
  DriveApp.getFileById(doc.getId()).moveTo(folder);
}

/* ===== KEEP REST API ===== */
function listAllKeepNotes_() {
  var notes = [];
  var pageToken;
  do {
    var url = 'https://keep.googleapis.com/v1/notes' + (pageToken ? '?pageToken=' + pageToken : '');
    var resp = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
    });
    if (resp.getResponseCode() !== 200) {
      throw new Error('Keep API response ' + resp.getResponseCode() + ': ' + resp.getContentText());
    }
    var data = JSON.parse(resp.getContentText());
    (data.notes || []).forEach(function(n){
      notes.push({
        id: n.name,
        title: n.title || '',
        text: n.textContent || '',
        createTime: n.createTime,
        labels: (n.labels || []).map(function(l){ return l.name.split('/').pop(); }),
        attachments: (n.attachments || []).map(function(a){ return { mimeType: a.mimeType, data: a.data }; })
      });
    });
    pageToken = data.nextPageToken;
  } while (pageToken);
  return notes;
}

/* ===== SCHEDULER ===== */
function setupWeeklyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t){
    if (t.getHandlerFunction() === 'backupKeep') { ScriptApp.deleteTrigger(t); }
  });

  ScriptApp.newTrigger('backupKeep')
    .timeBased()
    .onWeekDay(DEFAULT_WEEKDAY)
    .atHour(DEFAULT_TRIGGER_HR)
    .create();

  console.log('Weekly trigger set for ' + DEFAULT_WEEKDAY + ' @ ' + DEFAULT_TRIGGER_HR + ':00 GMT');
}

/* ===== LOGGING ===== */
function logLine_(folder, text) {
  var logFile = getOrCreateFile_(folder, LOG_FILE_NAME, '');
  var existing = '';
  try {
    existing = logFile.getBlob().getDataAsString();
  } catch (e) {
    existing = '';
  }
  logFile.setContent(existing + text + '\n');
}

function showLog() {
  try {
    var folder = getOrCreateFolder_(BACKUP_FOLDER_NAME);
    var log    = getOrCreateFile_(folder, LOG_FILE_NAME, '');
    SpreadsheetApp.getUi().showModalDialog(
      HtmlService.createHtmlOutput('<pre>' + log.getBlob().getDataAsString() + '</pre>'),
      'Backup Log');
  } catch (e) {
    console.log('Log content:\n' + log.getBlob().getDataAsString());
  }
}

/* ===== HELPERS ===== */
function getOrCreateFolder_(name) {
  var iter = DriveApp.getFoldersByName(name);
  return iter.hasNext() ? iter.next() : DriveApp.createFolder(name);
}

function getOrCreateFile_(folder, name, content) {
  var iter = folder.getFilesByName(name);
  return iter.hasNext() ? iter.next() : folder.createFile(name, content);
}

function deleteExistingFiles_(folder, baseTitle) {
  var esc = baseTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var pattern = new RegExp('^' + esc);
  var files = folder.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    if (pattern.test(f.getName())) f.setTrashed(true);
  }
}

function sanitiseFilename_(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim();
}

/* ===== FIRST‑RUN ===== */
function install() {
  // Install the weekly trigger only.
  setupWeeklyTrigger();
  // IMPORTANT: To grant the Keep API scope, manually run backupKeep()
  // from the Run menu once and accept the OAuth consent screen.
}
// End of file
