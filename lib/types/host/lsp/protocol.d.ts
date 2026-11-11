/**
 * JSON-RPC 2.0 framing over stdio for the Language Server Protocol.
 *
 * A native TypeScript port of the transport half of solidlsp's LSP handling:
 * Content-Length framed messages written to the child process stdin and parsed
 * back from its stdout. Length-prefixed reading is incremental so partial
 * frames across chunk boundaries resolve correctly.
 * @module code-intel/lsp/protocol
 */
import { EventEmitter } from 'node:events';
export interface JsonRpcRequest {
    jsonrpc: '2.0';
    id: number;
    method: string;
    params?: unknown;
}
export interface JsonRpcNotification {
    jsonrpc: '2.0';
    method: string;
    params?: unknown;
}
export interface JsonRpcResponse {
    jsonrpc: '2.0';
    id: number;
    result?: unknown;
    error?: {
        code: number;
        message: string;
        data?: unknown;
    };
}
export type JsonRpcMessage = JsonRpcRequest | JsonRpcNotification | JsonRpcResponse;
export interface ProtocolLogger {
    debug?(message: string): void;
    warn?(message: string): void;
}
/** Generic disposal handle for event subscriptions. */
export interface Disposable {
    dispose(): void;
}
/** Encode one JSON-RPC message as a Content-Length frame. */
export declare function encodeMessage(message: JsonRpcMessage): string;
/**
 * Incremental parser for Content-Length framed JSON-RPC streams.
 *
 * Feed stdout chunks with {@link push}; complete frames surface as
 * `message` events. Bytes that precede a valid header (server banners, for
 * example) are skipped so a stray prefix cannot desynchronize the stream.
 */
export declare class LspFrameParser extends EventEmitter {
    private buffer;
    push(chunk: Buffer | string): void;
}
