import type { RuleSet } from '../../core/rules';
import { DOCS_URL } from '../../meta';
import { SelectorList } from '../SelectorList';
import { useAsyncStatus } from '../useAsyncStatus';
import type { TabProps } from './types';

interface Props extends TabProps {
	ruleSet: RuleSet;
	reloadRules: (url: string) => Promise<void>;
}

const RELOAD_LABEL = { '': '从远程加载规则', loading: '', success: '加载成功', error: '加载失败' } as const;

/** 「高级设置」标签页：自定义选择器和站点规则 */
export function AdvancedTab({ draft, update, ruleSet, reloadRules }: Props) {
	const rulesState = useAsyncStatus();
	const source = ruleSet.source === 'remote' ? '远程规则' : '内置规则';

	return (
		<div className="settings-card">
			<div className="settings-card-title">
				<span>
					高级设置
					{DOCS_URL && (
						<a href={DOCS_URL} target="_blank" rel="noopener" className="tutorial-link">
							教程
						</a>
					)}
				</span>
			</div>

			<div className="advanced-settings-warning">
				⚠️ 如果不了解 CSS 选择器，请不要修改这些设置，可能导致识别功能失效
			</div>

			<div className="captcha-settings-item">
				<label>自定义验证码图片选择器：</label>
				<SelectorList
					value={draft.customCaptchaSelectors}
					placeholder="例如：img[src*='captcha']"
					onChange={(customCaptchaSelectors) => update({ customCaptchaSelectors })}
				/>
			</div>

			<div className="captcha-settings-item">
				<label>自定义输入框选择器：</label>
				<SelectorList
					value={draft.customInputSelectors}
					placeholder="例如：input[name*='captcha']"
					onChange={(customInputSelectors) => update({ customInputSelectors })}
				/>
			</div>

			<div className="captcha-settings-item">
				<label>站点规则：</label>
				<div className="rules-management">
					<div className="rules-url-input">
						<input
							type="text"
							value={draft.rulesUrl}
							placeholder="远程 rules.json 的地址，留空只用内置规则"
							spellCheck={false}
							onChange={(event) => update({ rulesUrl: event.target.value })}
						/>
						<small>
							当前生效：{source} {ruleSet.rules.length} 条
						</small>
					</div>
					<button
						type="button"
						className={`reload-rules-button test-${rulesState.status}`}
						onClick={() => void rulesState.run(() => reloadRules(draft.rulesUrl))}
					>
						{rulesState.status !== 'loading' && <span>{RELOAD_LABEL[rulesState.status]}</span>}
					</button>
					{rulesState.status === 'error' && <small className="status-error">{rulesState.message}</small>}
				</div>
			</div>
		</div>
	);
}
