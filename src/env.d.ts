/// <reference types="vite/client" />

/** 脚本管理器（Tampermonkey / Violentmonkey）注入的 API，开发和测试环境下可能不存在 */
interface GMXhrResponse {
	status: number;
	statusText?: string;
	responseText: string;
}

interface GMXhrDetails {
	method: string;
	url: string;
	headers?: Record<string, string>;
	data?: string;
	timeout?: number;
	onload?: (response: GMXhrResponse) => void;
	onerror?: (error: unknown) => void;
	ontimeout?: () => void;
	onabort?: () => void;
}

declare function GM_xmlhttpRequest(details: GMXhrDetails): void;
declare function GM_getValue<T = unknown>(key: string, defaultValue?: T): T;
declare function GM_setValue(key: string, value: unknown): void;
declare function GM_registerMenuCommand(name: string, handler: () => void): unknown;
