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
	captcha: string[];
	input: string[];
}

const unique = (items: (string | undefined)[]) => [
	...new Set(items.map((item) => (item ?? '').trim()).filter(Boolean)),
];

/** 合并内置选择器、用户自定义选择器和当前页面命中的规则 */
export function resolveSelectors(settings: Settings, rules: Rule[], loc: PageLocation): SelectorSet {
	const matched = rulesForPage(rules, loc);
	return {
		captcha: unique([
			...DEFAULT_CAPTCHA_SELECTORS,
			...settings.customCaptchaSelectors,
			...matched.map((rule) => rule.captcha_image_selector),
		]),
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

/** 查找页面上的验证码元素（img 或 canvas），去重后按选择器顺序返回 */
export function findCaptchaElements(selectors: string[], root: ParentNode = document): CaptchaElement[] {
	const found = new Set<CaptchaElement>();
	for (const selector of selectors) {
		for (const el of queryAll(root, selector)) {
			if (isCaptchaElement(el)) found.add(el);
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
