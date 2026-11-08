/**
 * The symbol browser: the code-intel sidebar panel.
 *
 * A React component mounted under the right-sidebar `sidebar.right.pane.tab`
 * slot. It fetches the project blueprint through the code-intel remote and
 * offers search, module overviews, symbol details, references, and
 * diagnostics — the browser face of the same graph the agent reaches through
 * the code-intel tools.
 * @module code-intel/client/panel
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ComponentType } from 'react'
import type { CodeIntelApi } from './remote.ts'

interface Blueprint {
  rootPath: string
  fileCount: number
  symbolCount: number
  countsByKind: Record<string, number>
  exportedSymbolCount: number
  modules: Array<{
    path: string
    language: string
    symbolCount: number
    exportedSymbols: string[]
    imports: string[]
    externalImports: string[]
  }>
  dependencies: Array<{ from: string; to: string }>
  externalDependencies: Array<{ name: string; importedBy: number }>
  entryPoints: string[]
  errors: string[]
  generatedAt: string
  fromCache: boolean
}

interface SymbolHit {
  id: string
  name: string
  namePath: string
  kind: number
  kindName: string
  file: string
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
  exported: boolean
  async: boolean
  static: boolean
  detail: string | null
}

interface OverviewEntry {
  name: string
  kind: number
  kindName: string
  startLine: number
  endLine: number
  exported: boolean
  detail: string | null
  children: OverviewEntry[]
}

interface SymbolDetails {
  symbol: SymbolHit
  container: { namePath: string; kindName: string } | null
  children: Array<{ namePath: string; kindName: string }>
  hover: string | null
  body: string | null
}

type View =
  | { kind: 'blueprint' }
  | { kind: 'module'; path: string }
  | { kind: 'symbol'; namePath: string; file?: string }
  | { kind: 'references'; namePath: string; file?: string }
  | { kind: 'implementations'; namePath: string; file?: string }

export interface SymbolBrowserProps {
  /** The code-intel remote API injected by the client entry. */
  api: CodeIntelApi
}

const PANEL_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
  fontSize: 12,
  color: 'var(--dsh-fg, inherit)',
  backgroundColor: 'var(--dsh-bg, transparent)',
}

export const SymbolBrowser = memo(function SymbolBrowser({ api }: SymbolBrowserProps) {
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null)
  const [view, setView] = useState<View>({ kind: 'blueprint' })
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const loadBlueprint = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = (await api.blueprint()) as Blueprint
      setBlueprint(data)
    } catch (failed) {
      setError(String(failed))
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    void loadBlueprint()
  }, [loadBlueprint])

  return (
    <div style={PANEL_STYLE}>
      <BrowserHeader blueprint={blueprint} loading={loading} onRefresh={() => void loadBlueprint()} />
      <SearchBox
        api={api}
        value={query}
        onChange={setQuery}
        onSelect={(hit) => setView({ kind: 'symbol', namePath: hit.namePath, file: hit.file })}
      />
      {error !== null && <ErrorRow message={error} />}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 8px 8px' }}>
        {view.kind === 'blueprint' && blueprint !== null && (
          <BlueprintView blueprint={blueprint} onOpenModule={(path) => setView({ kind: 'module', path })} />
        )}
        {view.kind === 'module' && <ModuleView api={api} path={view.path} onOpenSymbol={(namePath) => setView({ kind: 'symbol', namePath, file: view.path })} />}
        {view.kind === 'symbol' && (
          <SymbolView
            api={api}
            namePath={view.namePath}
            file={view.file}
            onReferences={() => setView({ kind: 'references', namePath: view.namePath, file: view.file })}
            onImplementations={() => setView({ kind: 'implementations', namePath: view.namePath, file: view.file })}
          />
        )}
        {view.kind === 'references' && <ReferencesView api={api} namePath={view.namePath} file={view.file} />}
        {view.kind === 'implementations' && <ImplementationsView api={api} namePath={view.namePath} file={view.file} />}
      </div>
      <BrowserBreadcrumb view={view} onHome={() => setView({ kind: 'blueprint' })} />
    </div>
  )
})

