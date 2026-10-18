import { SEVA_ERROR_CODES, SevaError, sevaErrorMessage, sevaErrorStatus, type SevaErrorCode } from '@/lib/seva/errors';

describe('seva error codes', () => {
  it('maps every error code to a status and a message', () => {
    expect(SEVA_ERROR_CODES).toHaveLength(28);
    for (const code of SEVA_ERROR_CODES) {
      expect([400, 401, 403, 404, 409, 429, 500, 502]).toContain(sevaErrorStatus(code));
      const message = sevaErrorMessage(code);
      expect(message.length).toBeGreaterThan(0);
      expect(message).not.toMatch(/Error:/);
      expect(message).not.toMatch(/\bat\s+\S+\s+\(/);
    }
  });

  it.each<[SevaErrorCode, number]>([
    ['unauthenticated', 401],
    ['forbidden', 403],
    ['view_only', 403],
    ['validation', 400],
    ['not_found', 404],
    ['price_changed', 409],
    ['rate_limited', 429],
    ['partial_failure', 502],
    ['internal', 500],
  ])('%s -> %i', (code, status) => {
    expect(sevaErrorStatus(code)).toBe(status);
  });

  it('names the seva in the switched-off message', () => {
    expect(sevaErrorMessage('seva_inactive', { name: 'Paaduka Pooja' })).toBe(
      'Paaduka Pooja was switched off in Seva settings a moment ago.',
    );
    expect(sevaErrorMessage('seva_inactive')).toMatch(/switched off/);
  });

  it('carries the code and detail on SevaError', () => {
    const err = new SevaError('cash_short', { totalPaise: 82000 });
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('cash_short');
    expect(err.detail).toEqual({ totalPaise: 82000 });
    expect(err.name).toBe('SevaError');
  });
});
