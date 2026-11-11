/**
 * The Web Client entry of the code-intel plugin.
 *
 * Mounts the code-intel remote contribution, then — once the remote and the
 * browser services are live — registers the symbol-browser tab type with the
 * right-sidebar tab registry and its body component in the keyed
 * `sidebar.right.pane.tab` slot. Unmounting withdraws the UI first, then the
 * remote, mirroring the shipped panel plugins.
 * @module code-intel/client
 */
import type { Context } from '@deepseek-ai/cordis';
/** Registry id of the symbol-browser tab type, also its slot key. */
export declare const TAB_ID = "code-intel";
/** Kind discriminator of the symbol-browser tab. */
export declare const TAB_KIND = "code-intel-symbols";
/**
 * Browser services the entry needs before it applies.
 *
 * The Loader keeps the entry fiber pending until every listed service is
 * provided, so `apply` may read `ctx.remote`, `ctx.locale`, `ctx.slots`, and
 * `ctx.sidebarRightTabs` directly — the contract every shipped Client panel
 * plugin relies on. The one service that cannot land here is
 * `remote.codeIntel`: that namespace is created by this plugin's own remote
 * mount, so the UI waits for it inside the transport plugin instead.
 */
export declare const inject: string[];
/**
 * Mount the code-intel remote, then the symbol-browser UI that calls it.
 *
 * The remote mount runs inside its own plugin because the `remote.codeIntel`
 * service it installs is what the UI registration waits for; the transport's
 * disposers withdraw both when the entry unloads.
 * @param ctx - browser plugin context.
 * @returns the disposer that withdraws the transport.
 */
export declare function apply(ctx: Context): Promise<() => Promise<void>>;
