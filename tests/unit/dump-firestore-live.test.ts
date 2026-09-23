import { resolveCredentials, fetchCollectionListAll } from '../../scripts/dump-firestore-live';

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
        jest.advanceTimersByTime(250);
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

        global.fetch = jest.fn().mockImplementation(async () => {
            calls++;
            return {
                ok: true,
                status: 200,
                json: jest.fn().mockResolvedValue(calls === 1 ? page1 : page2),
            };
        });


        const promise = fetchCollectionListAll('myCol', 'base', {}, failed);

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
        jest.useFakeTimers();
    });

    afterEach(() => {
        global.fetch = originalFetch;
        jest.useRealTimers();
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

        const promise = fetchCollectionListAll('myCol', 'base', {}, failed);
        await Promise.resolve(); // trigger fetch
        for (let i = 0; i < 3; i++) {
            await Promise.resolve();
            jest.advanceTimersByTime(2000);
            await Promise.resolve();
        }

        const result = await promise;
        expect(result).toEqual([]);
        expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('honors Retry-After when supplied as seconds on HTTP 429', async () => {
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

        const promise = fetchCollectionListAll('myCol', 'base', {}, failed);
        await Promise.resolve(); // 1st fetch
        await Promise.resolve(); // catch block processing

        expect(global.fetch).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(999);
        await Promise.resolve();
        expect(global.fetch).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(1);
        await Promise.resolve();

        const result = await promise;
        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual([]);
    });

    it('honors Retry-After when supplied as HTTP-date on HTTP 429', async () => {
        let calls = 0;
        jest.setSystemTime(new Date('2025-01-01T00:00:00Z'));
        const targetDate = new Date('2025-01-01T00:00:05Z');
        global.fetch = jest.fn().mockImplementation(async () => {
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

        const promise = fetchCollectionListAll('myCol', 'base', {}, failed);
        await Promise.resolve();
        await Promise.resolve();

        expect(global.fetch).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(4999);
        await Promise.resolve();
        expect(global.fetch).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(1);
        await Promise.resolve();

        const result = await promise;
        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual([]);
    });

    it('fails clearly on persistent HTTP 429 with exhaustion message', async () => {
        global.fetch = jest.fn().mockImplementation(async () => {
            return {
                ok: false,
                status: 429,
                headers: { get: () => '0' }
            };
        });

        const promise = fetchCollectionListAll('myCol', 'base', {}, failed);

        for (let i = 0; i < 11; i++) {
            await Promise.resolve();
            jest.advanceTimersByTime(5000);
            await Promise.resolve();
        }

        await promise;
        expect(global.fetch).toHaveBeenCalledTimes(10);
        expect(failed.has('myCol')).toBe(true);
        expect(failed.get('myCol')).toContain('HTTP 429 after 10 attempts');
    });

    it('fails immediately without inappropriate retries on permanent 4xx', async () => {
        global.fetch = jest.fn().mockImplementation(async () => {
            return {
                ok: false,
                status: 403,
                text: jest.fn().mockResolvedValue('Forbidden')
            };
        });

        const promise = fetchCollectionListAll('myCol', 'base', {}, failed);
        await Promise.resolve();
        await Promise.resolve();
        await promise;

        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(failed.has('myCol')).toBe(true);
        expect(failed.get('myCol')).toContain('permanent HTTP 403');
    });

    it('retries on 5xx server errors and eventually succeeds', async () => {
        let calls = 0;
        global.fetch = jest.fn().mockImplementation(async () => {
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

        const promise = fetchCollectionListAll('myCol', 'base', {}, failed);
        await Promise.resolve();
        for (let i = 0; i < 3; i++) {
            await Promise.resolve();
            jest.advanceTimersByTime(5000 * (i + 1));
            await Promise.resolve();
        }

        const result = await promise;
        expect(result).toEqual([]);
        expect(global.fetch).toHaveBeenCalledTimes(3);
    });


    it('retries on network or timeout errors and eventually succeeds', async () => {
        let calls = 0;
        global.fetch = jest.fn().mockImplementation(async () => {
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

        const promise = fetchCollectionListAll('myCol', 'base', {}, failed);
        await Promise.resolve();
        for (let i = 0; i < 3; i++) {
            await Promise.resolve();
            jest.advanceTimersByTime(5000 * (i + 1));
            await Promise.resolve();
        }

        const result = await promise;
        expect(result).toEqual([]);
        expect(global.fetch).toHaveBeenCalledTimes(3);
    });

});
