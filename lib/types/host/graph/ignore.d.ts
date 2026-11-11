/**
 * A minimal .gitignore pattern engine.
 *
 * Enough of the gitignore semantics to scan a project without descending into
 * `node_modules`: per-directory inheritance, negation, trailing-slash
 * directory rules, anchored patterns, and `**` segments.
 * @module code-intel/graph/ignore
 */
/**
 * One directory's ignore state: its own patterns plus its parent's, so a rule
 * in the project root applies below while a deeper negation can re-admit.
 */
export declare class IgnoreStack {
    private patterns;
    private readonly ancestors;
    constructor(ancestors?: IgnoreStack | null);
    /** Parse a .gitignore body into this directory's pattern list. */
    addGitignore(body: string): void;
    /** Add raw deny patterns (server-ignored directories). */
    addDeny(pattern: string): void;
    /**
     * Decide whether `segments` (relative to this stack's directory, excluding it)
     * is ignored. The last win rule applies within each level; ancestor rules
     * participate only when descendants do not override them.
     */
    isIgnored(segments: string[], isDirectory: boolean): boolean;
    private matchOwn;
    private matchesPattern;
    /**
     * Segment walk mirroring git's `**` semantics: `**` matches zero or more
     * whole segments, `*` inside a segment matches within it.
     */
    private matchGlob;
}
