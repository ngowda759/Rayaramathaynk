import { resolveCredentials } from '../../scripts/dump-firestore-live';

const mockKeyPath = './non-existent-key.json';

describe('resolveCredentials', () => {
    it('handles escaped newline private key', () => {
        const creds = resolveCredentials('proj', 'email', '-----BEGIN PRIVATE KEY-----\\nFAKE_KEY\\n-----END PRIVATE KEY-----', mockKeyPath);
        expect(creds.private_key).toBe('-----BEGIN PRIVATE KEY-----\nFAKE_KEY\n-----END PRIVATE KEY-----');
    });

    it('handles actual multiline private key', () => {
        const creds = resolveCredentials('proj', 'email', '-----BEGIN PRIVATE KEY-----\nFAKE_KEY\n-----END PRIVATE KEY-----', mockKeyPath);
        expect(creds.private_key).toBe('-----BEGIN PRIVATE KEY-----\nFAKE_KEY\n-----END PRIVATE KEY-----');
    });

    it('handles CRLF private key', () => {
        const creds = resolveCredentials('proj', 'email', '-----BEGIN PRIVATE KEY-----\r\nFAKE_KEY\r\n-----END PRIVATE KEY-----', mockKeyPath);
        expect(creds.private_key).toBe('-----BEGIN PRIVATE KEY-----\nFAKE_KEY\n-----END PRIVATE KEY-----');
    });

    it('handles surrounding whitespace', () => {
        const creds = resolveCredentials('proj', 'email', '   -----BEGIN PRIVATE KEY-----\\nFAKE_KEY\\n-----END PRIVATE KEY-----   \n', mockKeyPath);
        expect(creds.private_key).toBe('-----BEGIN PRIVATE KEY-----\nFAKE_KEY\n-----END PRIVATE KEY-----');
    });

    it('throws on missing credentials', () => {
        expect(() => resolveCredentials(undefined, undefined, undefined, mockKeyPath)).toThrow('Missing Firebase credentials.');
    });
});
