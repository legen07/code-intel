export declare const CODE_INTEL_REMOTE: import("@deepseek-ai/dsh-typert-protocol").TypertRemoteInfo<Readonly<Record<string, import("@deepseek-ai/dsh-typert-protocol").TypertRemoteMethod<object, unknown, "unary", never, unknown> | import("@deepseek-ai/dsh-typert-protocol").TypertRemoteMethod<object, unknown, "stream", unknown, unknown>>>>;
export interface CodeIntelRemoteApi {
    query: (op: string, args?: Record<string, unknown>, signal?: AbortSignal) => Promise<unknown>;
}
/** Typed wrappers over the envelope method shared by the panel. */
export declare function codeIntelApi(query: (op: string, args?: Record<string, unknown>, signal?: AbortSignal) => Promise<unknown>): {
    blueprint: (signal?: AbortSignal) => Promise<unknown>;
    status: (signal?: AbortSignal) => Promise<unknown>;
    overview: (file: string, depth?: number, signal?: AbortSignal) => Promise<unknown>;
    search: (pattern: string, options?: {
        substring?: boolean;
        relativePath?: string;
        maxMatches?: number;
    }, signal?: AbortSignal) => Promise<unknown>;
    details: (namePath: string, options?: {
        relativePath?: string;
        includeBody?: boolean;
    }, signal?: AbortSignal) => Promise<unknown>;
    references: (namePath: string, options?: {
        relativePath?: string;
    }, signal?: AbortSignal) => Promise<unknown>;
    implementations: (namePath: string, options?: {
        relativePath?: string;
    }, signal?: AbortSignal) => Promise<unknown>;
    diagnostics: (file?: string, signal?: AbortSignal) => Promise<unknown>;
    refresh: (signal?: AbortSignal) => Promise<unknown>;
};
export type CodeIntelApi = ReturnType<typeof codeIntelApi>;
