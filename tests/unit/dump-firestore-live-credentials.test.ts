import * as path from 'path';
import * as fs from 'fs';
import { resolveCredentials } from '../../scripts/dump-firestore-live';

describe('dump-firestore-live credentials', () => {
  it('resolves credentials correctly from environment variables', () => {
    const creds = resolveCredentials(
      'fake-project',
      'fake@example.com',
      '-----BEGIN PRIVATE KEY-----\\nfake\\n-----END PRIVATE KEY-----\\n',
      'non-existent.json'
    );

    expect(creds.project_id).toBe('fake-project');
    expect(creds.client_email).toBe('fake@example.com');
    // Ensure escaped newlines are converted to actual newlines
    expect(creds.private_key).toBe('-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n');
  });

  it('handles actual newlines in private key', () => {
    const creds = resolveCredentials(
      'fake-project',
      'fake@example.com',
      '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n',
      'non-existent.json'
    );

    expect(creds.project_id).toBe('fake-project');
    expect(creds.client_email).toBe('fake@example.com');
    expect(creds.private_key).toBe('-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n');
  });

  it('falls back to service account file if environment variables are missing', () => {
    const fakeKeyPath = path.join(__dirname, 'fake-service-account.json');
    fs.writeFileSync(fakeKeyPath, JSON.stringify({
      project_id: 'file-fake-project',
      client_email: 'file-fake@example.com',
      private_key: '-----BEGIN PRIVATE KEY-----\\nfake-file\\n-----END PRIVATE KEY-----\\n'
    }));

    try {
      const creds = resolveCredentials('', '', '', fakeKeyPath);
      expect(creds.project_id).toBe('file-fake-project');
      expect(creds.client_email).toBe('file-fake@example.com');
      // Note: JSON.parse of actual file does its own unescaping if written as a valid string value
      expect(creds.private_key).toBe('-----BEGIN PRIVATE KEY-----\\nfake-file\\n-----END PRIVATE KEY-----\\n');
    } finally {
      fs.unlinkSync(fakeKeyPath);
    }
  });

  it('fails safely with missing credentials', () => {
    expect(() => {
      resolveCredentials('', '', '', 'non-existent.json');
    }).toThrow('Missing Firebase credentials');
  });
});
