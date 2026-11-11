import type { CodeIntelApi } from './remote.ts';
export interface SymbolBrowserProps {
    /** The code-intel remote API injected by the client entry. */
    api: CodeIntelApi;
}
export declare const SymbolBrowser: import("react").NamedExoticComponent<SymbolBrowserProps>;
