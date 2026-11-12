/**
 * 端到端测试：在真实的 Chrome 里加载构建好的用户脚本，
 * 用假的脚本管理器 API（GM_*）和假的模型接口，验证识别、回填和设置面板。
 * 不会访问任何真实网站或真实模型接口。
 *
 * 运行：npm run build && npm run test:e2e
 * 需要本机装有 Chrome；可用环境变量 CHROME_PATH 指定路径。
 */
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';
import { chromium } from 'playwright-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const userscript = readFileSync(resolve(root, 'dist/captcha-autofill.user.js'), 'utf8');
const shotDir = process.env.E2E_SCREENSHOT_DIR;
if (shotDir) mkdirSync(shotDir, { recursive: true });

/** 生成一张带噪点的 PNG，seed 不同图片内容就不同 */
function noisePng(seed, width = 120, height = 40) {
	const chunk = (type, data) => {
		const body = Buffer.concat([Buffer.from(type), data]);
		const head = Buffer.alloc(4);
		head.writeUInt32BE(data.length);
		const tail = Buffer.alloc(4);
		tail.writeUInt32BE(crc32(body));
		return Buffer.concat([head, body, tail]);
	};
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr.set([8, 2, 0, 0, 0], 8); // 8 位 RGB
	const raw = Buffer.alloc(height * (1 + width * 3));
	let state = seed >>> 0 || 1;
	for (let i = 0; i < raw.length; i++) {
		if (i % (1 + width * 3) === 0) continue; // 每行开头的滤波类型字节
		state = (state * 1664525 + 1013904223) >>> 0;
		raw[i] = state >>> 24;
	}
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', ihdr),
		chunk('IDAT', deflateSync(raw)),
		chunk('IEND', Buffer.alloc(0)),
	]);
}

const pageHtml = `<!doctype html><meta charset="utf-8"><title>e2e</title>
<body style="font-family:sans-serif;padding:40px">
<form onsubmit="return false">
	<p><input id="user" name="username" placeholder="用户名"></p>
	<p><input id="pwd" type="password" placeholder="密码"></p>
	<p><input id="code" name="captcha" placeholder="请输入验证码"> <img id="img" src="/captcha.png?s=1" alt="验证码"></p>
</form>
</body>`;