function BrowserHeader({ blueprint, loading, onRefresh }: { blueprint: Blueprint | null; loading: boolean; onRefresh: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px 6px', borderBottom: '1px solid var(--dsh-border, #333)' }}>
      <strong style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        Code-Intel
      </strong>
      {blueprint !== null && (
        <span title={`${blueprint.fileCount} files, ${blueprint.symbolCount} symbols${blueprint.fromCache ? ' (cached)' : ''}`}>
          {blueprint.symbolCount} symbols · {blueprint.fileCount} files
        </span>
      )}
      <button onClick={onRefresh} disabled={loading} style={buttonStyle} title="Rebuild the project blueprint">
        {loading ? '…' : '↻'}
      </button>
    </div>
  )
}

function SearchBox({ api, value, onChange, onSelect }: { api: CodeIntelApi; value: string; onChange: (value: string) => void; onSelect: (hit: SymbolHit) => void }) {
  const [hits, setHits] = useState<SymbolHit[]>([])
  const [active, setActive] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    if (value.trim().length < 2) {
      setHits([])
      return
    }
    debounce.current = setTimeout(async () => {
      try {
        const results = (await api.search(value.trim(), { substring: true, maxMatches: 50 })) as SymbolHit[]
        setHits(results)
        setActive(true)
      } catch {
        setHits([])
      }
    }, 250)
    return () => {
      if (debounce.current) clearTimeout(debounce.current)
    }
  }, [value, api])

  return (
    <div style={{ padding: '6px 8px', position: 'relative' }}>
      <input
        value={value}
        placeholder="Search symbols…"
        onChange={(event) => onChange(event.currentTarget.value)}
        onBlur={() => setTimeout(() => setActive(false), 150)}
        onFocus={() => setActive(true)}
        style={{ width: '100%', boxSizing: 'border-box', padding: '4px 6px', borderRadius: 4, border: '1px solid var(--dsh-border, #333)', background: 'var(--dsh-input-bg, transparent)', color: 'inherit' }}
      />
      {active && hits.length > 0 && (
        <div style={resultsStyle}>
          {hits.slice(0, 30).map((hit) => (
            <button key={hit.id} style={resultRowStyle} onMouseDown={() => onSelect(hit)} title={`${hit.namePath} · ${hit.file}:${hit.startLine}`}>
              <span style={{ fontWeight: 600 }}>{hit.name}</span>
              <span style={{ opacity: 0.66 }}> {hit.kindName} · {hit.file}:{hit.startLine}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const resultRowStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '3px 6px',
  background: 'none',
  border: 'none',
  color: 'inherit',
  cursor: 'pointer',
}

const resultsStyle: CSSProperties = {
  position: 'absolute',
  zIndex: 5,
  left: 8,
  right: 8,
  maxHeight: 280,
  overflow: 'auto',
  background: 'var(--dsh-popover-bg, #1e1e1e)',
  border: '1px solid var(--dsh-border, #333)',
  borderRadius: 4,
  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
}

function BlueprintView({ blueprint, onOpenModule }: { blueprint: Blueprint; onOpenModule: (path: string) => void }) {
  const kindSummary = Object.entries(blueprint.countsByKind)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
  return (
    <div>
      <Summary label="Entry points" value={blueprint.entryPoints.slice(0, 10).join(', ') || '—'} />
      <Summary label="External dependencies" value={blueprint.externalDependencies.slice(0, 12).map((dependency) => `${dependency.name} (${dependency.importedBy})`).join(', ') || '—'} />
      <div style={groupStyle}>
        <div style={groupTitleStyle}>Symbols</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {kindSummary.map(([kind, count]) => (
            <span key={kind} style={chipStyle} title={`${count} ${kind} symbols`}>
              {kind}: {count}
            </span>
          ))}
        </div>
      </div>
      <div style={groupStyle}>
        <div style={groupTitleStyle}>Modules ({blueprint.modules.length})</div>
        {blueprint.modules.map((module) => (
          <button key={module.path} style={moduleRowStyle} onClick={() => onOpenModule(module.path)} title={`${module.symbolCount} symbols, ${module.exportedSymbols.length} exported`}>
            <span style={{ fontWeight: 600 }}>{module.path}</span>
            <span style={{ opacity: 0.66 }}> · {module.symbolCount}</span>
            {module.exportedSymbols.length > 0 && <span style={{ opacity: 0.66 }}> ⤴ {module.exportedSymbols.length}</span>}
          </button>
        ))}
      </div>
      {blueprint.errors.length > 0 && (
        <div style={groupStyle}>
          <div style={groupTitleStyle}>Problems</div>
          {blueprint.errors.map((message, index) => (
            <div key={index} style={{ opacity: 0.75, paddingTop: 2 }}>{message}</div>
          ))}
        </div>
      )}
    </div>
  )
}

function ModuleView({ api, path, onOpenSymbol }: { api: CodeIntelApi; path: string; onOpenSymbol: (namePath: string) => void }) {
  const [entries, setEntries] = useState<OverviewEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .overview(path)
      .then((data) => {
        if (!cancelled) {
          setEntries(data as OverviewEntry[])
          setError(null)
        }
      })
      .catch((failed) => {
        if (!cancelled) setError(String(failed))
      })
    return () => {
      cancelled = true
    }
  }, [api, path])

  if (error !== null) return <ErrorRow message={error} />
  if (entries === null) return <Placeholder text="Loading symbols…" />
  return (
    <div>
      <div style={groupTitleStyle}>{path}</div>
      <Tree entries={entries} depth={0} onOpenSymbol={onOpenSymbol} />
    </div>
  )
}

function Tree({ entries, depth, onOpenSymbol }: { entries: OverviewEntry[]; depth: number; onOpenSymbol: (namePath: string) => void }) {
  return (
    <div style={{ paddingLeft: depth > 0 ? 10 : 0 }}>
      {entries.map((entry, index) => (
        <div key={`${entry.name}-${index}`}>
          <button style={symbolRowStyle} onClick={() => onOpenSymbol(entry.name)}>
            <span style={{ fontWeight: 600 }}>{entry.name}</span>
            <span style={{ opacity: 0.66 }}> {entry.kindName}{entry.exported ? ' · export' : ''} :{entry.startLine}</span>
            {entry.detail !== null && <span style={{ opacity: 0.5 }}> {entry.detail}</span>}
          </button>
          {entry.children.length > 0 && <Tree entries={entry.children} depth={depth + 1} onOpenSymbol={onOpenSymbol} />}
        </div>
      ))}
    </div>
  )
}

function SymbolView({ api, namePath, file, onReferences, onImplementations }: { api: CodeIntelApi; namePath: string; file?: string; onReferences: () => void; onImplementations: () => void }) {
  const [details, setDetails] = useState<SymbolDetails | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .details(namePath, { relativePath: file, includeBody: true })
      .then((data) => {
        if (!cancelled) {
          setDetails(data as SymbolDetails)
          setError(null)
        }
      })
      .catch((failed) => {
        if (!cancelled) setError(String(failed))
      })
    return () => {
      cancelled = true
    }
  }, [api, namePath, file])

  if (error !== null) return <ErrorRow message={error} />
  if (details === null) return <Placeholder text="Loading symbol…" />
  const { symbol } = details
  return (
    <div>
      <div style={groupTitleStyle}>{symbol.namePath}</div>
      <div style={{ display: 'flex', gap: 6, padding: '4px 0' }}>
        <button style={buttonStyle} onClick={onReferences}>References</button>
        <button style={buttonStyle} onClick={onImplementations}>Implementations</button>
      </div>
      <Summary label="Kind" value={`${symbol.kindName} (${symbol.kind})`} />
      <Summary label="Location" value={`${symbol.file}:${symbol.startLine}:${symbol.startColumn}–${symbol.endLine}:${symbol.endColumn}`} />
      <Summary label="Modifiers" value={[symbol.exported && 'exported', symbol.async && 'async', symbol.static && 'static'].filter(Boolean).join(', ') || 'none'} />
      <Summary label="Container" value={details.container ? `${details.container.namePath} (${details.container.kindName})` : '—'} />
      <Summary label="Children" value={details.children.map((child) => child.namePath).join(', ') || '—'} />
      <Summary label="Signature" value={details.hover ?? symbol.detail ?? '—'} />
      {details.body !== null && (
        <div style={groupStyle}>
          <div style={groupTitleStyle}>Body</div>
          <pre style={preStyle}>{details.body}</pre>
        </div>
      )}
    </div>
  )
}

function ReferencesView({ api, namePath, file }: { api: CodeIntelApi; namePath: string; file?: string }) {
  return <CallSitesView api={api} operation="references" namePath={namePath} file={file} field="references" title="References" />
}

function ImplementationsView({ api, namePath, file }: { api: CodeIntelApi; namePath: string; file?: string }) {
  return <CallSitesView api={api} operation="implementations" namePath={namePath} file={file} field="implementations" title="Implementations" />
}

function CallSitesView({ api, operation, namePath, file, field, title }: { api: CodeIntelApi; operation: 'references' | 'implementations'; namePath: string; file?: string; field: 'references' | 'implementations'; title: string }) {
  const [rows, setRows] = useState<Array<{ namePath: string; file: string; line: number; column: number; snippet?: string | null }> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api[operation](namePath, { relativePath: file })
      .then((data) => {
        if (cancelled) return
        const result = data as Array<{ symbol: SymbolHit; references: Array<{ namePath: string; file: string; line: number; column: number; snippet?: string | null }>; implementations: Array<{ namePath: string; file: string; line: number; column: number }> }>
        setError(null)
        setRows(result.flatMap((entry) => entry[field]))
      })
      .catch((failed) => {
        if (!cancelled) setError(String(failed))
      })
    return () => {
      cancelled = true
    }
  }, [api, operation, namePath, file, field])

  if (error !== null) return <ErrorRow message={error} />
  if (rows === null) return <Placeholder text={`Loading ${title.toLowerCase()}…`} />
  return (
    <div>
      <div style={groupTitleStyle}>{title} ({rows.length})</div>
      {rows.length === 0 && <Placeholder text="No results." />}
      {rows.map((row, index) => (
        <div key={index} style={{ padding: '3px 0', borderBottom: '1px solid var(--dsh-border, #2a2a2a)' }}>
          <div style={{ fontWeight: 600 }}>{row.namePath}</div>
          <div style={{ opacity: 0.66 }}>{row.file}:{row.line}:{row.column}</div>
          {row.snippet && <pre style={{ ...preStyle, opacity: 0.8 }}>{row.snippet.trim()}</pre>}
        </div>
      ))}
    </div>
  )
}

