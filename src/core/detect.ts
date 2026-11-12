import type { PageLocation } from './pattern';
import { rulesForPage, type Rule } from './rules';
import type { Settings } from './settings';

export type CaptchaElement = HTMLImageElement | HTMLCanvasElement;
export type CaptchaInput = HTMLInputElement | HTMLTextAreaElement;

/** 内置的验证码图片选择器 */
export const DEFAULT_CAPTCHA_SELECTORS = [
	'img[src*="captcha"]',
	'img[src*="verify"]',
	'img[alt*="验证码"]',
	'img[title*="验证码"]',
	'img[alt*="captcha"]',
	'img[id="captchaPic"]',
	'.validate-code img',
	'img[style="z-index: 2; position: absolute; bottom: -11px; left: 206px; width: 88px; height: 40px;"]',
	'.authcode img[id="authImage"]',
	'img[class="verification-img"]',
	'img[name="imgCaptcha"]',
];

/** 内置的验证码输入框选择器 */
export const DEFAULT_INPUT_SELECTORS = [
	'input[name*="captcha"]',
	'input[name*="verify"]',
	'input[placeholder="请输入图片验证码"]',
	'input[id="authcode"]',
	'input[placeholder*="captcha"]',
	'input[placeholder*="验证码"]:not([placeholder*="短信"])',
];

export interface SelectorSet {
	/** 通用选择器（内置的和对所有网站生效的规则）：命中的元素还要通过合理性检查 */
	generic: string[];
	/** 用户自定义选择器和针对具体网站的规则：命中即认定为验证码 */
	trusted: string[];
	input: string[];
}

const unique = (items: (string | undefined)[]) => [
	...new Set(items.map((item) => (item ?? '').trim()).filter(Boolean)),
];

/** 规则是否只针对某些网站（而不是对所有网站生效） */
const isSiteSpecific = (rule: Rule) => !['', '*'].includes((rule.url_pattern ?? '').trim());

/** 合并内置选择器、用户自定义选择器和当前页面命中的规则 */
export function resolveSelectors(settings: Settings, rules: Rule[], loc: PageLocation): SelectorSet {
	const matched = rulesForPage(rules, loc);
	const siteRules = matched.filter(isSiteSpecific);
	const globalRules = matched.filter((rule) => !isSiteSpecific(rule));
	return {
		generic: unique([...DEFAULT_CAPTCHA_SELECTORS, ...globalRules.map((rule) => rule.captcha_image_selector)]),
		trusted: unique([...settings.customCaptchaSelectors, ...siteRules.map((rule) => rule.captcha_image_selector)]),
		input: unique([
			...DEFAULT_INPUT_SELECTORS,
			...settings.customInputSelectors,
			...matched.map((rule) => rule.captcha_input_selector),
		]),
	};
}

/** 单个选择器写错不应该影响其他选择器 */
function queryAll(root: ParentNode, selector: string): Element[] {
	try {
		return [...root.querySelectorAll(selector)];
	} catch (error) {
		console.error(`选择器 '${selector}' 执行出错：`, error);
		return [];
	}
}

const isCaptchaElement = (el: Element): el is CaptchaElement =>
	el.tagName === 'CANVAS' || (el.tagName === 'IMG' && !!(el as HTMLImageElement).src);

/** 通用选择器命中的元素，显示尺寸要落在这个范围内才算验证码（像素） */
export const SIZE_LIMITS = { minWidth: 40, minHeight: 15, maxWidth: 600, maxHeight: 250 };

/**
 * 显示尺寸是否像一张验证码：排除不可见的图片、刷新和语音之类的小按钮、大幅配图，
 * 以及竖长的图片（字符验证码都是横向的）。
 */
export function hasPlausibleSize(el: Element): boolean {
	const { width, height } = el.getBoundingClientRect();
	return (
		width >= SIZE_LIMITS.minWidth &&
		height >= SIZE_LIMITS.minHeight &&
		width <= SIZE_LIMITS.maxWidth &&
		height <= SIZE_LIMITS.maxHeight &&
		width >= height
	);
}

