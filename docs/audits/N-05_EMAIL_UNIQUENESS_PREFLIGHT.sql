-- N-05 read-only preflight for public.users.email.
--
-- Contract (lib/auth/email-normalization.ts):
--   trim every ECMAScript String.prototype.trim() whitespace code point at both ends,
--   then fold only ASCII A-Z. Internal whitespace is invalid and is rejected by the app.
--
-- Run this inside a READ ONLY transaction. It performs no INSERT, UPDATE, DELETE or DDL.
-- PASS conditions:
--   1. duplicate groups: zero rows.
--   2. noncanonical stored values: zero rows (or every row understood and corrected
--      through the owner-approved reconciliation process before the index is applied).
--   3. any whitespace in the stored address: zero rows.
--   4. empty after trimming: zero rows.

BEGIN TRANSACTION READ ONLY;

-- 1. Duplicate groups under the final canonical form.
SELECT
  normalized.canonical_email,
  count(*) AS users,
  array_agg(normalized.id ORDER BY normalized.id) AS user_ids
FROM (
  SELECT
    id,
    translate(
      btrim(email, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'),
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      'abcdefghijklmnopqrstuvwxyz'
    ) AS canonical_email
  FROM public.users
) AS normalized
GROUP BY normalized.canonical_email
HAVING count(*) > 1
ORDER BY normalized.canonical_email;

-- 2. Stored values that differ from the canonical form (edge whitespace or ASCII case).
SELECT
  id,
  email,
  translate(
    btrim(email, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'),
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    'abcdefghijklmnopqrstuvwxyz'
  ) AS canonical_email
FROM public.users
WHERE email IS DISTINCT FROM translate(
  btrim(email, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'),
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  'abcdefghijklmnopqrstuvwxyz'
)
ORDER BY id;

-- 3. Any whitespace inside the stored address (including edge whitespace and NBSP/Unicode spaces).
SELECT id, email
FROM public.users
WHERE email ~ U&'[\0009\000A\000B\000C\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]'
ORDER BY id;

-- 4. Empty after trimming the contract's whitespace set.
SELECT id, email
FROM public.users
WHERE btrim(email, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') = ''
ORDER BY id;

-- 5. Context: total rows.
SELECT count(*) AS total_users FROM public.users;

ROLLBACK;
