/**
 * Static import analysis for the project's module dependency graph.
 *
 * Extracts module specifiers from TypeScript/JavaScript modules with a regex
 * pass over the source (the blueprint needs speed, and the language server
 * owns full semantics), then resolves relative specifiers against the scanned
 * file set. Bare specifiers stay as external dependencies.
 * @module code-intel/graph/imports
 */

interface ImportAnalysis {
  /** Specifiers as written in the source. */
  specifiers: string[]
  /** Relative specifiers resolved to project-relative paths (when `known` had them). */
  resolved: string[]
  /** Bare specifiers (package names) and unresolved relative specifiers. */
  external: string[]
}

const SPECIFIER_RE =
  /(?:^\s*import\s[^;]*?\sfrom\s*|^\s*import\s*\(|\brequire\s*\(|^\s*export\s[^;]*?\sfrom\s*)['"]([^'"]+)['"]/gm

/** Extract all module specifiers (import, dynamic import, require, export-from). */
export function extractSpecifiers(source: string): string[] {
  const specifiers: string[] = []
  for (const match of source.matchAll(SPECIFIER_RE)) {
    const specifier = match[1]
    if (specifier) specifiers.push(specifier)
  }
  // Edge case: `import 'side-effect.css'` statements without `from`.
  for (const match of source.matchAll(/(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g)) {
    const specifier = match[1]
    if (specifier && !specifiers.includes(specifier)) specifiers.push(specifier)
  }
  return [...new Set(specifiers)]
}

/**
 * Collapse `.` and `..` segments of a POSIX path; `..` past the root is
 * dropped (the project root is the floor), and stray empty segments removed.
 */
function normalizeSegments(path: string): string {
  const segments: string[] = []
  for (const segment of path.split('/')) {
    if (segment.length === 0 || segment === '.') continue
    if (segment === '..') {
      segments.pop()
      continue
    }
    segments.push(segment)
  }
  return segments.join('/')
}

/**
 * Resolve a relative specifier against the importing file and the project's
 * file set. Tries the literal path and the common index/extensions.
 */
export function resolveSpecifier(importerRelative: string, specifier: string, known: ReadonlySet<string>): string | null {
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) return null
  const baseDirectory = importerRelative.includes('/') ? importerRelative.slice(0, importerRelative.lastIndexOf('/')) : ''
  const combined = specifier.startsWith('/')
    ? specifier
    : baseDirectory.length > 0
      ? `${baseDirectory}/${specifier}`
      : specifier
  const clean = normalizeSegments(combined)
  const candidates = [clean, `${clean}/index`]
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts', '.d.ts']
  for (const candidate of candidates) {
    for (const extension of extensions) {
      if (known.has(candidate + extension)) return candidate + extension
    }
  }
  return null
}

/** Package name of a bare specifier (`@scope/pkg/sub` → `@scope/pkg`). */
export function packageNameOf(specifier: string): string {
  if (specifier.startsWith('@')) {
    const segments = specifier.split('/')
    return segments.length >= 2 ? `${segments[0]}/${segments[1]}` : specifier
  }
  return specifier.split('/')[0] ?? specifier
}

/** Analyze one file's imports against the known project file set. */
export function analyzeImports(source: string, importerRelative: string, known: ReadonlySet<string>): ImportAnalysis {
  const specifiers = extractSpecifiers(source)
  const resolved: string[] = []
  const external: string[] = []
  for (const specifier of specifiers) {
    const resolvedPath = resolveSpecifier(importerRelative, specifier, known)
    if (resolvedPath !== null) {
      if (!resolved.includes(resolvedPath)) resolved.push(resolvedPath)
    } else if (!specifier.startsWith('.')) {
      const packageName = packageNameOf(specifier)
      if (!external.includes(packageName)) external.push(packageName)
    } else if (!external.includes(specifier)) {
      external.push(specifier)
    }
  }
  return { specifiers, resolved, external }
}
