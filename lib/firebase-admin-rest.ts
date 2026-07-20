/**
 * Firebase Firestore Admin via REST API - SERVER ONLY
 * This file must only be imported in server-side code (API routes)
 */
import "server-only";

const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;

async function getAccessToken(): Promise<string> {
  const { GoogleAuth } = require('google-auth-library');
  
  const auth = new GoogleAuth({
    credentials: {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
    },
    scopes: ['https://www.googleapis.com/auth/datastore'],
  });
  
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  return tokenResponse.token as string;
}

export async function addDocument(collectionPath: string, data: Record<string, unknown>): Promise<string> {
  const token = await getAccessToken();
  
  const response = await fetch(`${FIRESTORE_BASE_URL}/${collectionPath}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: serializeDocument(data),
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create document: ${error}`);
  }
  
  const result = await response.json();
  const docPath = result.name as string;
  return docPath.split('/').pop() as string;
}

export async function updateDocument(collectionPath: string, documentId: string, data: Record<string, unknown>): Promise<void> {
  const token = await getAccessToken();
  const docPath = `${collectionPath}/${documentId}`;
  const fieldPaths = Object.keys(data).join(',');
  
  const response = await fetch(`${FIRESTORE_BASE_URL}/${docPath}?updateMask.fieldPaths=${fieldPaths}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: serializeDocument(data),
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update document: ${error}`);
  }
}

export async function deleteDocument(collectionPath: string, documentId: string): Promise<void> {
  const token = await getAccessToken();
  const docPath = `${collectionPath}/${documentId}`;
  
  const response = await fetch(`${FIRESTORE_BASE_URL}/${docPath}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok && response.status !== 404) {
    const error = await response.text();
    throw new Error(`Failed to delete document: ${error}`);
  }
}

function serializeDocument(data: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      continue;
    }
    if (value instanceof Date) {
      fields[key] = { timestampValue: value.toISOString() };
    } else if (typeof value === 'string') {
      fields[key] = { stringValue: value };
    } else if (typeof value === 'number') {
      fields[key] = { integerValue: value };
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else if (Array.isArray(value)) {
      fields[key] = {
        arrayValue: {
          values: value.map(item => {
            if (typeof item === 'string') return { stringValue: item };
            if (typeof item === 'number') return { integerValue: item };
            return { stringValue: String(item) };
          }),
        },
      };
    } else if (typeof value === 'object') {
      fields[key] = { mapValue: { fields: serializeDocument(value as Record<string, unknown>) } };
    } else {
      fields[key] = { stringValue: String(value) };
    }
  }
  
  return fields;
}
