import builtinRules from '../../rules.json';
import { requestJson } from './http';
import { matchesUrlPattern, type PageLocation } from './pattern';
import type { Settings } from './settings';
import { readStore, writeStore } from './storage';

/** 一条站点规则：在匹配的网址上，用这些选择器找验证码图片和输入框 */
export interface Rule {
	url_pattern?: string;
	captcha_image_selector: string;
	captcha_input_selector?: string;
}

export interface RuleSet {
	rules: Rule[];
	/** builtin：随脚本打包的规则；remote：从远程地址拉取并缓存的规则 */
	source: 'builtin' | 'remote';
}

const RULES_KEY = 'rules';
const FETCHED_ON_KEY = 'rulesFetchedOn';

/** 过滤掉格式不对的条目 */
export function sanitizeRules(input: unknown): Rule[] {
	if (!Array.isArray(input)) return [];
	return input
		.filter(
			(item): item is Rule =>
				!!item && typeof item === 'object' && typeof (item as Rule).captcha_image_selector === 'string'
		)
		.filter((rule) => rule.captcha_image_selector.trim() !== '');
}

export const BUILTIN_RULES: Rule[] = sanitizeRules(builtinRules);

/** 读取当前生效的规则：有缓存的远程规则就用远程的，否则用内置的 */
export function loadRuleSet(): RuleSet {
	const cached = sanitizeRules(readStore(RULES_KEY));
	return cached.length ? { rules: cached, source: 'remote' } : { rules: BUILTIN_RULES, source: 'builtin' };
}

/** 从远程地址拉取规则并缓存 */
export async function fetchRemoteRules(url: string): Promise<RuleSet> {
	const rules = sanitizeRules(await requestJson({ url }));
	if (!rules.length) throw new Error('规则文件为空或格式不正确');
	writeStore(RULES_KEY, rules);
	return { rules, source: 'remote' };
}

const today = () => new Date().toISOString().slice(0, 10);

/** 是否需要进行每日一次的自动拉取 */
export function shouldAutoFetch(settings: Settings): boolean {
	return settings.autoFetchRules && !!settings.rulesUrl.trim() && readStore<string>(FETCHED_ON_KEY) !== today();
}

export const markFetchedToday = () => writeStore(FETCHED_ON_KEY, today());

/** 当前页面上生效的规则 */
export const rulesForPage = (rules: Rule[], loc: PageLocation): Rule[] =>
	rules.filter((rule) => matchesUrlPattern(rule.url_pattern, loc));
