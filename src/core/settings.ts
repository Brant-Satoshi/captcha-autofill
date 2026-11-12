import { DEFAULT_RULES_URL } from '../meta';
import { emptyProviderConfig, PROVIDER_IDS, type ProviderConfig, type ProviderId } from '../providers';
import { readStore, writeStore } from './storage';

export interface Settings {
	/** 当前使用的服务商 */
	provider: ProviderId;
	/** 每个服务商各自的 Key、地址和模型 */
	providers: Record<ProviderId, ProviderConfig>;
	/** 识别提示词，所有服务商共用；留空使用默认提示词 */
	prompt: string;
	/** 验证码图片变化时自动识别 */
	autoRecognize: boolean;
	/** 识别后自动复制到剪贴板 */
	copyToClipboard: boolean;
	/** 显示右上角通知 */
	showNotification: boolean;
	/** 每天首次运行时自动拉取远程规则 */
	autoFetchRules: boolean;
	/** 远程规则文件地址，留空只用内置规则 */
	rulesUrl: string;
	customCaptchaSelectors: string[];
	customInputSelectors: string[];
	/** 禁用域名列表，每行一项 */
	disabledDomains: string;
}

const SETTINGS_KEY = 'settings';

export function defaultSettings(): Settings {
	return {
		provider: 'openai',
		providers: Object.fromEntries(PROVIDER_IDS.map((id) => [id, emptyProviderConfig()])) as Record<
			ProviderId,
			ProviderConfig
		>,
		prompt: '',
		autoRecognize: false,
		copyToClipboard: true,
		showNotification: true,
		autoFetchRules: false,
		rulesUrl: DEFAULT_RULES_URL,
		customCaptchaSelectors: [],
		customInputSelectors: [],
		disabledDomains: '',
	};
}

const stringList = (value: unknown): string[] =>
	Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

/** 把存储里读出的内容合并到默认值上，保证新增字段有默认值、类型不对的字段被丢弃 */
export function normalizeSettings(saved: unknown): Settings {
	const base = defaultSettings();
	if (!saved || typeof saved !== 'object') return base;
	const input = saved as Partial<Record<keyof Settings, unknown>>;

	const pick = <K extends keyof Settings>(key: K, type: 'string' | 'boolean') => {
		if (typeof input[key] === type) (base[key] as unknown) = input[key];
	};
	pick('prompt', 'string');
	pick('autoRecognize', 'boolean');
	pick('copyToClipboard', 'boolean');
	pick('showNotification', 'boolean');
	pick('autoFetchRules', 'boolean');
	pick('rulesUrl', 'string');
	pick('disabledDomains', 'string');

	if (typeof input.provider === 'string' && (PROVIDER_IDS as string[]).includes(input.provider)) {
		base.provider = input.provider as ProviderId;
	}
	if (input.providers && typeof input.providers === 'object') {
		const savedProviders = input.providers as Record<string, Partial<ProviderConfig> | undefined>;
		for (const id of PROVIDER_IDS) {
			const config = savedProviders[id];
			if (!config) continue;
			for (const field of ['apiKey', 'apiUrl', 'model'] as const) {
				if (typeof config[field] === 'string') base.providers[id][field] = config[field];
			}
		}
	}
	base.customCaptchaSelectors = stringList(input.customCaptchaSelectors);
	base.customInputSelectors = stringList(input.customInputSelectors);
	return base;
}

export const loadSettings = (): Settings => normalizeSettings(readStore(SETTINGS_KEY));

export const saveSettings = (settings: Settings): void => writeStore(SETTINGS_KEY, settings);

export const cloneSettings = (settings: Settings): Settings => normalizeSettings(JSON.parse(JSON.stringify(settings)));
