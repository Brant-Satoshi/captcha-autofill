import { beforeEach, describe, expect, it } from 'vitest';
import { findCaptchaElements, findInputFor, hasPlausibleSize, resolveSelectors } from '../src/core/detect';
import { fillInput } from '../src/core/fill';
import { BUILTIN_RULES, sanitizeRules } from '../src/core/rules';
import { defaultSettings, normalizeSettings } from '../src/core/settings';

const loc = { href: 'https://www.zodgame.xyz/member.php', hostname: 'www.zodgame.xyz' };

beforeEach(() => {
	document.body.innerHTML = '';
});

/** happy-dom 不做布局，测试里手动指定元素的显示尺寸 */
function size<T extends Element>(el: T, width: number, height: number): T {
	el.getBoundingClientRect = () => new DOMRect(0, 0, width, height);
	return el;
}

function img(attrs: Record<string, string>, width = 120, height = 40): HTMLImageElement {
	const el = document.createElement('img');
	for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
	document.body.append(el);
	return size(el, width, height);
}

describe('resolveSelectors', () => {
	it('内置选择器和全站规则归为通用，自定义选择器和站点规则归为可信', () => {
		const settings = defaultSettings();
		settings.customCaptchaSelectors = [' img.mine ', ''];
		const selectors = resolveSelectors(settings, BUILTIN_RULES, loc);
		expect(selectors.trusted).toEqual(['img.mine', "img[src*='mod=seccode']"]);
		expect(selectors.generic).toContain('img[src*="captcha"]');
		expect(selectors.generic).toContain("img[alt*='CAPTCHA']");
		expect(selectors.input).toContain("input[name='seccodeverify']");
		// 其他网站的规则不生效
		expect([...selectors.generic, ...selectors.trusted]).not.toContain("img[id='vCodeImg']");
		expect(new Set(selectors.generic).size).toBe(selectors.generic.length);
	});
});

describe('findCaptchaElements', () => {
	const generic = ['img[src*="captcha"]', 'img[alt*="验证码"]', "img[alt*='CAPTCHA']", 'span', 'bad[['];
	const find = (trusted: string[] = [], host = 'example.com') =>
		findCaptchaElements({ generic, trusted }, document, host).map((el) => el.id);

	it('通用选择器只认尺寸像验证码的图片', () => {
		img({ id: 'ok', src: 'https://example.com/captcha.png' });
		img({ id: 'button', src: 'https://example.com/captcha-reload.png', alt: 'Change the CAPTCHA code' }, 22, 22);
		img({ id: 'hidden', src: 'https://example.com/captcha.png?2' }, 0, 0);
		img({ id: 'banner', src: 'https://example.com/captcha-banner.jpg' }, 800, 400);
		img({ id: 'tall', src: 'https://example.com/captcha-tall.jpg' }, 40, 120);
		img({ id: 'nosrc', alt: '验证码' });
		document.body.append(document.createElement('span'));
		expect(find()).toEqual(['ok']);
	});

	it('同一元素命中多个选择器只返回一次', () => {
		img({ id: 'a', src: 'https://example.com/captcha.png', alt: '验证码' });
		expect(find()).toEqual(['a']);
	});

	it('可信选择器命中即认定，不看尺寸，也支持 canvas', () => {
		img({ id: 'small', class: 'mine', src: 'https://example.com/code.png' }, 30, 12);
		const canvas = document.createElement('canvas');
		canvas.id = 'cv';
		document.body.append(canvas);
		expect(find(['img.mine', 'canvas'])).toEqual(['small', 'cv']);
	});

	it('域名本身带关键字的网站上，站内图片不因域名而命中', () => {
		img({ id: 'logo', src: 'https://captcha.com/images/logo.jpg' });
		img({ id: 'real', src: 'https://captcha.com/forms/captcha-endpoint.php?get=image' });
		img({ id: 'byAlt', src: 'https://captcha.com/images/code.jpg', alt: 'Retype the CAPTCHA code' });
		img({ id: 'dataUrl', src: 'data:image/png;base64,AAAAcaptchaAAAA' });
		expect(find([], 'captcha.com')).toEqual(['real', 'byAlt']);
	});

	it('图片来自别的带关键字的域名时照常命中', () => {
		img({ id: 'cdn', src: 'https://captcha.example-cdn.com/a/b.png' });
		expect(find([], 'example.com')).toEqual(['cdn']);
	});
});

