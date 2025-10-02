// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { type Config } from 'dompurify';

declare module 'isomorphic-dompurify' {
  interface Config {
    ALLOWED_TAGS?: string[];
    ALLOWED_ATTR?: string[];
    FORBID_TAGS?: string[];
    FORBID_ATTR?: string[];
    ALLOW_DATA_ATTR?: boolean;
    ALLOW_UNKNOWN_PROTOCOLS?: boolean;
    SAFE_FOR_TEMPLATES?: boolean;
    WHOLE_DOCUMENT?: boolean;
    RETURN_DOM?: boolean;
    RETURN_DOM_FRAGMENT?: boolean;
    RETURN_DOM_IMPORT?: boolean;
    RETURN_TRUSTED_TYPE?: boolean;
    FORCE_BODY?: boolean;
    SANITIZE_DOM?: boolean;
    KEEP_CONTENT?: boolean;
    IN_PLACE?: boolean;
    USE_PROFILES?: false | { mathMl?: boolean; svg?: boolean; svgFilters?: boolean; html?: boolean };
    [key: string]: unknown;
  }

  interface DOMPurify {
    sanitize(dirty: string | Node, config?: Config): string;
    sanitize(dirty: string | Node, config: Config & { RETURN_DOM_FRAGMENT: true }): DocumentFragment;
    sanitize(dirty: string | Node, config: Config & { RETURN_DOM: true }): HTMLElement;
    addHook(entryPoint: string, hookFunction: (currentNode?: Element, data?: unknown, config?: Config) => void): void;
    removeHook(entryPoint: string): void;
    removeHooks(entryPoint: string): void;
    removeAllHooks(): void;
    isSupported: boolean;
    removed: unknown[];
    version: string;
    setConfig(config: Config): void;
    clearConfig(): void;
    isValidAttribute(tag: string, attr: string, value: string): boolean;
  }

  const DOMPurify: DOMPurify;
  export default DOMPurify;
}
