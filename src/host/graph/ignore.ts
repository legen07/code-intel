/**
 * A minimal .gitignore pattern engine.
 *
 * Enough of the gitignore semantics to scan a project without descending into
 * `node_modules`: per-directory inheritance, negation, trailing-slash
 * directory rules, anchored patterns, and `**` segments.
 * @module code-intel/graph/ignore
 */

interface IgnorePattern {
  source: string
  negated: boolean
  directoryOnly: boolean
  anchored: boolean
  segments: string[]
}

function parsePattern(line: string): IgnorePattern | null {
  let source = line.trim()
  if (source.length === 0 || source.startsWith('#')) return null
  const negated = source.startsWith('!')
  if (negated) source = source.slice(1)
  // Trailing spaces escaped with backslash survive; plain ones are trimmed.
  source = source.replace(/(?<!\\)\s+$/, '')
  const directoryOnly = source.endsWith('/')
  if (directoryOnly) source = source.slice(0, -1)
  const anchored = source.startsWith('/')
  if (anchored) source = source.slice(1)
  if (source.length === 0) return null
  return { source: line, negated, directoryOnly, anchored, segments: source.split('/') }
}

function matchSegment(segment: string, pattern: string): boolean {
  if (!pattern.includes('*') && !pattern.includes('?') && !pattern.includes('[')) {
    return segment === pattern
  }
  // fnmatch-style: `*` and `?` (no brace expansion), `**` handled by caller.
  const regex = new RegExp(
    '^' +
      pattern
        .split('')
        .map((char) => {
          if (char === '*') return '.*'
          if (char === '?') return '.'
          if (char === '.') return '\\.'
          return char.replace(/[()+^$|{}\\[\]]/g, '\\$&')
        })
        .join('') +
      '$',
  )
  return regex.test(segment)
}

/**
 * One directory's ignore state: its own patterns plus its parent's, so a rule
 * in the project root applies below while a deeper negation can re-admit.
 */
export class IgnoreStack {
  private patterns: IgnorePattern[] = []
  private readonly ancestors: IgnoreStack | null

  constructor(ancestors: IgnoreStack | null = null) {
    this.ancestors = ancestors
  }

  /** Parse a .gitignore body into this directory's pattern list. */
  addGitignore(body: string): void {
    for (const line of body.split(/\r?\n/)) {
      const pattern = parsePattern(line)
      if (pattern) this.patterns.push(pattern)
    }
  }

  /** Add raw deny patterns (server-ignored directories). */
  addDeny(pattern: string): void {
    const parsed = parsePattern(pattern)
    if (parsed) this.patterns.push(parsed)
  }

  /**
   * Decide whether `segments` (relative to this stack's directory, excluding it)
   * is ignored. The last win rule applies within each level; ancestor rules
   * participate only when descendants do not override them.
   */
  isIgnored(segments: string[], isDirectory: boolean): boolean {
    const own = this.matchOwn(segments, isDirectory)
    if (own !== undefined) return own
    return this.ancestors?.isIgnored(segments, isDirectory) ?? false
  }

  private matchOwn(segments: string[], isDirectory: boolean): boolean | undefined {
    let ignored: boolean | undefined
    for (const pattern of this.patterns) {
      if (pattern.directoryOnly && !isDirectory) continue
      if (this.matchesPattern(pattern, segments)) {
        ignored = pattern.negated ? false : true
      }
    }
    return ignored
  }

  private matchesPattern(pattern: IgnorePattern, segments: string[]): boolean {
    if (pattern.segments.length === 1 && !pattern.segments[0]!.includes('**')) {
      // Single-segment rule: matches at any depth unless anchored.
      const target = pattern.anchored ? (segments.length === 1 ? segments[0]! : null) : segments[segments.length - 1]!
      return target !== null && matchSegment(target, pattern.segments[0]!)
    }
    return this.matchGlob(pattern.segments, 0, segments, 0)
  }

  /**
   * Segment walk mirroring git's `**` semantics: `**` matches zero or more
   * whole segments, `*` inside a segment matches within it.
   */
  private matchGlob(patternSegments: string[], pi: number, segments: string[], si: number): boolean {
    while (pi < patternSegments.length) {
      const patternSegment = patternSegments[pi]!
      if (patternSegment === '**') {
        if (pi === patternSegments.length - 1) return true
        for (let skip = si; skip <= segments.length; skip++) {
          if (this.matchGlob(patternSegments, pi + 1, segments, skip)) return true
        }
        return false
      }
      if (si >= segments.length) return false
      if (!matchSegment(segments[si]!, patternSegment)) return false
      pi++
      si++
    }
    return si === segments.length
  }
}
