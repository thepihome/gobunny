/** SQLite/D1 may return booleans as 0/1 or true/false. */
export function isActiveStatus(value) {
  return value === 1 || value === true || value === '1';
}
