import { requestJson } from '../core/http';
import { cleanResult } from './clean';
import { PROVIDERS, type ProviderId } from './presets';
import type { ProviderConfig, ProviderDef } from './types';

export { PROVIDERS, PROVIDER_IDS, type ProviderId } from './presets';
export type { ProviderConfig, ProviderDef } from './types';

export function getProvider(id: string): ProviderDef {
	const def = (PROVIDERS as readonly ProviderDef[]).find((provider) => provider.id === id);
	if (!def) throw new Error(`未知的服务商：${id}`);
	return def;
}

export const emptyProviderConfig = (): ProviderConfig => ({ apiKey: '', apiUrl: '', model: '' });

/** 返回还缺哪一项配置；配置齐全时返回空字符串 */
export function missingConfig(def: ProviderDef, config: ProviderConfig, needModel = true): string {
	if (def.requiresKey && !config.apiKey.trim()) return 'API Key';
	if (!def.defaultUrl && !config.apiUrl.trim()) return 'API 地址';
	if (needModel && !config.model.trim()) return '模型';
	return '';
}

export const isConfigured = (id: ProviderId, config: ProviderConfig) => !missingConfig(getProvider(id), config);

/** 调用模型识别验证码，返回清洗后的结果（可能为空字符串） */
export async function recognizeImage(
	id: ProviderId,
	config: ProviderConfig,
	prompt: string,
	base64Png: string
): Promise<string> {
	const def = getProvider(id);
	const missing = missingConfig(def, config);
	if (missing) throw new Error(`请先填写${def.label}的${missing}`);
	const response = await requestJson(def.protocol.buildRecognize(def, config, prompt, base64Png));
	return cleanResult(def.protocol.parseText(response));
}

/** 获取该服务商当前可用的模型名列表 */
export async function listModels(id: ProviderId, config: ProviderConfig): Promise<string[]> {
	const def = getProvider(id);
	const missing = missingConfig(def, config, false);
	if (missing) throw new Error(`请先填写${def.label}的${missing}`);
	const response = await requestJson(def.protocol.buildListModels(def, config));
	return [...new Set(def.protocol.parseModels(response))].sort();
}
