import { describe, expect, it } from 'vitest';
import { getProvider, missingConfig, PROVIDERS } from '../src/providers';
import { cleanResult } from '../src/providers/clean';
import {
	anthropicProtocol,
	geminiProtocol,
	openaiProtocol,
	resolveAnthropicUrl,
	resolveOpenAIUrl,
} from '../src/providers/protocols';

const IMG = 'QUJD';
const cfg = (over = {}) => ({ apiKey: 'k', apiUrl: '', model: 'm', ...over });

describe('cleanResult', () => {
	it('只保留字母、数字和负号', () => {
		expect(cleanResult(' aB5 fG \n')).toBe('aB5fG');
		expect(cleanResult('答案是：-12。')).toBe('-12');
	});
	it('去掉思考过程', () => {
		expect(cleanResult('<think>looks like 8x3K</think>\n8x3K')).toBe('8x3K');
	});
});

describe('resolveOpenAIUrl', () => {
	const fallback = 'https://api.openai.com/v1/chat/completions';
	it.each([
		['', fallback],
		['https://x.com', 'https://x.com/v1/chat/completions'],
		['https://x.com/', 'https://x.com/v1/chat/completions'],
		['https://x.com/v1', 'https://x.com/v1/chat/completions'],
		['https://open.bigmodel.cn/api/paas/v4/', 'https://open.bigmodel.cn/api/paas/v4/chat/completions'],
		['https://x.com/v1/chat/completions', 'https://x.com/v1/chat/completions'],
		['https://x.com/custom/path#', 'https://x.com/custom/path'],
	])('%s -> %s', (input, expected) => {
		expect(resolveOpenAIUrl(input, fallback)).toBe(expected);
	});
});

describe('resolveAnthropicUrl', () => {
	const fallback = 'https://api.anthropic.com/v1/messages';
	it.each([
		['', fallback],
		['https://proxy.dev', 'https://proxy.dev/v1/messages'],
		['https://proxy.dev/v1', 'https://proxy.dev/v1/messages'],
		['https://proxy.dev/v1/messages', 'https://proxy.dev/v1/messages'],
	])('%s -> %s', (input, expected) => {
		expect(resolveAnthropicUrl(input, fallback)).toBe(expected);
	});
});

describe('OpenAI 兼容协议', () => {
	it('构造识别请求，并带上服务商的额外参数', () => {
		const req = openaiProtocol.buildRecognize(getProvider('qwen'), cfg(), 'P', IMG);
		expect(req.url).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
		expect(req.headers).toMatchObject({ Authorization: 'Bearer k' });
		const body = req.body as any;
		expect(body.model).toBe('m');
		expect(body.temperature).toBe(0.1);
		expect(body.messages[0].content[1].image_url.url).toBe(`data:image/png;base64,${IMG}`);
	});

	it('没有 Key 时不发 Authorization（Ollama）', () => {
		const req = openaiProtocol.buildRecognize(getProvider('ollama'), cfg({ apiKey: '' }), 'P', IMG);
		expect(req.url).toBe('http://localhost:11434/v1/chat/completions');
		expect(req.headers).not.toHaveProperty('Authorization');
	});

	it('解析字符串和分段两种 content', () => {
		expect(openaiProtocol.parseText({ choices: [{ message: { content: 'ab12' } }] })).toBe('ab12');
		expect(
			openaiProtocol.parseText({ choices: [{ message: { content: [{ type: 'text', text: 'ab' }, { text: '12' }] } }] })
		).toBe('ab12');
		expect(openaiProtocol.parseText({})).toBe('');
	});

	it('模型列表地址由对话地址推断', () => {
		const req = openaiProtocol.buildListModels(getProvider('custom'), cfg({ apiUrl: 'https://x.com/v1' }));
		expect(req.url).toBe('https://x.com/v1/models');
		expect(openaiProtocol.parseModels({ data: [{ id: 'a' }, { id: 'b' }] })).toEqual(['a', 'b']);
		expect(() => openaiProtocol.buildListModels(getProvider('custom'), cfg({ apiUrl: 'https://x.com/run#' }))).toThrow();
	});
});

describe('Gemini 协议', () => {
	const def = getProvider('gemini');
	it('Key 放在请求头而不是 URL 里', () => {
		const req = geminiProtocol.buildRecognize(def, cfg({ model: 'models/gemini-x' }), 'P', IMG);
		expect(req.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-x:generateContent');
		expect(req.url).not.toContain('key=');
		expect(req.headers).toMatchObject({ 'x-goog-api-key': 'k' });
		expect((req.body as any).contents[0].parts[0].inline_data.data).toBe(IMG);
	});
	it('解析时跳过思考片段', () => {
		const response = { candidates: [{ content: { parts: [{ text: 'hmm', thought: true }, { text: 'Xy' }, { text: '9' }] } }] };
		expect(geminiProtocol.parseText(response)).toBe('Xy9');
	});
	it('模型列表只保留支持 generateContent 的模型', () => {
		const response = {
			models: [
				{ name: 'models/a', supportedGenerationMethods: ['generateContent'] },
				{ name: 'models/embed', supportedGenerationMethods: ['embedContent'] },
			],
		};
		expect(geminiProtocol.parseModels(response)).toEqual(['a']);
	});
});

describe('Anthropic 协议', () => {
	const def = getProvider('claude');
	it('构造 Messages API 请求', () => {
		const req = anthropicProtocol.buildRecognize(def, cfg(), 'P', IMG);
		expect(req.url).toBe('https://api.anthropic.com/v1/messages');
		expect(req.headers).toMatchObject({ 'x-api-key': 'k', 'anthropic-version': '2023-06-01' });
		const body = req.body as any;
		expect(body.max_tokens).toBeGreaterThan(0);
		expect(body.messages[0].content[0]).toEqual({
			type: 'image',
			source: { type: 'base64', media_type: 'image/png', data: IMG },
		});
	});
	it('解析文本块', () => {
		expect(anthropicProtocol.parseText({ content: [{ type: 'thinking', thinking: 'x' }, { type: 'text', text: 'Q7' }] })).toBe('Q7');
	});
	it('模型列表地址', () => {
		expect(anthropicProtocol.buildListModels(def, cfg()).url).toBe('https://api.anthropic.com/v1/models?limit=1000');
	});
});

describe('missingConfig', () => {
	it('按服务商要求检查必填项', () => {
		expect(missingConfig(getProvider('openai'), cfg({ apiKey: '' }))).toBe('API Key');
		expect(missingConfig(getProvider('openai'), cfg({ model: '' }))).toBe('模型');
		expect(missingConfig(getProvider('openai'), cfg({ model: '' }), false)).toBe('');
		expect(missingConfig(getProvider('ollama'), cfg({ apiKey: '' }))).toBe('');
		expect(missingConfig(getProvider('custom'), cfg({ apiKey: '' }))).toBe('API 地址');
		expect(missingConfig(getProvider('custom'), cfg({ apiKey: '', apiUrl: 'https://x.com' }))).toBe('');
	});
	it('服务商 id 不重复', () => {
		const ids = PROVIDERS.map((p) => p.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});
