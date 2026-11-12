import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';
import pkg from './package.json' with { type: 'json' };
import { HOMEPAGE, META } from './src/meta.ts';

// 图标内嵌进脚本头部，不依赖任何外部地址
const icon = 'data:image/svg+xml;base64,' + readFileSync('./src/assets/icon.svg').toString('base64');

export default defineConfig({
	build: {
		// React 打进脚本后体积较大，而脚本会在每个页面运行，所以压缩产物（约 280 KB，不压缩约 660 KB）
		minify: true,
		rolldownOptions: {
			// 保留打包进来的第三方库（React）的许可声明
			output: { comments: { legal: true } },
		},
	},
	plugins: [
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
					'raw.githubusercontent.com',
					'localhost',
					'127.0.0.1',
					'*',
				],
			},
			build: {
				// React 直接打进脚本，安装和运行都不依赖外部 CDN
				fileName: 'captcha-autofill.user.js',
			},
		}),
	],
});
