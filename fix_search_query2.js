const fs = require('fs');
let code = fs.readFileSync('app/api/public/receipts/route.ts', 'utf8');

code = code.replace(
  '    query = query.or(`user_phone.ilike.%${searchQuery}%,user_email.ilike.%${searchQuery}%,firestore_id.ilike.%${searchQuery}%,payment_reference.ilike.%${searchQuery}%`);',
  '    if (searchQuery.includes("@")) {\n      query = query.ilike("user_email", `%${searchQuery}%`);\n    } else if (searchQuery.startsWith("SR") || searchQuery.startsWith("TXN") || searchQuery.length > 15) {\n      query = query.or(`firestore_id.ilike.%${searchQuery}%,payment_reference.ilike.%${searchQuery}%`);\n    } else {\n      query = query.or(`user_phone.ilike.%${searchQuery}%,firestore_id.ilike.%${searchQuery}%,payment_reference.ilike.%${searchQuery}%`);\n    }'
);

fs.writeFileSync('app/api/public/receipts/route.ts', code);
