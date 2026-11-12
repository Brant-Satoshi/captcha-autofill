/**
 * 规则和禁用域名共用的模式匹配。
 * 支持三种写法：/正则/、带 * 的通配符、普通字符串。
 */
const wildcardToRegExp = (pattern: string) =>
	new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');

const asRegExp = (pattern: string): RegExp | null => {
	if (pattern.length > 2 && pattern.startsWith('/') && pattern.endsWith('/')) {
		return new RegExp(pattern.slice(1, -1));
	}
	return null;
};

export interface PageLocation {
	href: string;
	hostname: string;
}

/**
 * 规则的 url_pattern 是否匹配当前页面。
 * - 空或 "*"：所有网站
 * - /正则/：对完整 URL 做正则匹配
 * - 含 *：通配符，对完整 URL 或域名做整体匹配（所以 "*.example.org" 能按域名生效）
 * - 其他：URL 中包含该字符串即匹配
 */
export function matchesUrlPattern(pattern: string | undefined, loc: PageLocation): boolean {
	const value = (pattern ?? '').trim();
	if (!value || value === '*') return true;
	try {
		const regex = asRegExp(value);
		if (regex) return regex.test(loc.href);
		if (value.includes('*')) {
			const wildcard = wildcardToRegExp(value);
			return wildcard.test(loc.href) || wildcard.test(loc.hostname);
		}
	} catch (error) {
		console.error('无效的规则模式：', value, error);
		return false;
	}
	return loc.href.includes(value);
}

/**
 * 域名是否在禁用列表中。列表每行一项：
 * - /正则/：对域名做正则匹配
 * - 含 *：通配符，对域名做整体匹配
 * - 其他：与域名完全相同才匹配
 */
export function isDomainDisabled(list: string | undefined, hostname: string): boolean {
	if (!list) return false;
	return list
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean)
		.some((entry) => {
			try {
				const regex = asRegExp(entry);
				if (regex) return regex.test(hostname);
				if (entry.includes('*')) return wildcardToRegExp(entry).test(hostname);
			} catch (error) {
				console.error('无效的禁用域名模式：', entry, error);
				return false;
			}
			return entry === hostname;
		});
}
