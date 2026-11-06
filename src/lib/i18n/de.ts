export const de = {
  'app.title': 'CSV Crypt',
  'app.subtitle':
    'Verschlüsselt CSV-Dateien zeilenweise. Die erste Spalte bleibt lesbar.',
  'app.privacy':
    'Ihre Daten verlassen diesen Computer nicht. Die Verschlüsselung läuft vollständig im Browser.',
  'app.version': 'Version {version}',
  'language.label': 'Sprache',
  'tab.encrypt': 'Verschlüsseln',
  'tab.decrypt': 'Entschlüsseln',

  'file.label': 'Datei',
  'file.drop': 'Datei hierher ziehen oder klicken zum Auswählen',
  'file.selected': 'Ausgewählt: {name}',
  'file.change': 'Andere Datei wählen',

  'separator.label': 'Trennzeichen der Eingabedatei',
  'separator.auto': 'Automatisch erkennen',
  'separator.comma': 'Komma (,)',
  'separator.semicolon': 'Semikolon (;)',
  'separator.tab': 'Tabulator',

  'info.summary':
    '{lines} Zeilen · Kodierung {encoding} · Trennzeichen {separator}',

  'encrypt.ownKey': 'Vorhandenen Schlüssel verwenden',
  'encrypt.ownKeyHint':
    'Normalerweise erzeugt die App für jede Übermittlung einen neuen Schlüssel.',
  'encrypt.start': 'Verschlüsseln',
  'encrypt.done': 'Die Datei ist verschlüsselt.',
  'encrypt.save': 'Verschlüsselte Datei speichern',

  'key.label': 'Schlüssel',
  'key.inputLabel': 'Schlüssel (64 Zeichen)',
  'key.invalid': 'Der Schlüssel muss genau 64 Zeichen lang sein (0–9, a–f).',
  'key.copy': 'Kopieren',
  'key.copied':
    'Kopiert. Achtung: Windows kann die Zwischenablage im Verlauf (Win+V) oder in der Cloud speichern.',
  'key.save': 'Als Datei speichern',
  'key.warning':
    'Senden Sie den Schlüssel auf einem anderen Weg als die Datei, nie zusammen mit ihr. Ohne Schlüssel kann niemand die Datei entschlüsseln.',

  'decrypt.outputFormat': 'Format der Ausgabedatei',
  'decrypt.formatExcel': 'Für Excel (UTF-16, Tabulator)',
  'decrypt.formatUtf8': 'Standard-CSV (UTF-8, Komma)',
  'decrypt.start': 'Entschlüsseln',
  'decrypt.done': 'Die Datei ist entschlüsselt.',
  'decrypt.save': 'Entschlüsselte Datei speichern',

  'action.working': 'Bitte warten …',
  'action.reset': 'Neu beginnen',
  'action.saved': 'Gespeichert.',
  'action.cancel': 'Abbrechen',
  'action.cancelled': 'Abgebrochen. Die App hat keine Datei erstellt.',
  'progress.label': 'Fortschritt',

  'error.line': 'Fehler in Zeile {line}: {message}',
  'error.invalid-cipher-text':
    'Die zweite Spalte enthält keine gültigen verschlüsselten Daten.',
  'error.wrong-key-or-corrupt':
    'Der Schlüssel ist falsch, oder die Datei wurde verändert.',
  'error.unclosedQuote':
    'Ein Anführungszeichen (") ab Zeile {line} wird nicht geschlossen.',
  'error.fileTooLarge':
    'Die Datei ist zu groß ({size} MB). Die App verarbeitet Dateien bis {max} MB. Bitte teilen Sie die Datei in kleinere Dateien auf.',
  'error.outputTooLarge':
    'Die verschlüsselte Datei wäre größer als {max} MB. Die App könnte sie danach nicht mehr entschlüsseln. Bitte teilen Sie die Datei in kleinere Dateien auf.',
  'error.textTooLong':
    'Der Browser kann den Text dieser Datei nicht lesen, weil sie zu groß ist. Bitte teilen Sie die Datei in kleinere Dateien auf.',
  'error.unexpected': 'Unerwarteter Fehler: {message}',
} as const;
