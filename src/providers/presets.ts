import { anthropicProtocol, geminiProtocol, openaiProtocol } from './protocols';
import type { ProviderDef } from './types';

/**
 * 服务商列表。新增一家 OpenAI 兼容的服务商只需要在这里加一条，
 * 设置面板和识别流程都由这张表驱动。
 */
export const PROVIDERS = [
	{
		id: 'openai',
		label: 'OpenAI',
		protocol: openaiProtocol,
		defaultUrl: 'https://api.openai.com/v1/chat/completions',
		requiresKey: true,
		keyPlaceholder: 'sk-...',
	},
	{
		id: 'gemini',
		label: 'Google Gemini',
		protocol: geminiProtocol,
		defaultUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
		requiresKey: true,
	},
	{
		id: 'qwen',
		label: '阿里云通义千问',
		protocol: openaiProtocol,
		defaultUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
		requiresKey: true,
		extraBody: { temperature: 0.1, top_p: 1 },
	},
	{
		id: 'claude',
		label: 'Anthropic Claude',
		protocol: anthropicProtocol,
		defaultUrl: 'https://api.anthropic.com/v1/messages',
		requiresKey: true,
		keyPlaceholder: 'sk-ant-...',
		modelPlaceholder: 'claude-haiku-5-5',
	},
	{
		id: 'ollama',
		label: 'Ollama（本地）',
		protocol: openaiProtocol,
		defaultUrl: 'http://localhost:11434/v1/chat/completions',
		requiresKey: false,
		modelPlaceholder: 'qwen3-vl:8b',
		note: '需要本机已运行 Ollama 并拉取了支持图片输入的模型。图片不会离开你的电脑。如果请求返回 403，请设置环境变量 OLLAMA_ORIGINS 后重启 Ollama。',
	},
	{
		id: 'custom',
		label: '自定义（OpenAI 兼容）',
		protocol: openaiProtocol,
		defaultUrl: '',
		requiresKey: false,
		note: '任何兼容 OpenAI Chat Completions 的接口，例如各类中转或聚合服务。地址可以只填到域名或 /v1，会自动补全路径；以 # 结尾则原样使用。',
	},
] as const satisfies readonly ProviderDef[];

export type ProviderId = (typeof PROVIDERS)[number]['id'];

export const PROVIDER_IDS = PROVIDERS.map((provider) => provider.id) as ProviderId[];
