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

    // Helper function to test JWT initialization and crypto parsing
    async function testJwtParsing(keyString: string): Promise<boolean> {
        try {
            const client = new JWT({
                email: 'test@example.com',
                key: keyString,
                scopes: ['https://www.googleapis.com/auth/datastore']
            });

            // Trigger actual crypto usage by attempting to sign a JWT
            // GoogleAuthLibrary uses this internally before sending the network request
            const token = await client.authorize();
            return true;
        } catch (e: any) {
            // If we get an unsupported decoder error, the key parsing failed.
            if (e.message && e.message.includes('unsupported')) {
                return false;
            }
            // Other errors (like network/account not found) mean the key was successfully parsed!
            if (e.message && e.message.includes('account not found')) {
                return true;
            }
            throw e;
        }
    }

    it('sanity check: raw escaped string FAILS', async () => {
        const escapedKey = privateKey.replace(/\n/g, '\\n');
        const isValid = await testJwtParsing(escapedKey);
        expect(isValid).toBe(false);
    });

    it('accepts normalized escaped newline private key', async () => {
        const escapedKey = privateKey.replace(/\n/g, '\\n');
        const creds = resolveCredentials('proj', 'email', escapedKey, mockKeyPath);

        const isValid = await testJwtParsing(creds.private_key);
        expect(isValid).toBe(true);
    });

    it('accepts normalized CRLF private key', async () => {
        const crlfKey = privateKey.replace(/\n/g, '\r\n');
        const creds = resolveCredentials('proj', 'email', crlfKey, mockKeyPath);

        const isValid = await testJwtParsing(creds.private_key);
        expect(isValid).toBe(true);
    });

    it('accepts normalized surrounding whitespace key', async () => {
        const wsKey = `   \n\t  ${privateKey}   \n\t  `;
        const creds = resolveCredentials('proj', 'email', wsKey, mockKeyPath);

        const isValid = await testJwtParsing(creds.private_key);
        expect(isValid).toBe(true);
    });

    it('accepts normalized inconsistent header whitespace key', async () => {
        let badHeaderKey = privateKey.replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----   \n  \n');
        badHeaderKey = badHeaderKey.replace('-----END PRIVATE KEY-----', '\n  \n-----END PRIVATE KEY-----');

        const creds = resolveCredentials('proj', 'email', badHeaderKey, mockKeyPath);

        const isValid = await testJwtParsing(creds.private_key);
        expect(isValid).toBe(true);
    });
});
