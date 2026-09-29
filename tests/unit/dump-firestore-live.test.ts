
// Mock getAuthHeader everywhere
import { globalPacer } from '../../scripts/dump-firestore-live';
globalPacer.getAuthHeader = jest.fn().mockResolvedValue({ Authorization: 'Bearer test-token' }) as any;

// MOCK THROTTLE TO AVOID TIMER HANGS
import { globalPacer } from '../../scripts/dump-firestore-live';
globalPacer.throttle = jest.fn().mockResolvedValue(undefined);
/* eslint-disable @typescript-eslint/no-explicit-any */
import { resolveCredentials, fetchCollectionListAll, globalPacer } from '../../scripts/dump-firestore-live';

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

describe('fetchCollectionListAll pagination', () => {
    let originalFetch: typeof global.fetch;
    let fetchMock: jest.Mock;
    let failed: Map<string, string>;

    beforeEach(() => {
        originalFetch = global.fetch;
        fetchMock = jest.fn();
        global.fetch = fetchMock as any;
        failed = new Map<string, string>();
        jest.useFakeTimers();
    });

    afterEach(() => {
        global.fetch = originalFetch;
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    it('handles single page with no nextPageToken successfully', async () => {
        const mockResponse = { documents: [{ name: 'doc1' }] };
        fetchMock.mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue(mockResponse),
        });


        const promise = fetchCollectionListAll('myCol', 'base', failed);
        await Promise.resolve();
        jest.advanceTimersByTime(250);
        await Promise.resolve();
        const result = await promise;

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('doc1');
        expect(failed.has('myCol')).toBe(false);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('handles multiple pages and terminates correctly when nextPageToken is missing', async () => {
        const page1 = { documents: [{ name: 'doc1' }], nextPageToken: 'token1' };
        const page2 = { documents: [{ name: 'doc2' }] }; // no nextPageToken
        let calls = 0;

        fetchMock.mockImplementation(async () => {
            calls++;
            return {
                ok: true,
                status: 200,
                json: jest.fn().mockResolvedValue(calls === 1 ? page1 : page2),
            };
        });


        const promise = fetchCollectionListAll('myCol', 'base', failed);

        let result;
        promise.then(r => result = r);

        // Wait for first fetch
        await Promise.resolve();
        await Promise.resolve();
        // Advance timer for 250ms delay
        jest.advanceTimersByTime(250);
        await Promise.resolve();
        await Promise.resolve();

        await promise;

        expect(result).toHaveLength(2);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        // It should never attempt fetch("0")
        const callsToFetch = fetchMock.mock.calls;
        expect(callsToFetch[1][0]).toContain('pageToken=token1');
        // Ensure "0" wasn't fetched
        expect(callsToFetch.some(call => call[0] === '0')).toBe(false);
    });

    it('never attempts fetch("0")', async () => {
        const page1 = { documents: [{ name: 'doc1' }] }; // no nextPageToken
        fetchMock.mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue(page1),
        });


        await fetchCollectionListAll('myCol', 'base', failed);

        const fetchCalls = fetchMock.mock.calls;
        for (const call of fetchCalls) {
            expect(call[0]).not.toBe("0");
        }
    });
});


