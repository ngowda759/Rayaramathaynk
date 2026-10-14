const { detectIntent } = require('./lib/ai/intent/detector.ts');
console.log(detectIntent('How do I book archana?'));
console.log(detectIntent('Where is the temple located?'));
console.log(detectIntent('temple address'));
console.log(detectIntent('dress code for temple'));
console.log(detectIntent('annadana free meals'));
console.log(detectIntent('annadana'));
