import {describe, expect, it, vi} from 'vitest';
import {
  chooseSaveMethod,
  FILE_NAME_HEADER,
  outputFileName,
  saveWithPicker,
  saveWithTauri,
  type SaveFilePickerWindow,
} from './save';

describe('outputFileName', () => {
  it.each([
    ['data.txt', 'crypt', 'data_crypt.csv'],
    ['data.crypt.csv', 'decrypt', 'data.crypt_decrypt.csv'],
    ['noext', 'crypt', 'noext_crypt.csv'],
  ])('%s + %s → %s', (input, suffix, expected) => {
    expect(outputFileName(input, suffix)).toBe(expected);
  });

  it('uses the given extension', () => {
    expect(outputFileName('data.txt', 'key', 'txt')).toBe('data_key.txt');
  });
});

describe('chooseSaveMethod', () => {
  const withPicker: SaveFilePickerWindow = {showSaveFilePicker: vi.fn()};

  it('prefers the desktop app', () => {
    expect(chooseSaveMethod(true, withPicker)).toBe('tauri');
  });

  it('uses the browser dialog where it exists', () => {
    expect(chooseSaveMethod(false, withPicker)).toBe('picker');
  });

  it('downloads in other browsers', () => {
    expect(chooseSaveMethod(false, {})).toBe('download');
  });
});

describe('saveWithTauri', () => {
  it('sends the bytes and the encoded file name', async () => {
    const invoke = vi.fn().mockResolvedValue('saved');
    const data = new Uint8Array([1, 2, 3]);

    const result = await saveWithTauri(invoke, data, 'Müller Liste.csv');

    expect(result).toBe('saved');
    expect(invoke).toHaveBeenCalledWith('save_file', data, {
      headers: {[FILE_NAME_HEADER]: 'M%C3%BCller%20Liste.csv'},
    });
  });

  it('passes on a cancelled dialog', async () => {
    const invoke = vi.fn().mockResolvedValue('cancelled');

    const result = await saveWithTauri(invoke, new Uint8Array(), 'a.csv');

    expect(result).toBe('cancelled');
  });
});

describe('saveWithPicker', () => {
  const blob = new Blob(['x']);

  function pickerWindow(
    picker: SaveFilePickerWindow['showSaveFilePicker'],
  ): SaveFilePickerWindow {
    return {showSaveFilePicker: picker};
  }

  it('writes the blob to the selected file', async () => {
    const writable = {
      write: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const picker = vi.fn().mockResolvedValue({
      createWritable: () => Promise.resolve(writable),
    });

    const result = await saveWithPicker(pickerWindow(picker), blob, 'a.csv');

    expect(result).toBe('saved');
    expect(picker).toHaveBeenCalledWith({suggestedName: 'a.csv'});
    expect(writable.write).toHaveBeenCalledWith(blob);
    expect(writable.close).toHaveBeenCalled();
  });

  it('reports a cancelled dialog', async () => {
    const picker = vi
      .fn()
      .mockRejectedValue(new DOMException('cancelled', 'AbortError'));

    const result = await saveWithPicker(pickerWindow(picker), blob, 'a.csv');

    expect(result).toBe('cancelled');
  });

  it('passes on other errors', async () => {
    const error = new DOMException('denied', 'NotAllowedError');
    const picker = vi.fn().mockRejectedValue(error);

    await expect(
      saveWithPicker(pickerWindow(picker), blob, 'a.csv'),
    ).rejects.toBe(error);
  });
});
