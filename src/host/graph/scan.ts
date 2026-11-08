/**
 * Project file discovery for the code graph.
 *
 * Walks the project tree depth-first, respects .gitignore files per directory
 * (plus a fixed deny list of build/VCS directories), and yields the source
 * files the language server serves.
 * @module code-intel/graph/scan
 */
import { readFile, stat } from 'node:fs/promises'
import { join, relative, sep, dirname } from 'node:path'
import { IgnoreStack } from './ignore.ts'
import { languageIdOf } from '../lsp/client.ts'

/** Directories never indexed even without an ignore rule. */
const DENY_DIRECTORIES = [
  'node_modules',
  '.git',
  '.hg',
  '.svn',
  'dist',
  'build',
  'out',
  'coverage',
  '.next',
  '.nuxt',
  '.turbo',
  '.cache',
  '.dsh',
  '.idea',
  '.vscode',
]

export interface ScanResult {
  /** Project-relative POSIX paths of source files. */
  files: string[]
  /** Non-fatal scan problems. */
  errors: string[]
}

export interface ScanOptions {
  /** Maximum files to collect; excess is reported as an error. */
  maxFiles?: number
  /** Extra deny patterns in addition to the built-in list. */
  deny?: string[]
  /** Permit files listed by .gitignore when no ignore handling is wanted. */
  respectGitignore?: boolean
}

/** Discover source files under `root`. */
export async function scanProject(root: string, options: ScanOptions = {}): Promise<ScanResult> {
  const maxFiles = options.maxFiles ?? 20_000
  const files: string[] = []
  const errors: string[] = []
  const rootInfo = await stat(root).catch(() => null)
  if (!rootInfo || !rootInfo.isDirectory()) {
    return { files, errors: [`scan root is not a directory: ${root}`] }
  }

  const rootStack = new IgnoreStack()
  for (const deny of [...DENY_DIRECTORIES, ...(options.deny ?? [])]) {
    rootStack.addDeny(deny)
  }

  const walk = async (directory: string, stack: IgnoreStack): Promise<void> => {
    let entries: import('node:fs').Dirent[]
    try {
      const { readdir } = await import('node:fs/promises')
      entries = await readdir(directory, { withFileTypes: true })
    } catch (error) {
      errors.push(`cannot read directory ${relative(root, directory) || '.'}: ${String(error)}`)
      return
    }
    for (const entry of entries) {
      if (files.length > maxFiles) {
        errors.push(`file limit reached (${maxFiles}); scan truncated`)
        return
      }
      const entryPath = join(directory, entry.name)
      const relativeSegments = relative(root, entryPath).split(sep).filter((segment) => segment.length > 0)
      if (entry.isDirectory()) {
        if (stack.isIgnored(relativeSegments, true)) continue
        const childStack = new IgnoreStack(stack)
        const gitignore = await readFile(join(entryPath, '.gitignore'), 'utf8').catch(() => null)
        if (options.respectGitignore !== false && gitignore !== null) {
          childStack.addGitignore(gitignore)
        }
        await walk(entryPath, childStack)
      } else if (entry.isFile()) {
        if (stack.isIgnored(relativeSegments, false)) continue
        const relativePath = relativeSegments.join('/')
        if (languageIdOf(relativePath) !== null) {
          files.push(relativePath)
        }
      }
    }
  }

  const rootGitignore = await readFile(join(root, '.gitignore'), 'utf8').catch(() => null)
  if (rootGitignore !== null) rootStack.addGitignore(rootGitignore)
  await walk(root, rootStack)
  files.sort()
  return { files, errors }
}

/** Absolute path of a project-relative file. */
export function absolutePath(root: string, relativePath: string): string {
  return join(root, relativePath)
}

/** Parent directory of a project-relative path (POSIX). */
export function parentDirectory(relativePath: string): string {
  return dirname(relativePath)
}
