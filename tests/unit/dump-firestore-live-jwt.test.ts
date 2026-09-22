import { JWT } from 'google-auth-library';
import * as crypto from 'crypto';
import { resolveCredentials } from '../../scripts/dump-firestore-live';

const mockKeyPath = './non-existent-key.json';

// Generate a synthetic PKCS8 RSA private key for testing
const { privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

describe('JWT Private Key Validation', () => {

    // Helper function to test JWT initialization and local crypto parsing
    function testKeyLocally(keyString: string): boolean {
        try {
            // 1. Validate that Node.js native crypto can parse it
            crypto.createPrivateKey(keyString);

            // 2. Validate that it can be constructed with JWT
            new JWT({
                email: 'test@example.com',
                key: keyString,
                scopes: ['https://www.googleapis.com/auth/datastore']
            });

            // We do NOT call authorize() to avoid network requests.
            // Construction and createPrivateKey are sufficient to prove valid PEM.
            return true;
        } catch {
            return false;
        }
    }

    it('sanity check: raw escaped string FAILS', () => {
        const escapedKey = privateKey.replace(/\n/g, '\\n');
        const isValid = testKeyLocally(escapedKey);
        expect(isValid).toBe(false);
    });

    it('accepts normalized escaped newline private key', () => {
        const escapedKey = privateKey.replace(/\n/g, '\\n');
        const creds = resolveCredentials('proj', 'email', escapedKey, mockKeyPath);

        const isValid = testKeyLocally(creds.private_key);
        expect(isValid).toBe(true);
    });

    it('accepts normalized CRLF private key', () => {
        const crlfKey = privateKey.replace(/\n/g, '\r\n');
        const creds = resolveCredentials('proj', 'email', crlfKey, mockKeyPath);

        const isValid = testKeyLocally(creds.private_key);
        expect(isValid).toBe(true);
    });

    it('accepts normalized surrounding whitespace key', () => {
        const wsKey = `   \n\t  ${privateKey}   \n\t  `;
        const creds = resolveCredentials('proj', 'email', wsKey, mockKeyPath);

        const isValid = testKeyLocally(creds.private_key);
        expect(isValid).toBe(true);
    });

    it('accepts normalized inconsistent header whitespace key', () => {
        let badHeaderKey = privateKey.replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----   \n  \n');
        badHeaderKey = badHeaderKey.replace('-----END PRIVATE KEY-----', '\n  \n-----END PRIVATE KEY-----');

        const creds = resolveCredentials('proj', 'email', badHeaderKey, mockKeyPath);

        const isValid = testKeyLocally(creds.private_key);
        expect(isValid).toBe(true);
    });
});
