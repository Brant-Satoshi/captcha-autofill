/**
 * 脚本身份信息。改名、换作者、换仓库都只需要改这一个文件，
 * 构建配置（vite.config.ts）和运行时代码都从这里读取。
 */
export const META = {
	/** 脚本管理器里显示的名称 */
	name: '验证码识别助手',
	/** 作者 */
	author: 'Brant',
	/** 脚本描述 */
	description: '用视觉大模型识别网页上的图片验证码并填入输入框，点击验证码旁的图标触发识别。',
	/**
	 * 脚本命名空间。脚本管理器用「命名空间 + 名称」区分脚本，
	 * 改动其中任何一个都会被当成另一个脚本，已保存的设置不会带过去。
	 */
	namespace: 'brant.captcha-autofill',
	/** 你的 GitHub 仓库，格式为 owner/repo。留空表示尚未托管 */
	repo: '',
	/** 仓库默认分支 */
	branch: 'main',
	/** 上游项目，保留用于署名 */
	upstream: 'https://github.com/anghunk/UserScript/tree/main/CAPTCHA-automatic-recognition',
} as const;

const repo: string = META.repo;

/** 仓库主页，未设置仓库时为空 */
export const HOMEPAGE = repo ? `https://github.com/${repo}` : '';

/** 默认的远程规则地址（指向自己仓库里的 rules.json），未设置仓库时为空，只用内置规则 */
export const DEFAULT_RULES_URL = repo ? `https://raw.githubusercontent.com/${repo}/${META.branch}/rules.json` : '';

/** 高级设置教程链接 */
export const DOCS_URL = repo ? `${HOMEPAGE}/blob/${META.branch}/docs/advanced-settings.md` : '';