describe('hasPlausibleSize', () => {
	it.each([
		[120, 40, true],
		[60, 20, true],
		[250, 50, true],
		[22, 22, false],
		[32, 32, false],
		[0, 0, false],
		[700, 100, false],
		[300, 300, false],
		[50, 80, false],
	])('%i×%i -> %s', (width, height, expected) => {
		expect(hasPlausibleSize(size(document.createElement('img'), width, height))).toBe(expected);
	});
});

describe('findInputFor', () => {
	const selectors = ['input[name*="captcha"]'];

	it('优先取验证码旁边的输入框', () => {
		document.body.innerHTML = `
			<input id="far" name="captcha_far">
			<form><div><input id="near" name="captcha"><img id="img" src="/captcha.png"></div></form>`;
		expect(findInputFor(document.getElementById('img')!, selectors)?.id).toBe('near');
	});

	it('跳过隐藏输入框，在表单范围内继续找', () => {
		document.body.innerHTML = `
			<form>
				<p><input type="hidden" name="captcha_token"><img id="img" src="/captcha.png"></p>
				<p><input id="real" name="captcha"></p>
			</form>`;
		expect(findInputFor(document.getElementById('img')!, selectors)?.id).toBe('real');
	});

	it('选择器都没命中时，按名称里的关键字找', () => {
		document.body.innerHTML = `<input id="user" name="username"><input id="code" placeholder="请输入验证码"><img id="img" src="/x.png">`;
		expect(findInputFor(document.getElementById('img')!, ['input.none'])?.id).toBe('code');
	});

	it('就近兜底时不会选中密码框', () => {
		document.body.innerHTML = `<input id="pwd" type="password"><input id="plain" type="text"><img id="img" src="/x.png">`;
		expect(findInputFor(document.getElementById('img')!, ['input.none'])?.id).toBe('plain');
	});
});

describe('fillInput', () => {
	it('写入值并触发 input 和 change 事件', () => {
		const input = document.createElement('input');
		document.body.append(input);
		const events: string[] = [];
		input.addEventListener('input', () => events.push('input'));
		input.addEventListener('change', () => events.push('change'));
		fillInput(input, 'aB12');
		expect(input.value).toBe('aB12');
		expect(events).toEqual(['input', 'change']);
	});
});

describe('设置与规则的容错', () => {
	it('normalizeSettings 补全缺失字段并丢弃类型错误的值', () => {
		const settings = normalizeSettings({
			provider: 'nope',
			autoRecognize: 'yes',
			copyToClipboard: false,
			providers: { claude: { apiKey: 'sk', model: 42 } },
			customInputSelectors: ['a', 1, null],
		});
		expect(settings.provider).toBe('openai');
		expect(settings.autoRecognize).toBe(false);
		expect(settings.copyToClipboard).toBe(false);
		expect(settings.providers.claude).toEqual({ apiKey: 'sk', apiUrl: '', model: '' });
		expect(settings.providers.ollama).toEqual({ apiKey: '', apiUrl: '', model: '' });
		expect(settings.customInputSelectors).toEqual(['a']);
	});

	it('sanitizeRules 过滤掉没有图片选择器的条目', () => {
		expect(sanitizeRules('oops')).toEqual([]);
		expect(sanitizeRules([{ url_pattern: 'a' }, { captcha_image_selector: ' ' }, { captcha_image_selector: 'img.x' }])).toEqual([
			{ captcha_image_selector: 'img.x' },
		]);
		expect(BUILTIN_RULES.length).toBeGreaterThan(0);
	});
});