const server = createServer((req, res) => {
	const url = new URL(req.url, 'http://localhost');
	if (url.pathname === '/captcha.png') {
		res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
		res.end(noisePng(Number(url.searchParams.get('s')) || 1));
	} else {
		res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
		res.end(pageHtml);
	}
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;

/** 注入到页面里的假脚本管理器环境 */
function installMocks(store) {
	window.__store = store;
	window.__requests = [];
	window.__menu = [];
	window.GM_getValue = (key, fallback) => (key in window.__store ? window.__store[key] : fallback);
	window.GM_setValue = (key, value) => (window.__store[key] = value);
	window.GM_registerMenuCommand = (name, handler) => window.__menu.push({ name, handler });
	window.GM_addStyle = (css) => {
		const style = document.createElement('style');
		style.textContent = css;
		document.documentElement.append(style);
		return style;
	};
	window.GM_xmlhttpRequest = (details) => {
		const index = window.__requests.push({
			method: details.method,
			url: details.url,
			headers: details.headers,
			body: details.data ? JSON.parse(details.data) : undefined,
		});
		const reply = (status, json) => setTimeout(() => details.onload({ status, responseText: JSON.stringify(json) }), 30);
		const url = details.url;
		if (url.includes('bad-key')) return reply(401, { error: { message: 'invalid api key' } });
		if (url.endsWith('/rules.json')) {
			return reply(200, [{ url_pattern: '*', captcha_image_selector: 'img.remote', captcha_input_selector: '' }]);
		}
		if (/\/models(\?|$)/.test(url)) return reply(200, { data: [{ id: 'vision-b' }, { id: 'vision-a' }] });
		const answer = window.__answers?.[index - 1] ?? ' 7Kq2 ';
		if (url.includes('anthropic')) return reply(200, { content: [{ type: 'text', text: answer }] });
		return reply(200, { choices: [{ message: { content: answer } }] });
	};
}

const providers = (over) => ({
	openai: { apiKey: '', apiUrl: '', model: '' },
	gemini: { apiKey: '', apiUrl: '', model: '' },
	qwen: { apiKey: '', apiUrl: '', model: '' },
	claude: { apiKey: '', apiUrl: '', model: '' },
	ollama: { apiKey: '', apiUrl: '', model: '' },
	custom: { apiKey: '', apiUrl: '', model: '' },
	...over,
});

const browser = await chromium.launch(
	process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }
);

async function open(settings) {
	const context = await browser.newContext({ viewport: { width: 1100, height: 800 } });
	const page = await context.newPage();
	const errors = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.addInitScript(installMocks, settings ? { settings: JSON.stringify(settings) } : {});
	await page.goto(origin);
	// 脚本自带全部依赖，直接注入即可
	await page.addScriptTag({ content: userscript });
	return { page, errors, close: () => context.close() };
}

const requests = (page) => page.evaluate(() => window.__requests);
/** 需要截图时（设置了 E2E_SCREENSHOT_DIR）先等过渡动画结束 */
async function shot(page, name) {
	if (!shotDir) return;
	await page.waitForTimeout(500);
	await page.screenshot({ path: `${shotDir}/${name}.png` });
}
const results = [];

async function scenario(name, fn) {
	try {
		await fn();
		results.push(`  通过  ${name}`);
	} catch (error) {
		results.push(`  失败  ${name}\n        ${error.message.split('\n')[0]}`);
		process.exitCode = 1;
	}
}

await scenario('手动识别：点击图标后调用 Claude 接口并回填输入框', async () => {
	const t = await open({ provider: 'claude', providers: providers({ claude: { apiKey: 'sk-test', apiUrl: '', model: 'claude-test' } }) });
	const icon = t.page.locator('#img + .captcha-recognition-icon');
	await icon.waitFor({ timeout: 5000 });
	assert.equal(await t.page.locator('.captcha-recognition-icon').count(), 1, '只应该有一个识别图标');
	assert.equal((await requests(t.page)).length, 0, '未开启自动识别时不应该发请求');
	await icon.click();
	await t.page.waitForFunction(() => document.getElementById('code').value === '7Kq2');
	const [req] = await requests(t.page);
	assert.equal(req.url, 'https://api.anthropic.com/v1/messages');
	assert.equal(req.headers['x-api-key'], 'sk-test');
	assert.equal(req.body.model, 'claude-test');
	assert.ok(req.body.messages[0].content[0].source.data.length > 100, '请求里应该带有图片数据');
	assert.equal(await t.page.inputValue('#user'), '', '不应该动用户名输入框');
	await t.page.locator('.captcha-recognition-success').waitFor();
	await shot(t.page, 'manual-filled');
	assert.deepEqual(t.errors, []);
	await t.close();
});

await scenario('自动识别：加载后自动回填，换图后重新识别，同一张图不重复识别', async () => {
	const t = await open({
		provider: 'custom',
		autoRecognize: true,
		providers: providers({ custom: { apiKey: '', apiUrl: 'https://llm.example/v1', model: 'vision-a' } }),
	});
	await t.page.evaluate(() => (window.__answers = ['aaa1', 'bbb2']));
	await t.page.waitForFunction(() => document.getElementById('code').value === 'aaa1', null, { timeout: 8000 });
	await t.page.waitForTimeout(1500); // 轮询若干次后也不应该重复识别
	let sent = await requests(t.page);
	assert.equal(sent.length, 1, '同一张图只应该识别一次');
	assert.equal(sent[0].url, 'https://llm.example/v1/chat/completions');
	assert.ok(!('Authorization' in sent[0].headers), '没有 Key 时不应该发 Authorization');
	await t.page.evaluate(() => (document.getElementById('img').src = '/captcha.png?s=2'));
	await t.page.waitForFunction(() => document.getElementById('code').value === 'bbb2', null, { timeout: 8000 });
	sent = await requests(t.page);
	assert.equal(sent.length, 2);
	assert.notEqual(
		sent[0].body.messages[0].content[1].image_url.url,
		sent[1].body.messages[0].content[1].image_url.url,
		'第二次应该发送新图片'
	);
	assert.deepEqual(t.errors, []);
	await t.close();
});

await scenario('禁用域名：列表中的网站不挂图标', async () => {
	const t = await open({ disabledDomains: '127.0.0.1' });
	await t.page.waitForTimeout(2500);
	assert.equal(await t.page.locator('.captcha-recognition-icon').count(), 0);
	await t.close();
});

await scenario('接口报错：显示接口返回的错误信息，不填输入框', async () => {
	const t = await open({
		provider: 'openai',
		providers: providers({ openai: { apiKey: 'x', apiUrl: 'https://bad-key.example#', model: 'm' } }),
	});
	await t.page.locator('.captcha-recognition-icon').click({ timeout: 5000 });
	await t.page.locator('.captcha-toast-error', { hasText: 'invalid api key' }).waitFor();
	assert.equal(await t.page.inputValue('#code'), '');
	await t.close();
});

await scenario('设置面板：未配置时点击图标打开面板，获取模型、测试连接、保存', async () => {
	const t = await open();
	await t.page.locator('.captcha-recognition-icon').click({ timeout: 5000 });
	const panel = t.page.locator('.captcha-settings-modal');
	await panel.waitFor();
	await shot(t.page, 'panel-ai-empty');

	await panel.locator('select').first().selectOption('qwen');
	const key = panel.locator('input[type="password"]');
	await key.fill('sk-qwen');
	await panel.getByRole('button', { name: '获取列表' }).click();
	const picker = panel.locator('select.model-picker');
	await picker.waitFor();
	assert.deepEqual(await picker.locator('option').allTextContents().then((all) => all.slice(1).map((s) => s.trim())), ['vision-a', 'vision-b']);
	await picker.selectOption('vision-b');
	assert.equal(await panel.locator('input[placeholder*="模型"]').inputValue(), 'vision-b');

	await t.page.evaluate(() => (window.__answers = [undefined, 'A7K9']));
	await panel.getByRole('button', { name: '测试连接' }).click();
	await panel.locator('small.status-success', { hasText: '识别正确' }).waitFor();
	await shot(t.page, 'panel-ai-filled');

	for (const tab of ['功能设置', '禁用域名', '高级设置']) {
		await panel.locator('.settings-nav-item', { hasText: tab }).click();
		await shot(t.page, `panel-${tab}`);
	}
	// 切回服务商页，已获取的模型列表和填好的内容应该还在
	await panel.locator('.settings-nav-item', { hasText: 'AI 服务商' }).click();
	assert.equal(await picker.inputValue(), 'vision-b');
	assert.equal(await key.inputValue(), 'sk-qwen');
	await panel.locator('.settings-nav-item', { hasText: '高级设置' }).click();
	assert.ok(!(await picker.isVisible()), '其他标签页不应该显示服务商页的内容');

	await panel.getByRole('button', { name: '添加选择器' }).first().click();
	await panel.locator('.selector-item input').fill('  img.my-captcha ');
	await panel.locator('.rules-url-input input').fill('https://rules.example/rules.json');
	await panel.getByRole('button', { name: '从远程加载规则' }).click();
	await panel.locator('small', { hasText: '远程规则 1 条' }).waitFor();

	await panel.getByRole('button', { name: '保存设置' }).click();
	await panel.waitFor({ state: 'detached' });
	const saved = JSON.parse(await t.page.evaluate(() => window.__store.settings));
	assert.equal(saved.provider, 'qwen');
	assert.deepEqual(saved.providers.qwen, { apiKey: 'sk-qwen', apiUrl: '', model: 'vision-b' });
	assert.deepEqual(saved.customCaptchaSelectors, ['img.my-captcha']);
	assert.equal(saved.rulesUrl, 'https://rules.example/rules.json');

	// 保存后立即生效：再点图标应该走通义千问接口
	await t.page.evaluate(() => (window.__answers = []));
	await t.page.locator('.captcha-recognition-icon').click();
	await t.page.waitForFunction(() => document.getElementById('code').value === '7Kq2');
	const last = (await requests(t.page)).at(-1);
	assert.equal(last.url, 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
	assert.equal(last.headers.Authorization, 'Bearer sk-qwen');
	assert.deepEqual(t.errors, []);
	await t.close();
});

await scenario('取消不保存：面板里的修改在取消后被丢弃', async () => {
	const t = await open();
	await t.page.locator('.captcha-recognition-icon').click({ timeout: 5000 });
	const panel = t.page.locator('.captcha-settings-modal');
	await panel.locator('input[type="password"]').fill('temp');
	await panel.getByRole('button', { name: '取消' }).click();
	await panel.waitFor({ state: 'detached' });
	assert.equal(await t.page.evaluate(() => window.__store.settings), undefined);
	const menu = await t.page.evaluate(() => window.__menu.map((item) => item.name));
	assert.equal(menu.length, 1, '菜单只注册一次');
	await t.page.evaluate(() => window.__menu[0].handler());
	await panel.waitFor();
	assert.equal(await panel.locator('input[type="password"]').inputValue(), '');
	await t.close();
});

await browser.close();
server.close();
console.log(results.join('\n'));
