/**
 * 统一的 JSON 请求封装。
 * 脚本管理器环境下走 GM_xmlhttpRequest（不受页面跨域限制），否则退回 fetch。
 */
export interface HttpRequest {
	method?: 'GET' | 'POST';
	url: string;
	headers?: Record<string, string>;
	/** 会被序列化为 JSON 的请求体 */
	body?: unknown;
	timeoutMs?: number;
}

export class HttpError extends Error {
	constructor(
		message: string,
		public readonly status?: number
	) {
		super(message);
		this.name = 'HttpError';
	}
}

const DEFAULT_TIMEOUT = 30_000;

/** 从各家 API 的错误响应里取出可读的错误信息 */
export function describeErrorBody(text: string): string {
	if (!text) return '';
	try {
		const json = JSON.parse(text);
		const error = Array.isArray(json) ? json[0]?.error : json?.error;
		const message = typeof error === 'string' ? error : (error?.message ?? json?.message);
		if (typeof message === 'string' && message) return message;
	} catch {
		// 不是 JSON，直接截取原文
	}
	return text.replace(/\s+/g, ' ').trim().slice(0, 200);
}

function parseResponse<T>(status: number, text: string): T {
	if (status < 200 || status >= 300) {
		const detail = describeErrorBody(text);
		throw new HttpError(`请求失败（${status}）${detail ? '：' + detail : ''}`, status);
	}
	try {
		return JSON.parse(text) as T;
	} catch {
		throw new HttpError('响应不是有效的 JSON', status);
	}
}

export function requestJson<T = unknown>(req: HttpRequest): Promise<T> {
	const method = req.method ?? 'GET';
	const timeoutMs = req.timeoutMs ?? DEFAULT_TIMEOUT;
	const body = req.body === undefined ? undefined : JSON.stringify(req.body);

	if (typeof GM_xmlhttpRequest !== 'undefined') {
		return new Promise<T>((resolve, reject) => {
			GM_xmlhttpRequest({
				method,
				url: req.url,
				headers: req.headers ?? {},
				data: body,
				timeout: timeoutMs,
				onload: (response) => {
					try {
						resolve(parseResponse<T>(response.status, response.responseText ?? ''));
					} catch (error) {
						reject(error);
					}
				},
				onerror: () => reject(new HttpError('网络请求失败，请检查地址和网络')),
				ontimeout: () => reject(new HttpError(`请求超时（${Math.round(timeoutMs / 1000)} 秒）`)),
				onabort: () => reject(new HttpError('请求被中断')),
			});
		});
	}

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	return fetch(req.url, { method, headers: req.headers, body, signal: controller.signal })
		.then(async (response) => parseResponse<T>(response.status, await response.text()))
		.catch((error: unknown) => {
			if (error instanceof HttpError) throw error;
			if (error instanceof Error && error.name === 'AbortError') {
				throw new HttpError(`请求超时（${Math.round(timeoutMs / 1000)} 秒）`);
			}
			throw new HttpError('网络请求失败，请检查地址和网络');
		})
		.finally(() => clearTimeout(timer));
}
