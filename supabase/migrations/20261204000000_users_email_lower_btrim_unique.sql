-- N-05: canonical email uniqueness for public.users.email.
-- Contract (lib/auth/email-normalization.ts):
--   trim every ECMAScript String.prototype.trim() whitespace code point at both ends,
--   then fold only ASCII A-Z. PostgreSQL lower() is collation-dependent, so translate is used.
-- Internal whitespace is not a valid email and is rejected by the application and its request schemas.
-- Additive only: no data is changed and no column/constraint is removed.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_btrim_key
  ON public.users (
    translate(
      btrim(email, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'),
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      'abcdefghijklmnopqrstuvwxyz'
    )
  );
