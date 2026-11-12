import { beforeEach, describe, expect, it } from 'vitest';
import { findCaptchaElements, findInputFor, resolveSelectors } from '../src/core/detect';
import { fillInput } from '../src/core/fill';
import { BUILTIN_RULES, sanitizeRules } from '../src/core/rules';
import { defaultSettings, normalizeSettings } from '../src/core/settings';

const loc = { href: 'https://www.zodgame.xyz/member.php', hostname: 'www.zodgame.xyz' };

beforeEach(() => {
	document.body.innerHTML = '';
});

describe('resolveSelectors', () => {
	it('合并内置、自定义和命中的规则，并去重', () => {
		const settings = defaultSettings();
		settings.customCaptchaSelectors = [' img.mine ', '', 'img[src*="captcha"]'];
		const selectors = resolveSelectors(settings, BUILTIN_RULES, loc);
		expect(selectors.captcha).toContain('img.mine');
		expect(selectors.captcha).toContain("img[src*='mod=seccode']");
		expect(selectors.input).toContain("input[name='seccodeverify']");
		// 其他网站的规则不生效
		expect(selectors.captcha).not.toContain("img[id='vCodeImg']");
		expect(selectors.captcha.filter((s) => s === 'img[src*="captcha"]')).toHaveLength(1);
	});
});

describe('findCaptchaElements', () => {
	it('只返回有 src 的 img 和 canvas，同一元素不重复', () => {
		document.body.innerHTML = `
			<img id="a" src="/captcha.png" alt="验证码">
			<img id="b" alt="验证码">
			<div class="validate-code"><canvas id="c"></canvas></div>
			<span title="验证码">x</span>`;
		const found = findCaptchaElements(['img[src*="captcha"]', 'img[alt*="验证码"]', '.validate-code canvas', 'span', 'bad[[']);
		expect(found.map((el) => el.id)).toEqual(['a', 'c']);
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