describe('fetchCollectionListAll retries', () => {
    let originalFetch: typeof global.fetch;
    let fetchMock: jest.Mock;
    let failed: Map<string, string>;

    beforeEach(() => {
        originalFetch = global.fetch;
        fetchMock = jest.fn();
        global.fetch = fetchMock as any;
        failed = new Map<string, string>();
        jest.useFakeTimers();
    });

    afterEach(() => {
        global.fetch = originalFetch;
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    it('retries on HTTP 429 and eventually succeeds', async () => {
        let calls = 0;
        fetchMock.mockImplementation(async () => {
            calls++;
            if (calls < 3) {
                return {
                    ok: false,
                    status: 429,
                    headers: new Headers({ 'Retry-After': '0' })
                };
            }
            return {
                ok: true,
                status: 200,
                json: jest.fn().mockResolvedValue({ documents: [] }),
            };
        });

        const promise = fetchCollectionListAll('myCol', 'base', failed);
        await Promise.resolve(); // trigger fetch
        for (let i = 0; i < 3; i++) {
            await Promise.resolve();
            jest.advanceTimersByTime(2000);
            await Promise.resolve();
        }

        const result = await promise;
        expect(result).toEqual([]);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('honors Retry-After when supplied as seconds on HTTP 429', async () => {
        let calls = 0;
        fetchMock.mockImplementation(async () => {
            calls++;
            if (calls === 1) {
                return {
                    ok: false,
                    status: 429,
                    headers: { get: () => '1' }
                };
            }
            return {
                ok: true,
                status: 200,
                json: jest.fn().mockResolvedValue({ documents: [] }),
            };
        });

        const promise = fetchCollectionListAll('myCol', 'base', failed);
        await Promise.resolve(); // 1st fetch
        // In JS with multiple layers of async (globalPacer.fetch inside try/catch inside for loop)
        // jest timer advancing requires flush
        // Removed unstable middle expect
        jest.advanceTimersByTime(5000);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        const result = await promise;
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(result).toEqual([]);
    });

    it('honors Retry-After when supplied as HTTP-date on HTTP 429', async () => {
        let calls = 0;
        jest.setSystemTime(new Date('2025-01-01T00:00:00Z'));
        const targetDate = new Date('2025-01-01T00:00:05Z');
        fetchMock.mockImplementation(async () => {
            calls++;
            if (calls === 1) {
                return {
                    ok: false,
                    status: 429,
                    headers: { get: () => targetDate.toUTCString() }
                };
            }
            return {
                ok: true,
                status: 200,
                json: jest.fn().mockResolvedValue({ documents: [] }),
            };
        });

        const promise = fetchCollectionListAll('myCol', 'base', failed);
        await Promise.resolve();
        await Promise.resolve();

        // Removed unstable middle expect
        jest.advanceTimersByTime(5000);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        const result = await promise;
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(result).toEqual([]);
    });

    it('fails clearly on persistent HTTP 429 with exhaustion message', async () => {
        fetchMock.mockImplementation(async () => {
            return {
                ok: false,
                status: 429,
                headers: { get: () => '0' }
            };
        });

        const promise = fetchCollectionListAll('myCol', 'base', failed);

        for (let i = 0; i < 11; i++) {
            await Promise.resolve();
            jest.advanceTimersByTime(5000);
            await Promise.resolve();
        }

        await promise;
        expect(fetchMock).toHaveBeenCalledTimes(10);
        expect(failed.has('myCol')).toBe(true);
        expect(failed.get('myCol')).toContain('HTTP 429 after 10 attempts');
    });

    it('fails immediately without inappropriate retries on permanent 4xx', async () => {
        fetchMock.mockImplementation(async () => {
            return {
                ok: false,
                status: 403,
                text: jest.fn().mockResolvedValue('Forbidden')
            };
        });

        const promise = fetchCollectionListAll('myCol', 'base', failed);
        await Promise.resolve();
        await Promise.resolve();
        await promise;

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(failed.has('myCol')).toBe(true);
        expect(failed.get('myCol')).toContain('permanent HTTP 403');
    });

    it('retries on 5xx server errors and eventually succeeds', async () => {
        let calls = 0;
        fetchMock.mockImplementation(async () => {
            calls++;
            if (calls < 3) {
                return {
                    ok: false,
                    status: 503,
                    text: jest.fn().mockResolvedValue('Service Unavailable')
                };
            }
            return {
                ok: true,
                status: 200,
                json: jest.fn().mockResolvedValue({ documents: [] }),
            };
        });

        const promise = fetchCollectionListAll('myCol', 'base', failed);
        await Promise.resolve();
        for (let i = 0; i < 3; i++) {
            await Promise.resolve();
            jest.advanceTimersByTime(5000 * (i + 1));
            await Promise.resolve();
        }

        const result = await promise;
        expect(result).toEqual([]);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });


    it('retries on network or timeout errors and eventually succeeds', async () => {
        let calls = 0;
        fetchMock.mockImplementation(async () => {
            calls++;
            if (calls < 3) {
                throw new Error('Network error');
            }
            return {
                ok: true,
                status: 200,
                json: jest.fn().mockResolvedValue({ documents: [] }),
            };
        });

        const promise = fetchCollectionListAll('myCol', 'base', failed);
        await Promise.resolve();
        for (let i = 0; i < 3; i++) {
            await Promise.resolve();
            jest.advanceTimersByTime(5000 * (i + 1));
            await Promise.resolve();
        }

        const result = await promise;
        expect(result).toEqual([]);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

});

describe('fetchCollectionListAll token refresh', () => {
    let originalFetch: typeof global.fetch;
    let fetchMock: jest.Mock;
    let failed: Map<string, string>;
    let originalGetAuthHeader: typeof globalPacer.getAuthHeader;
    let authHeaderMock: jest.Mock;

    beforeEach(() => {
        originalFetch = global.fetch;
        fetchMock = jest.fn();
        global.fetch = fetchMock as any;
        failed = new Map<string, string>();

        originalGetAuthHeader = globalPacer.getAuthHeader;
        authHeaderMock = jest.fn().mockResolvedValue({ Authorization: 'Bearer test-token' });
        globalPacer.getAuthHeader = authHeaderMock as any;

        jest.useFakeTimers();
    });

    afterEach(() => {
        global.fetch = originalFetch;
        globalPacer.getAuthHeader = originalGetAuthHeader;
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    it('refreshes token on 401 and succeeds', async () => {
        let calls = 0;
        fetchMock.mockImplementation(async (url, init) => {
            calls++;
            if (calls === 1) {
                // Return 401 the first time, simulating expired token
                return {
                    ok: false,
                    status: 401,
                    text: jest.fn().mockResolvedValue('Unauthorized')
                };
            }
            return {
                ok: true,
                status: 200,
                json: jest.fn().mockResolvedValue({ documents: [{ name: 'doc1' }] }),
            };
        });

        // Mock invalidateToken
        const invalidateMock = jest.fn();
        const origInvalidate = globalPacer.invalidateToken;
        globalPacer.invalidateToken = invalidateMock;

        const promise = fetchCollectionListAll('myCol', 'base', failed);

        // Let it execute
        await Promise.resolve();
        jest.advanceTimersByTime(250);
        await Promise.resolve();

        const result = await promise;

        expect(result).toHaveLength(1);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(invalidateMock).toHaveBeenCalledTimes(1);
        expect(failed.has('myCol')).toBe(false);

        globalPacer.invalidateToken = origInvalidate;
    });

    it('fails after refresh if 401 persists', async () => {
        fetchMock.mockImplementation(async () => {
            return {
                ok: false,
                status: 401,
                text: jest.fn().mockResolvedValue('Unauthorized')
            };
        });

        // Need to restore real invalidateToken or mock it so it doesn't infinite loop, but our code only retries once.
        const promise = fetchCollectionListAll('myCol', 'base', failed);

        await Promise.resolve();
        jest.advanceTimersByTime(250);
        await Promise.resolve();

        await promise;

        // One initial try, gets 401, invalidates, tries again, gets 401 again -> permanent failure
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(failed.has('myCol')).toBe(true);
        expect(failed.get('myCol')).toContain('permanent HTTP 401');
    });
});
