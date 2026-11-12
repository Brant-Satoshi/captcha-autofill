import { describe, expect, it } from 'vitest';
import { isDomainDisabled, matchesUrlPattern } from '../src/core/pattern';

const loc = { href: 'https://login.example.org/auth?next=/home', hostname: 'login.example.org' };

describe('matchesUrlPattern', () => {
	it('空值和 * 匹配所有网站', () => {
		expect(matchesUrlPattern('', loc)).toBe(true);
		expect(matchesUrlPattern(undefined, loc)).toBe(true);
		expect(matchesUrlPattern('*', loc)).toBe(true);
	});

	it('普通字符串按「URL 包含」匹配', () => {
		expect(matchesUrlPattern('example.org', loc)).toBe(true);
		expect(matchesUrlPattern('example.com', loc)).toBe(false);
	});

	it('通配符可以按域名匹配，也可以按完整 URL 匹配', () => {
		expect(matchesUrlPattern('*.example.org', loc)).toBe(true);
		expect(matchesUrlPattern('https://*.example.org/auth*', loc)).toBe(true);
		expect(matchesUrlPattern('*.example.com', loc)).toBe(false);
	});

	it('/正则/ 对完整 URL 匹配，写错时不抛错', () => {
		expect(matchesUrlPattern('/^https:\\/\\/login\\./', loc)).toBe(true);
		expect(matchesUrlPattern('/^http:\\/\\//', loc)).toBe(false);
		expect(matchesUrlPattern('/([/', loc)).toBe(false);
	});
});

describe('isDomainDisabled', () => {
	it('空列表不禁用', () => {
		expect(isDomainDisabled('', 'a.com')).toBe(false);
		expect(isDomainDisabled(undefined, 'a.com')).toBe(false);
	});

	it('普通条目要求域名完全相同', () => {
		expect(isDomainDisabled('example.com', 'example.com')).toBe(true);
		expect(isDomainDisabled('example.com', 'www.example.com')).toBe(false);
	});

	it('支持通配符、正则和多行', () => {
		const list = ' foo.com \n*.example.org\n/^(www\\.)?bar\\.com$/\n';
		expect(isDomainDisabled(list, 'foo.com')).toBe(true);
		expect(isDomainDisabled(list, 'a.example.org')).toBe(true);
		expect(isDomainDisabled(list, 'www.bar.com')).toBe(true);
		expect(isDomainDisabled(list, 'baz.com')).toBe(false);
	});
});