function BrowserBreadcrumb({ view, onHome }: { view: View; onHome: () => void }) {
  const label = useMemo(() => {
    switch (view.kind) {
      case 'blueprint':
        return 'Blueprint'
      case 'module':
        return `Module · ${view.path}`
      case 'symbol':
        return `Symbol · ${view.namePath}`
      case 'references':
        return `References · ${view.namePath}`
      case 'implementations':
        return `Implementations · ${view.namePath}`
    }
  }, [view])
  return (
    <div style={{ borderTop: '1px solid var(--dsh-border, #333)', padding: '4px 8px', opacity: 0.75 }}>
      {view.kind === 'blueprint' ? <span>{label}</span> : <button onClick={onHome} style={{ ...linkStyle }}>‹ Blueprint</button>}
      {' · '}
      <span>{label}</span>
    </div>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '2px 0' }}>
      <span style={{ opacity: 0.66 }}>{label}: </span>
      <span>{value}</span>
    </div>
  )
}

function Placeholder({ text }: { text: string }) {
  return <div style={{ padding: 8, opacity: 0.66 }}>{text}</div>
}

function ErrorRow({ message }: { message: string }) {
  return <div style={{ padding: 8, color: 'var(--dsh-danger, #e55)' }}>{message}</div>
}

const buttonStyle: CSSProperties = {
  padding: '2px 8px',
  borderRadius: 4,
  border: '1px solid var(--dsh-border, #333)',
  background: 'var(--dsh-button-bg, transparent)',
  color: 'inherit',
  cursor: 'pointer',
}

const linkStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'inherit',
  cursor: 'pointer',
  padding: 0,
}

const chipStyle: CSSProperties = {
  padding: '1px 6px',
  borderRadius: 10,
  border: '1px solid var(--dsh-border, #333)',
}

const groupStyle: CSSProperties = {
  paddingTop: 8,
}

const groupTitleStyle: CSSProperties = {
  fontWeight: 700,
  fontSize: 11,
  textTransform: 'uppercase',
  opacity: 0.75,
  padding: '6px 0 2px',
}

const moduleRowStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '3px 4px',
  background: 'none',
  border: 'none',
  color: 'inherit',
  cursor: 'pointer',
}

const symbolRowStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '2px 4px',
  background: 'none',
  border: 'none',
  color: 'inherit',
  cursor: 'pointer',
}

const preStyle: CSSProperties = {
  margin: '4px 0',
  padding: 4,
  background: 'var(--dsh-code-bg, rgba(127,127,127,0.08))',
  borderRadius: 4,
  overflow: 'auto',
  fontSize: 11,
  whiteSpace: 'pre-wrap',
}

