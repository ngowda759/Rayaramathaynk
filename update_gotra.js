const fs = require('fs');
let code = fs.readFileSync('components/home/SevaBooking.tsx', 'utf8');

code = code.replace(
  'const [gotra, setGotra] = useState("");',
  'const [gotra, setGotra] = useState("");'
);

// We need to check if the scroll issue actually persists. The previous fix was applied. Let's see what SevaReceipt looks like again.
