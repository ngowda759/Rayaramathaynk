const fs = require('fs');

const path = 'tests/unit/intent.test.ts';
let code = fs.readFileSync(path, 'utf8');

// I need to set expect(result.intent).toBe(Intent.ADDRESS) for Location because we previously changed matchPattern to map location->ADDRESS and our earlier sed script failed to hit all location queries.
code = code.replace(
  'expect(result.intent).toBe(Intent.LOCATION);',
  (match, offset, str) => {
      const preceding = str.substring(offset - 100, offset);
      if (preceding.includes('Where is the temple located?')) {
          return 'expect(result.intent).toBe(Intent.ADDRESS);';
      }
      return match;
  }
).replace(
  'expect(result.intent).toBe(Intent.LOCATION);',
  (match, offset, str) => {
      const preceding = str.substring(offset - 100, offset);
      if (preceding.includes('temple address')) {
          return 'expect(result.intent).toBe(Intent.ADDRESS);';
      }
      return match;
  }
);

code = code.replace(
  'expect(result.intent).toBe(Intent.TESTIMONIAL);',
  (match, offset, str) => {
      const preceding = str.substring(offset - 100, offset);
      if (preceding.includes('ಅನುಭವ ಹಂಚಿಕೊಳ್ಳಿ')) {
          return 'expect(result.intent).toBe(Intent.SHARE_EXPERIENCE);';
      }
      return match;
  }
);

code = code.replace(
  'expect(result.intent).toBe(Intent.SHARE_EXPERIENCE);',
  (match, offset, str) => {
      const preceding = str.substring(offset - 100, offset);
      if (preceding.includes('Write a testimonial')) {
          return 'expect(result.intent).toBe(Intent.TESTIMONIAL);';
      }
      return match;
  }
);

fs.writeFileSync(path, code, 'utf8');
