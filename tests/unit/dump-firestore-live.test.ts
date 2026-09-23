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

describe('fetchCollectionListAll pagination', () => {
    let originalFetch: typeof global.fetch;
    let failed: Map<string, string>;

    beforeEach(() => {
        originalFetch = global.fetch;
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
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue(mockResponse),
        });


        const promise = fetchCollectionListAll('myCol', 'base', {}, failed);
        await Promise.resolve();
        const result = await promise;

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('doc1');
        expect(failed.has('myCol')).toBe(false);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('handles multiple pages and terminates correctly when nextPageToken is missing', async () => {
        const page1 = { documents: [{ name: 'doc1' }], nextPageToken: 'token1' };
        const page2 = { documents: [{ name: 'doc2' }] }; // no nextPageToken
        let calls = 0;

        global.fetch = jest.fn().mockImplementation(async (url) => {
            calls++;
            return {
                ok: true,
                status: 200,
                json: jest.fn().mockResolvedValue(calls === 1 ? page1 : page2),
            };
        });


        const promise = fetchCollectionListAll('myCol', 'base', {}, failed);
        await Promise.resolve();
        const result = await promise;

        expect(result).toHaveLength(2);
        expect(global.fetch).toHaveBeenCalledTimes(2);
        // It should never attempt fetch("0")
        const callsToFetch = (global.fetch as jest.Mock).mock.calls;
        expect(callsToFetch[1][0]).toContain('pageToken=token1');
        // Ensure "0" wasn't fetched
        expect(callsToFetch.some(call => call[0] === '0')).toBe(false);
    });

    it('never attempts fetch("0")', async () => {
        const page1 = { documents: [{ name: 'doc1' }] }; // no nextPageToken
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue(page1),
        });


        await fetchCollectionListAll('myCol', 'base', {}, failed);

        const fetchCalls = (global.fetch as jest.Mock).mock.calls;
        for (const call of fetchCalls) {
            expect(call[0]).not.toBe("0");
        }
    });
});

describe('fetchCollectionListAll retries', () => {
    let originalFetch: typeof global.fetch;
    let failed: Map<string, string>;

    beforeEach(() => {
        originalFetch = global.fetch;
        failed = new Map<string, string>();
    });

    afterEach(() => {
        global.fetch = originalFetch;
        jest.clearAllMocks();
    });

    it('retries on HTTP 429 and eventually succeeds', async () => {
        let calls = 0;
        global.fetch = jest.fn().mockImplementation(async () => {
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


        const result = await fetchCollectionListAll('myCol', 'base', {}, failed);
        expect(result).toEqual([]);
        expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('honors Retry-After when supplied on HTTP 429', async () => {
        let calls = 0;
        global.fetch = jest.fn().mockImplementation(async () => {
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


        const start = Date.now();
        await fetchCollectionListAll('myCol', 'base', {}, failed);
        const elapsed = Date.now() - start;

        expect(elapsed).toBeGreaterThanOrEqual(1000); // at least 1s wait
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('fails clearly on persistent HTTP 429', async () => {
        global.fetch = jest.fn().mockImplementation(async () => {
            return {
                ok: false,
                status: 429,
                headers: { get: () => '0' }
            };
        });


        await fetchCollectionListAll('myCol', 'base', {}, failed);
        expect(global.fetch).toHaveBeenCalledTimes(5); // 5 attempts limit
        expect(failed.has('myCol')).toBe(true);
        expect(failed.get('myCol')).toContain('pagination exhausted before completion');
    });

    it('fails immediately without inappropriate retries on permanent 4xx', async () => {
        global.fetch = jest.fn().mockImplementation(async () => {
            return {
                ok: false,
                status: 403,
                text: jest.fn().mockResolvedValue('Forbidden')
            };
        });


        await fetchCollectionListAll('myCol', 'base', {}, failed);
        expect(global.fetch).toHaveBeenCalledTimes(1); // 1 attempt, fails permanently
        expect(failed.has('myCol')).toBe(true);
        expect(failed.get('myCol')).toContain('permanent HTTP 403');
    });
});
