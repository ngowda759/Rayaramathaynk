/**
 * Firestore REST API Client
 * Uses Firebase REST API to interact with Firestore without Admin SDK
 */

const PROJECT_ID = "sri-raghavendra-mutt";
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

export interface FirestoreDocument {
  name?: string;
  fields?: Record<string, any>;
  createTime?: string;
  updateTime?: string;
}

export class FirestoreRestClient {
  private apiKey: string;
  private projectId: string;

  constructor() {
    this.apiKey = process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";
    this.projectId = PROJECT_ID;
  }

  /**
   * Create or update a document
   */
  async setDocument(collection: string, documentId: string, data: Record<string, unknown>): Promise<FirestoreDocument | null> {
    const url = `${BASE_URL}/${collection}/${documentId}?key=${this.apiKey}`;
    
    try {
      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fields: this.convertToFirestoreFields(data),
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Firestore error: ${response.status} - ${error}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error writing to ${collection}/${documentId}:`, error);
      return null;
    }
  }

  /**
   * Read a document
   */
  async getDocument(collection: string, documentId: string): Promise<FirestoreDocument | null> {
    const url = `${BASE_URL}/${collection}/${documentId}?key=${this.apiKey}`;
    
    try {
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Firestore error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error reading ${collection}/${documentId}:`, error);
      return null;
    }
  }

  /**
   * Convert JavaScript object to Firestore field format
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private convertToFirestoreFields(data: Record<string, any>): Record<string, any> {
    const fields: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) {
        continue;
      }

      if (typeof value === "string") {
        fields[key] = { stringValue: value };
      } else if (typeof value === "number") {
        fields[key] = { integerValue: Math.floor(value) };
      } else if (typeof value === "boolean") {
        fields[key] = { booleanValue: value };
      } else if (value instanceof Date) {
        fields[key] = { timestampValue: value.toISOString() };
      } else if (Array.isArray(value)) {
        fields[key] = {
          arrayValue: {
            values: value.map((item) => this.convertToFirestoreFields({ value: item }).value),
          },
        };
      } else if (typeof value === "object") {
        fields[key] = {
          mapValue: {
            fields: this.convertToFirestoreFields(value as Record<string, unknown>),
          },
        };
      }
    }

    return fields;
  }
}

// Singleton instance
export const firestoreClient = new FirestoreRestClient();
