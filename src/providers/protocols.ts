import type { Protocol, ProviderConfig, ProviderDef } from './types';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const trimSlash = (url: string) => url.trim().replace(/\/+$/, '');

/** 以 # 结尾表示「地址原样使用，不要自动补全路径」 */
const isLiteral = (url: string) => url.trim().endsWith('#');
const stripLiteral = (url: string) => url.trim().slice(0, -1);

type Json = Record<string, any>;

/* ------------------------------------------------------------------ */
/* OpenAI 兼容协议（OpenAI、通义千问、Ollama 以及各种兼容网关）          */
/* ------------------------------------------------------------------ */

/**
 * 补全 OpenAI 兼容接口的地址，允许只填域名或只填到 /v1：
 *   https://api.example.com        -> https://api.example.com/v1/chat/completions
 *   https://api.example.com/v1     -> https://api.example.com/v1/chat/completions
 *   .../chat/completions           -> 原样
 *   任意地址#                       -> 去掉 # 后原样使用
 */
export function resolveOpenAIUrl(custom: string, fallback: string): string {
	if (!custom.trim()) return fallback;
	if (isLiteral(custom)) return stripLiteral(custom);
	const url = trimSlash(custom);
	if (url.endsWith('/chat/completions')) return url;
	if (/\/v\d+$/.test(url)) return `${url}/chat/completions`;
	return `${url}/v1/chat/completions`;
}

const bearer = (config: ProviderConfig): Record<string, string> =>
	config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {};

export const openaiProtocol: Protocol = {
	buildRecognize(def, config, prompt, base64Png) {
		return {
			method: 'POST',
			url: resolveOpenAIUrl(config.apiUrl, def.defaultUrl),
			headers: { ...JSON_HEADERS, ...bearer(config) },
			body: {
				model: config.model,
				messages: [
					{
						role: 'user',
						content: [
							{ type: 'text', text: prompt },
							{ type: 'image_url', image_url: { url: `data:image/png;base64,${base64Png}` } },
						],
					},
				],
				stream: false,
				...def.extraBody,
			},
		};
	},
	parseText(response) {
		const content = (response as Json)?.choices?.[0]?.message?.content;
		if (typeof content === 'string') return content;
		if (Array.isArray(content)) {
			return content.map((part: Json) => (typeof part?.text === 'string' ? part.text : '')).join('');
		}
		return '';
	},
	buildListModels(def, config) {
		const chatUrl = resolveOpenAIUrl(config.apiUrl, def.defaultUrl);
		if (!chatUrl.endsWith('/chat/completions')) {
			throw new Error('无法从自定义地址推断模型列表地址，请手动填写模型名');
		}
		return {
			method: 'GET',
			url: chatUrl.replace(/\/chat\/completions$/, '/models'),
			headers: bearer(config),
		};
	},
	parseModels(response) {
		const data = (response as Json)?.data;
		return Array.isArray(data) ? data.map((item: Json) => String(item?.id ?? '')).filter(Boolean) : [];
	},
};

/* ------------------------------------------------------------------ */
/* Google Gemini                                                       */
/* ------------------------------------------------------------------ */

const geminiBase = (def: ProviderDef, config: ProviderConfig) => trimSlash(config.apiUrl) || def.defaultUrl;

export const geminiProtocol: Protocol = {
	buildRecognize(def, config, prompt, base64Png) {
		const model = config.model.replace(/^models\//, '');
		return {
			method: 'POST',
			url: `${geminiBase(def, config)}/${model}:generateContent`,
			// Key 放在请求头里，不拼进 URL
			headers: { ...JSON_HEADERS, 'x-goog-api-key': config.apiKey },
			body: {
				contents: [
					{
						parts: [{ inline_data: { mime_type: 'image/png', data: base64Png } }, { text: prompt }],
					},
				],
				generationConfig: { temperature: 0 },
				...def.extraBody,
			},
		};
	},
	parseText(response) {
		const parts = (response as Json)?.candidates?.[0]?.content?.parts;
		if (!Array.isArray(parts)) return '';
		// 跳过思考过程（thought）片段
		return parts
			.filter((part: Json) => typeof part?.text === 'string' && !part.thought)
			.map((part: Json) => part.text)
			.join('');
	},
	buildListModels(def, config) {
		return {
			method: 'GET',
			url: `${geminiBase(def, config)}?pageSize=1000`,
			headers: { 'x-goog-api-key': config.apiKey },
		};
	},
	parseModels(response) {
		const models = (response as Json)?.models;
		if (!Array.isArray(models)) return [];
		return models
			.filter((model: Json) => {
				const methods = model?.supportedGenerationMethods;
				return !Array.isArray(methods) || methods.includes('generateContent');
			})
			.map((model: Json) => String(model?.name ?? '').replace(/^models\//, ''))
			.filter(Boolean);
	},
};

/* ------------------------------------------------------------------ */
/* Anthropic Claude（Messages API）                                    */
/* ------------------------------------------------------------------ */

export function resolveAnthropicUrl(custom: string, fallback: string): string {
	if (!custom.trim()) return fallback;
	if (isLiteral(custom)) return stripLiteral(custom);
	const url = trimSlash(custom);
	if (url.endsWith('/messages')) return url;
	if (/\/v\d+$/.test(url)) return `${url}/messages`;
	return `${url}/v1/messages`;
}

const anthropicHeaders = (config: ProviderConfig): Record<string, string> => ({
	'x-api-key': config.apiKey,
	'anthropic-version': '2023-06-01',
	// 请求从浏览器环境发出，Anthropic 要求显式声明
	'anthropic-dangerous-direct-browser-access': 'true',
});

export const anthropicProtocol: Protocol = {
	buildRecognize(def, config, prompt, base64Png) {
		return {
			method: 'POST',
			url: resolveAnthropicUrl(config.apiUrl, def.defaultUrl),
			headers: { ...JSON_HEADERS, ...anthropicHeaders(config) },
			body: {
				model: config.model,
				max_tokens: 256,
				messages: [
					{
						role: 'user',
						content: [
							{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64Png } },
							{ type: 'text', text: prompt },
						],
					},
				],
				...def.extraBody,
			},
		};
	},
	parseText(response) {
		const content = (response as Json)?.content;
		if (!Array.isArray(content)) return '';
		return content
			.filter((block: Json) => block?.type === 'text' && typeof block.text === 'string')
			.map((block: Json) => block.text)
			.join('');
	},
	buildListModels(def, config) {
		const messagesUrl = resolveAnthropicUrl(config.apiUrl, def.defaultUrl);
		if (!messagesUrl.endsWith('/messages')) {
			throw new Error('无法从自定义地址推断模型列表地址，请手动填写模型名');
		}
		return {
			method: 'GET',
			url: `${messagesUrl.replace(/\/messages$/, '/models')}?limit=1000`,
			headers: anthropicHeaders(config),
		};
	},
	parseModels(response) {
		const data = (response as Json)?.data;
		return Array.isArray(data) ? data.map((item: Json) => String(item?.id ?? '')).filter(Boolean) : [];
	},
};
