import {describe, expect, it} from 'vitest';
import {encodeUtf8} from '../csv/encoding';
import {detectInputKind} from './kind';

describe('detectInputKind', () => {
  it('detects an .xlsx file by its ZIP signature', () => {
    expect(
      detectInputKind(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14])),
    ).toBe('xlsx');
  });

  it('detects a legacy .xls file by its OLE2 signature', () => {
    const ole = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00];
    expect(detectInputKind(new Uint8Array(ole))).toBe('xls');
  });

  it('treats everything else as text', () => {
    expect(detectInputKind(encodeUtf8('id,name\n'))).toBe('text');
    expect(detectInputKind(new Uint8Array([0xff, 0xfe, 0x69, 0x00]))).toBe(
      'text',
    );
    expect(detectInputKind(new Uint8Array())).toBe('text');
  });

  it('treats text that starts with "PK" but no ZIP signature as text', () => {
    expect(detectInputKind(encodeUtf8('PK,Name\n'))).toBe('text');
  });
});
