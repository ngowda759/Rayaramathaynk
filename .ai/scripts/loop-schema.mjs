/**
 * Minimal JSON Schema validator for the AI development loop.
 *
 * It intentionally supports only the keywords the loop's schemas use, so the
 * validator stays dependency-free and readable. It is not a general-purpose
 * JSON Schema implementation.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function matchesType(value, type) {
  const actual = typeOf(value);
  if (type === 'integer') return actual === 'number' && Number.isInteger(value);
  if (type === 'number') return actual === 'number';
  return actual === type;
}

const cache = new Map();

export function loadJson(file) {
  if (cache.has(file)) return cache.get(file);
  const parsed = JSON.parse(readFileSync(file, 'utf8'));
  cache.set(file, parsed);
  return parsed;
}

function validateNode(value, schema, dir, path, errors) {
  if (schema.$ref !== undefined) {
    if (typeof schema.$ref !== 'string' || schema.$ref.startsWith('#')) {
      errors.push(`${path}: unsupported $ref ${JSON.stringify(schema.$ref)}`);
      return;
    }
    const target = resolvePath(dir, schema.$ref);
    validateNode(value, loadJson(target), dirname(target), path, errors);
    return;
  }

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((type) => matchesType(value, type))) {
      errors.push(`${path}: expected ${types.join(' | ')}, got ${typeOf(value)}`);
      return;
    }
  }

  if (Array.isArray(schema.enum) && !schema.enum.some((item) => item === value)) {
    errors.push(`${path}: ${JSON.stringify(value)} is not one of ${JSON.stringify(schema.enum)}`);
  }

  if (schema.const !== undefined && value !== schema.const) {
    errors.push(`${path}: expected const ${JSON.stringify(schema.const)}`);
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${path}: shorter than minLength ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`${path}: longer than maxLength ${schema.maxLength}`);
    }
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${path}: does not match pattern ${schema.pattern}`);
    }
    if (schema.format === 'date-time' && Number.isNaN(Date.parse(value))) {
      errors.push(`${path}: is not an RFC 3339 date-time`);
    }
  }

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${path}: below minimum ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${path}: above maximum ${schema.maximum}`);
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${path}: fewer than minItems ${schema.minItems}`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(`${path}: more than maxItems ${schema.maxItems}`);
    }
    if (schema.items !== undefined) {
      value.forEach((item, index) => {
        validateNode(item, schema.items, dir, `${path}[${index}]`, errors);
      });
    }
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of schema.required ?? []) {
      if (!Object.hasOwn(value, key)) errors.push(`${path}: missing required "${key}"`);
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (Object.hasOwn(value, key)) {
        validateNode(value[key], child, dir, `${path}.${key}`, errors);
      }
    }
    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties ?? {}));
      for (const key of Object.keys(value)) {
        if (!allowed.has(key)) errors.push(`${path}: unexpected property "${key}"`);
      }
    }
  }
}

/**
 * Validate a parsed value against a schema file.
 *
 * @returns {string[]} human-readable errors; empty means valid.
 */
export function validateAgainstSchema(value, schemaFile) {
  const errors = [];
  validateNode(value, loadJson(schemaFile), dirname(schemaFile), 'root', errors);
  return errors;
}
