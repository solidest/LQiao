/**
 * Match a value against a glob pattern supporting `*` (within segment) and `**` (any segments).
 */
export function matchesPattern(value: string, pattern: string): boolean {
  if (pattern === value) return true;
  if (pattern === '**') return true;

  const regex = pattern
    .replaceAll('\\', '\\\\')
    .replaceAll('.', '\\.')
    .replaceAll('**', '\x00')
    .replaceAll('*', '[^:]*')
    .replaceAll('\x00', '.*');

  return new RegExp(`^${regex}$`).test(value);
}
