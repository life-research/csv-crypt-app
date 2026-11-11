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
  'error.unexpected': 'Unexpected error: {message}',
};
