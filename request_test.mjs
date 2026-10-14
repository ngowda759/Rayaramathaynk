function parseModelJson(text) {
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('the reviewer returned an empty body');
  }

  // Fast path: if the whole text parses, we're done.
  try {
    const parsed = JSON.parse(text);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch (e) {
    // ignore
  }

  // Scan all balanced objects to find the first one that is both valid JSON and
  // passes the basic object check (since a review report must be an object).
  let lastError;
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== '{') continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < text.length; index += 1) {
      const char = text[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === '{') depth += 1;
      else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          const candidate = text.slice(start, index + 1);
          try {
            const parsed = JSON.parse(candidate);
            if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
              return parsed;
            }
          } catch (e) {
            lastError = e;
          }
          break; // Try the next '{'
        }
      }
    }
  }

  if (lastError) {
     throw new Error(`the reviewer returned invalid JSON: ${lastError.message}`, { cause: lastError });
  }

  throw new Error('the reviewer returned JSON that is not an object or no JSON at all');
}

console.log(parseModelJson("User Safety: { safe: true }\n\n{\"verdict\": \"approved\"}"));
console.log(parseModelJson("We need to...\n```json\n{\"verdict\": \"changes-requested\"}\n```"));
