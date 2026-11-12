/**
 * 持久化存储：脚本管理器环境下用 GM 存储（跨网站共享），
 * 开发和测试环境下退回 localStorage。
 */
const LOCAL_PREFIX = 'captcha-autofill:';

const hasGM = () => typeof GM_getValue !== 'undefined' && typeof GM_setValue !== 'undefined';

export function readStore<T>(key: string): T | undefined {
	try {
		if (hasGM()) {
			const value = GM_getValue<unknown>(key);
			// 兼容以字符串形式保存的 JSON
			return (typeof value === 'string' ? JSON.parse(value) : value) as T | undefined;
		}
		const raw = localStorage.getItem(LOCAL_PREFIX + key);
		return raw ? (JSON.parse(raw) as T) : undefined;
	} catch (error) {
		console.error(`读取存储 ${key} 失败：`, error);
		return undefined;
	}
}

export function writeStore(key: string, value: unknown): void {
	const json = JSON.stringify(value);
	if (hasGM()) {
		GM_setValue(key, json);
	} else {
		localStorage.setItem(LOCAL_PREFIX + key, json);
	}
}
