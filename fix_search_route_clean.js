const fs = require('fs');
let code = fs.readFileSync('app/api/public/receipts/route.ts', 'utf8');

code = code.replace(
  '    // Attempt to match against user_phone, user_email, firestore_id, or payment_reference\n    // If it looks like an email:\n    // Attempt to match against user_phone, user_email, firestore_id, or payment_reference\n    // Using `like` or `ilike` is not supported in the standard `or` string format without explicit setup, or might require different syntax.\n    // Let\'s build the `or` string carefully.\n',
  '    // Attempt to match against user_phone, user_email, firestore_id, or payment_reference\n'
);

fs.writeFileSync('app/api/public/receipts/route.ts', code);
