import type {Messages} from './i18n';

export const en: Messages = {
  'app.title': 'CSV Crypt',
  'app.subtitle':
    'Encrypts CSV files line by line. The first column stays readable.',
  'app.privacy':
    'Your data does not leave this computer. The encryption runs completely in the browser.',
  'app.version': 'Version {version}',
  'language.label': 'Language',
  'tab.encrypt': 'Encrypt',
  'tab.decrypt': 'Decrypt',

  'file.label': 'File',
  'file.drop': 'Drop a file here or click to select one',
  'file.selected': 'Selected: {name}',
  'file.change': 'Select another file',
  'file.unsupported':
    'The app cannot process the file “{name}”. Allowed are CSV and text files ({extensions}).',
  'file.excel':
    'The app cannot process Excel files directly. Please open the file “{name}” in Excel and save it as “CSV (Comma delimited)” or “Unicode Text”.',

  'separator.label': 'Separator of the input file',
  'separator.auto': 'Detect automatically',
  'separator.comma': 'Comma (,)',
  'separator.semicolon': 'Semicolon (;)',
  'separator.tab': 'Tab',

  'info.summary': '{lines} lines · encoding {encoding} · separator {separator}',

  'encrypt.ownKey': 'Use an existing key',
  'encrypt.ownKeyHint': 'Usually the app makes a new key for each transfer.',
  'encrypt.start': 'Encrypt',
  'encrypt.done': 'The file is encrypted.',
  'encrypt.save': 'Save encrypted file',

  'key.label': 'Key',
  'key.inputLabel': 'Key (64 characters)',
  'key.invalid': 'The key must have exactly 64 characters (0–9, a–f).',
  'key.copy': 'Copy',
  'key.copied':
    'Copied. Note: Windows can keep the clipboard in its history (Win+V) or in the cloud.',
  'key.save': 'Save as file',
  'key.warning':
    'Send the key on a different channel than the file, never together with it. Without the key, nobody can decrypt the file.',

  'decrypt.outputFormat': 'Format of the output file',
  'decrypt.formatExcel': 'For Excel (UTF-16, tab)',
  'decrypt.formatUtf8': 'Standard CSV (UTF-8, comma)',
  'decrypt.start': 'Decrypt',
  'decrypt.done': 'The file is decrypted.',
  'decrypt.save': 'Save decrypted file',

  'action.working': 'Please wait …',
  'action.reset': 'Start again',
  'action.saved': 'Saved.',
  'action.cancel': 'Cancel',
  'action.cancelled': 'Cancelled. The app did not create a file.',
  'progress.label': 'Progress',

  'error.line': 'Error in line {line}: {message}',
  'error.invalid-cipher-text':
    'The second column contains no valid encrypted data.',
  'error.wrong-key-or-corrupt':
    'The key is wrong, or somebody changed the file.',
  'error.unclosedQuote': 'A quote (") from line {line} is not closed.',
  'error.fileTooLarge':
    'The file is too large ({size} MB). The app processes files up to {max} MB. Please split the file into smaller files.',
  'error.outputTooLarge':
    'The encrypted file would be larger than {max} MB. The app could not decrypt it again. Please split the file into smaller files.',
  'error.textTooLong':
    'The browser cannot read the text of this file because it is too large. Please split the file into smaller files.',
  'error.notText.excel':
    'The file is an Excel file, not a CSV file. Please open it in Excel and save it as “CSV (Comma delimited)” or “Unicode Text”.',
  'error.notText.office':
    'The file is an Office file (for example .xls or a password-protected file), not a CSV file. Please remove a password protection and save the file in Excel as “CSV (Comma delimited)”.',
  'error.notText.pdf': 'The file is a PDF document, not a CSV file.',
  'error.notText.image': 'The file is an image, not a CSV file.',
  'error.notText.archive':
    'The file is an archive or an Office document (for example .zip or .docx), not a CSV file.',
  'error.notText.binary':
    'The file contains no text. Please select a CSV or text file.',
  'error.unexpected': 'Unexpected error: {message}',
};
