export interface ScanResult {
    /** Project-relative POSIX paths of source files. */
    files: string[];
    /** Non-fatal scan problems. */
    errors: string[];
}
export interface ScanOptions {
    /** Maximum files to collect; excess is reported as an error. */
    maxFiles?: number;
    /** Extra deny patterns in addition to the built-in list. */
    deny?: string[];
    /** Permit files listed by .gitignore when no ignore handling is wanted. */
    respectGitignore?: boolean;
}
/** Discover source files under `root`. */
export declare function scanProject(root: string, options?: ScanOptions): Promise<ScanResult>;
/** Absolute path of a project-relative file. */
export declare function absolutePath(root: string, relativePath: string): string;
/** Parent directory of a project-relative path (POSIX). */
export declare function parentDirectory(relativePath: string): string;
