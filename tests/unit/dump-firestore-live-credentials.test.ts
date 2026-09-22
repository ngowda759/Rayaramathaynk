import { exec } from 'child_process';
import * as path from 'path';
import { promisify } from 'util';
import * as fs from 'fs';

const execAsync = promisify(exec);

describe('dump-firestore-live credentials', () => {
  const scriptPath = path.join(__dirname, '../../scripts/dump-firestore-live.ts');

  it('fails safely with missing credentials', async () => {
    try {
      await execAsync(`npx tsx ${scriptPath}`, {
        env: { ...process.env, FIREBASE_PROJECT_ID: '', FIREBASE_CLIENT_EMAIL: '', FIREBASE_PRIVATE_KEY: '', FIREBASE_SERVICE_ACCOUNT: 'non-existent.json' }
      });
      fail('Should have failed');
    } catch (err) {
      expect((err as { stderr?: string }).stderr || "").toContain('FATAL');
      expect((err as { stderr?: string }).stderr || "").toContain('FIREBASE_PROJECT_ID');
      expect((err as { stderr?: string }).stderr || "").toContain('FIREBASE_CLIENT_EMAIL');
      expect((err as { stderr?: string }).stderr || "").toContain('FIREBASE_PRIVATE_KEY');
    }
  });

  it('handles fake credentials from environment correctly but fails authentication safely', async () => {
    try {
      await execAsync(`npx tsx ${scriptPath}`, {
        env: {
          ...process.env,
          FIREBASE_PROJECT_ID: 'fake-project',
          FIREBASE_CLIENT_EMAIL: 'fake@example.com',
          FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nfake\\n-----END PRIVATE KEY-----\\n',
          FIREBASE_SERVICE_ACCOUNT: 'non-existent.json'
        }
      });
      fail('Should have failed because key is fake');
    } catch (err) {
      // The script will now fail during client.getAccessToken() because the key is fake.
      // But it should NOT fail with the "Missing Firebase credentials" error.
      expect((err as { stderr?: string }).stderr || "").toContain('FATAL');
      expect((err as { stderr?: string }).stderr || "").not.toContain('Missing Firebase credentials');
      expect((err as { stderr?: string }).stderr || "").not.toContain('fake@example.com');
      expect((err as { stderr?: string }).stderr || "").not.toContain('-----BEGIN PRIVATE KEY-----');
    }
  });

  it('handles actual newlines in private key', async () => {
    try {
      await execAsync(`npx tsx ${scriptPath}`, {
        env: {
          ...process.env,
          FIREBASE_PROJECT_ID: 'fake-project',
          FIREBASE_CLIENT_EMAIL: 'fake@example.com',
          FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n',
          FIREBASE_SERVICE_ACCOUNT: 'non-existent.json'
        }
      });
      fail('Should have failed because key is fake');
    } catch (err) {
      expect((err as { stderr?: string }).stderr || "").toContain('FATAL');
      expect((err as { stderr?: string }).stderr || "").not.toContain('Missing Firebase credentials');
    }
  });

  it('falls back to service account file if environment variables are missing', async () => {
    const fakeKeyPath = path.join(__dirname, 'fake-service-account.json');
    fs.writeFileSync(fakeKeyPath, JSON.stringify({
      project_id: 'file-fake-project',
      client_email: 'file-fake@example.com',
      private_key: '-----BEGIN PRIVATE KEY-----\\nfake-file\\n-----END PRIVATE KEY-----\\n'
    }));

    try {
      await execAsync(`npx tsx ${scriptPath}`, {
        env: {
          ...process.env,
          FIREBASE_PROJECT_ID: '',
          FIREBASE_CLIENT_EMAIL: '',
          FIREBASE_PRIVATE_KEY: '',
          FIREBASE_SERVICE_ACCOUNT: fakeKeyPath
        }
      });
      fail('Should have failed because key is fake');
    } catch (err) {
      expect((err as { stderr?: string }).stderr || "").toContain('FATAL');
      expect((err as { stderr?: string }).stderr || "").not.toContain('Missing Firebase credentials');
    } finally {
      fs.unlinkSync(fakeKeyPath);
    }
  });

});
