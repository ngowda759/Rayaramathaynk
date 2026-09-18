const fs = require('fs');
let code = fs.readFileSync('app/api/public/receipts/route.ts', 'utf8');

code = code.replace(
  '    query = query.or(`user_phone.ilike.%${searchQuery}%,user_email.ilike.%${searchQuery}%,firestore_id.ilike.%${searchQuery}%,payment_reference.ilike.%${searchQuery}%`);',
  '    // Attempt to match against user_phone, user_email, firestore_id, or payment_reference\n    // Using `like` or `ilike` is not supported in the standard `or` string format without explicit setup, or might require different syntax.\n    // Let\'s build the `or` string carefully.\n    query = query.or(`user_phone.ilike.%${searchQuery}%,user_email.ilike.%${searchQuery}%,firestore_id.ilike.%${searchQuery}%,payment_reference.ilike.%${searchQuery}%`);'
);

fs.writeFileSync('app/api/public/receipts/route.ts', code);
