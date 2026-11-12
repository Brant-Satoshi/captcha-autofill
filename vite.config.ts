import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig, esmExternalRequirePlugin } from 'vite';
import monkey, { cdn } from 'vite-plugin-monkey';
import pkg from './package.json' with { type: 'json' };
import { HOMEPAGE, META } from './src/meta.ts';

// 图标内嵌进脚本头部，不依赖任何外部地址
const icon = 'data:image/svg+xml;base64,' + readFileSync('./src/assets/icon.svg').toString('base64');

/**
 * 从 npmmirror 加载依赖的 UMD 构建（@require），版本取自 node_modules 里实际安装的版本。
 * 地址后附上用本地文件算出的 sha256，CDN 返回的内容和 npm 包不一致时脚本管理器会拒绝加载。
 * @require 的代码和脚本运行在同一个环境里，能读到保存的 API Key，所以必须校验。
 */
function fromCdn(pkgName: string, globalName: string, file: string) {
	const hash = createHash('sha256').update(readFileSync(`./node_modules/${pkgName}/${file}`)).digest('base64');
	const [name, toUrl] = cdn.npmmirror(globalName, file);
	return [name, (...args: Parameters<typeof toUrl>) => `${toUrl(...args)}#sha256=${hash}`];
}

/** 从 CDN 加载、不打进脚本的模块 */
const CDN_MODULES = ['react', 'react-dom'];

export default defineConfig({
	build: {
		// 脚本会在每个页面运行，所以压缩产物
		minify: true,
		rolldownOptions: {
			// 保留打包进来的第三方库（React）的许可声明
			output: { comments: { legal: true } },
		},
	},
	plugins: [
		// react/jsx-runtime 和 react-dom/client 是 CommonJS，内部用 require 引用 react / react-dom。
		// 用户脚本里没有 require，需要把它们转成 import，才能指向 @require 加载的全局变量
		esmExternalRequirePlugin({ external: CDN_MODULES }),
		{
			// vite-plugin-monkey 会把 externalGlobals 里的模块也加进顶层 external，
			// 而顶层 external 优先，esmExternalRequirePlugin 遇到重复的就不转换了，所以从顶层移除
			name: 'cdn-modules-not-top-level-external',
			// vite-plugin-monkey 的 config 钩子是 order: 'post'，这里也要 post 且排在它后面
			enforce: 'post',
			config: {
				order: 'post',
				handler(config) {
					const options = config.build?.rolldownOptions;
					if (Array.isArray(options?.external)) {
						options.external = options.external.filter((id) => !(CDN_MODULES as unknown[]).includes(id));
					}
				},
			},
		},
		react(),
		monkey({
			entry: 'src/main.tsx',
			userscript: {
				name: META.name,
				namespace: META.namespace,
				version: pkg.version,
				author: META.author,
				description: META.description,
				license: pkg.license,
				icon,
				...(HOMEPAGE ? { homepageURL: HOMEPAGE } : {}),
				match: ['*://*/*'],
				grant: ['GM_xmlhttpRequest', 'GM_addStyle', 'GM_setValue', 'GM_getValue', 'GM_registerMenuCommand'],
				// 允许访问的接口域名。自定义地址和远程规则可能是任意域名，所以保留 *，
				// 首次访问列表外的域名时脚本管理器会弹窗确认
				connect: [
					'api.openai.com',
					'generativelanguage.googleapis.com',
					'dashscope.aliyuncs.com',
					'api.anthropic.com',
					'openrouter.ai',
					'raw.githubusercontent.com',
					'localhost',
					'127.0.0.1',
					'*',
				],
			},
			build: {
				fileName: 'captcha-autofill.user.js',
				// React 和 React DOM 不打进脚本，由脚本管理器在安装时从 CDN 下载并缓存
				externalGlobals: {
					react: fromCdn('react', 'React', 'umd/react.production.min.js'),
					'react-dom': fromCdn('react-dom', 'ReactDOM', 'umd/react-dom.production.min.js'),
				},
			},
		}),
	],
});