/** 形如 img[src*="关键字"] 的选择器 */
const SRC_CONTAINS = /^img\[src\*=(["'])(.+)\1\]$/;

/**
 * 图片地址里的关键字是否真的说明它是验证码。
 * 关键字出现在路径或参数里才算；只出现在域名里时，要求图片来自别的域名。
 * 否则在域名本身带关键字的网站上（例如 captcha.com），站内所有图片都会命中。
 */
export function srcKeywordCounts(img: HTMLImageElement, keyword: string, pageHost: string): boolean {
	let url: URL;
	try {
		url = new URL(img.src, location.href);
	} catch {
		return false;
	}
	if (url.protocol === 'data:') return false;
	if ((url.pathname + url.search).includes(keyword)) return true;
	return url.hostname !== pageHost && url.hostname.includes(keyword);
}

/**
 * 查找页面上的验证码元素（img 或 canvas），去重后返回。
 * trusted 选择器命中即认定；generic 选择器命中后还要通过尺寸和地址关键字检查。
 */
export function findCaptchaElements(
	selectors: Pick<SelectorSet, 'generic' | 'trusted'>,
	root: ParentNode = document,
	pageHost: string = location.hostname
): CaptchaElement[] {
	const found = new Set<CaptchaElement>();
	for (const selector of selectors.trusted) {
		for (const el of queryAll(root, selector)) {
			if (isCaptchaElement(el)) found.add(el);
		}
	}
	for (const selector of selectors.generic) {
		const keyword = SRC_CONTAINS.exec(selector)?.[2];
		for (const el of queryAll(root, selector)) {
			if (!isCaptchaElement(el) || found.has(el)) continue;
			if (keyword && el instanceof HTMLImageElement && !srcKeywordCounts(el, keyword, pageHost)) continue;
			if (hasPlausibleSize(el)) found.add(el);
		}
	}
	return [...found];
}

const isUsableInput = (el: Element): el is CaptchaInput =>
	el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && (el as HTMLInputElement).type !== 'hidden');

const firstInput = (root: ParentNode, selectors: string[]): CaptchaInput | null => {
	for (const selector of selectors) {
		const hit = queryAll(root, selector).find(isUsableInput);
		if (hit) return hit;
	}
	return null;
};

const KEYWORDS = ['captcha', 'verif', '验证码'];
const TEXT_TYPES = ['text', 'tel', 'number', ''];
/** 就近查找输入框时允许的最大距离（像素） */
const MAX_DISTANCE = 600;

const center = (el: Element) => {
	const rect = el.getBoundingClientRect();
	return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};

const distance = (a: Element, b: Element) => {
	const [p, q] = [center(a), center(b)];
	return Math.hypot(p.x - q.x, p.y - q.y);
};

/**
 * 为验证码元素找对应的输入框，按范围从小到大依次尝试：
 * 1. 验证码的父元素内
 * 2. 验证码所在的表单内
 * 3. 整个文档
 * 4. 名称、id 或占位符里带「验证码」字样的输入框
 * 5. 离验证码最近的文本输入框
 */
export function findInputFor(captcha: Element, inputSelectors: string[]): CaptchaInput | null {
	const parent = captcha.parentElement;
	const form = captcha.closest('form');
	for (const scope of [parent, form, document]) {
		const hit = scope && firstInput(scope, inputSelectors);
		if (hit) return hit;
	}

	const inputs = queryAll(document, 'input').filter(isUsableInput) as HTMLInputElement[];
	const byKeyword = inputs.find((input) =>
		[input.name, input.id, input.placeholder].some((value) => {
			const text = (value ?? '').toLowerCase();
			return KEYWORDS.some((keyword) => text.includes(keyword));
		})
	);
	if (byKeyword) return byKeyword;

	let nearest: HTMLInputElement | null = null;
	let best = MAX_DISTANCE;
	for (const input of inputs) {
		if (!TEXT_TYPES.includes(input.getAttribute('type') ?? '') || input.disabled || input.readOnly) continue;
		const gap = distance(captcha, input);
		if (gap < best) {
			best = gap;
			nearest = input;
		}
	}
	return nearest;
}
