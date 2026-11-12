import { useState } from 'react';
import { makeTestImage } from '../../core/image';
import { DEFAULT_PROMPT } from '../../prompts';
import {
	getProvider,
	listModels,
	PROVIDERS,
	recognizeImage,
	type ProviderConfig,
	type ProviderId,
} from '../../providers';
import { useAsyncStatus } from '../useAsyncStatus';
import type { TabProps } from './types';

const TEST_ANSWER = 'A7K9';

/** 「AI 服务商」标签页：选择服务商、填写 Key / 地址 / 模型、测试连接、编辑提示词 */
export function ProviderTab({ draft, update }: TabProps) {
	const def = getProvider(draft.provider);
	const config = draft.providers[draft.provider];

	const [showKey, setShowKey] = useState(false);
	// 记下模型列表属于哪个服务商，切换服务商后不会显示上一家的列表
	const [fetched, setFetched] = useState<{ provider: ProviderId; models: string[] } | null>(null);
	const models = fetched?.provider === draft.provider ? fetched.models : [];
	const modelsState = useAsyncStatus();
	const testState = useAsyncStatus();

	const updateConfig = (patch: Partial<ProviderConfig>) =>
		update({ providers: { ...draft.providers, [draft.provider]: { ...config, ...patch } } });

	function changeProvider(provider: ProviderId) {
		update({ provider });
		// 上一家的测试结果不再适用
		setShowKey(false);
		modelsState.reset();
		testState.reset();
	}

	function fetchModels() {
		const provider = draft.provider;
		void modelsState.run(async () => {
			const list = await listModels(provider, config);
			if (!list.length) throw new Error('没有获取到可用模型');
			setFetched({ provider, models: list });
			return `获取到 ${list.length} 个模型，请从下拉列表中选择`;
		});
	}

	function testConnection() {
		void testState.run(async () => {
			const image = makeTestImage(TEST_ANSWER);
			if (!image) throw new Error('无法生成测试图片');
			const text = await recognizeImage(draft.provider, config, draft.prompt.trim() || DEFAULT_PROMPT, image);
			if (!text) return '连接成功，但模型没有返回内容，请确认所选模型支持图片输入';
			return text.toUpperCase() === TEST_ANSWER
				? `连接成功，测试图片识别正确（${text}）`
				: `连接成功，但测试图片识别为 ${text}（应为 ${TEST_ANSWER}）`;
		});
	}

	return (
		<>
			<div className="settings-card">
				<div className="settings-card-title">
					<span>AI 服务商</span>
					<span className="api-type">{def.label}</span>
				</div>

				<div className="captcha-settings-item">
					<label>服务商：</label>
					<select value={draft.provider} onChange={(event) => changeProvider(event.target.value as ProviderId)}>
						{PROVIDERS.map((provider) => (
							<option key={provider.id} value={provider.id}>
								{provider.label}
							</option>
						))}
					</select>
				</div>

				<div className="captcha-settings-item">
					<label>API Key{def.requiresKey ? '' : '（可选）'}：</label>
					<div className="input-with-button">
						<input
							type={showKey ? 'text' : 'password'}
							value={config.apiKey}
							placeholder={def.keyPlaceholder || 'API Key'}
							autoComplete="off"
							spellCheck={false}
							onChange={(event) => updateConfig({ apiKey: event.target.value })}
						/>
						<button type="button" className="side-button" onClick={() => setShowKey(!showKey)}>
							{showKey ? '隐藏' : '显示'}
						</button>
					</div>
				</div>

				<div className="captcha-settings-item">
					<label>API 地址{def.defaultUrl ? '（可选）' : ''}：</label>
					<input
						type="text"
						value={config.apiUrl}
						placeholder={def.defaultUrl || 'https://example.com/v1'}
						spellCheck={false}
						onChange={(event) => updateConfig({ apiUrl: event.target.value })}
					/>
					{def.defaultUrl && <small>留空使用默认地址</small>}
				</div>

				<div className="captcha-settings-item">
					<label>模型：</label>
					<div className="input-with-button">
						<input
							type="text"
							value={config.model}
							placeholder={def.modelPlaceholder || '填写模型名，或点击右侧获取列表'}
							spellCheck={false}
							onChange={(event) => updateConfig({ model: event.target.value })}
						/>
						<button type="button" className={`side-button test-${modelsState.status}`} onClick={fetchModels}>
							{modelsState.status !== 'loading' && <span>获取列表</span>}
						</button>
					</div>
					{models.length > 0 && (
						<select
							className="model-picker"
							value={models.includes(config.model) ? config.model : ''}
							onChange={(event) => event.target.value && updateConfig({ model: event.target.value })}
						>
							<option value="">从 {models.length} 个可用模型中选择…</option>
							{models.map((model) => (
								<option key={model} value={model}>
									{model}
								</option>
							))}
						</select>
					)}
					{modelsState.message ? (
						<small className={`status-${modelsState.status}`}>{modelsState.message}</small>
					) : (
						<small>需要选择支持图片输入的模型</small>
					)}
				</div>

				{def.note && <div className="provider-note">{def.note}</div>}

				<div className="captcha-settings-item">
					<button
						type="button"
						className={`test-api-button full-width test-${testState.status}`}
						onClick={testConnection}
					>
						{testState.status !== 'loading' && <span>测试连接</span>}
					</button>
					{testState.message ? (
						<small className={`status-${testState.status}`}>{testState.message}</small>
					) : (
						<small>会发送一张本地生成的测试图片，验证 Key、地址和模型是否可用</small>
					)}
				</div>
			</div>

			<div className="settings-card">
				<div className="settings-card-title">
					<span>识别提示词</span>
				</div>
				<div className="captcha-settings-item">
					<div className="textarea-with-button">
						<textarea
							value={draft.prompt}
							placeholder="留空使用默认提示词"
							rows={4}
							spellCheck={false}
							onChange={(event) => update({ prompt: event.target.value })}
						/>
						<button type="button" className="use-default-prompt" onClick={() => update({ prompt: DEFAULT_PROMPT })}>
							填入默认
						</button>
					</div>
					<small>所有服务商共用。留空使用默认提示词；点「填入默认」可以在默认提示词的基础上修改</small>
				</div>
			</div>
		</>
	);
}
