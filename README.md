# 验证码识别助手

一个用户脚本（Tampermonkey / Violentmonkey）：在网页的图片验证码旁边放一个识别图标，点击后把图片交给你自己配置的视觉大模型识别，并把结果填进输入框。支持字符型和算术题型验证码，图片可以是 `<img>` 或 `<canvas>`。

本项目基于 [anghunk 的 CAPTCHA-automatic-recognition](https://github.com/anghunk/UserScript/tree/main/CAPTCHA-automatic-recognition)（Apache-2.0）改造，供个人使用。与上游的差异见下文。

## 安装

```bash
npm install
npm run build
```

构建产物是 `dist/captcha-autofill.user.js`。在脚本管理器里新建脚本并粘贴它的内容，或者把这个文件拖进浏览器安装。

脚本自带全部依赖（界面用 React 编写，已打包在内），安装和运行都不需要从 CDN 加载任何东西。

## 使用

1. 打开任意带图片验证码的网页，验证码后面会出现一个小图标。
2. 第一次点击图标会弹出设置面板。选择服务商，填入 API Key，点「获取列表」选一个**支持图片输入**的模型，再点「测试连接」确认可用，然后保存。
3. 之后在任何网站点击图标即可识别并回填。脚本管理器菜单里的「验证码识别助手设置」可以随时打开面板。

可选功能都在「功能设置」里：验证码出现或变化时自动识别、识别后复制到剪贴板、右上角通知、每天自动更新远程规则。

### 支持的服务商

| 服务商 | 说明 |
|---|---|
| OpenAI | 官方接口，也可填自定义地址 |
| Google Gemini | Key 通过请求头发送，不出现在 URL 里 |
| 阿里云通义千问 | DashScope 的 OpenAI 兼容接口 |
| Anthropic Claude | Messages API |
| Ollama（本地） | 默认 `http://localhost:11434`，不需要 Key，图片不离开本机 |
| 自定义（OpenAI 兼容） | 任何兼容 Chat Completions 的接口，Key 可选 |

脚本不内置默认模型名：各家的模型更新很快，写死的名字容易过期。请用「获取列表」从服务商当前可用的模型里选。

### 需要知道的事

- 验证码图片会发送给你配置的模型服务（选 Ollama 时只发到本机）。
- API Key 以明文保存在脚本管理器的存储里，所有网站共用一份配置。
- 脚本匹配所有网站，可以在「禁用域名」里排除不需要的站点。
- 只处理「看图输入字符」类验证码，不处理滑块、点选等交互式验证码。

## 与上游的差异

**身份**

- 名称、作者、命名空间、图标都换成了自己的，集中在 `src/meta.ts`。
- 规则地址不再指向上游仓库。站点规则随脚本一起打包，离线可用；在 `src/meta.ts` 里填上自己的仓库后，默认远程规则地址会指向自己仓库的 `rules.json`。

**服务商**

- 新增 Anthropic Claude、本地 Ollama、自定义 OpenAI 兼容接口。
- 新增「获取列表」：从服务商拉取当前可用的模型，不再依赖写死的默认模型名。
- 「测试连接」改为发送一张本地生成的测试图片，并显示识别结果或接口返回的具体错误。
- 请求增加 30 秒超时；出错时显示接口返回的错误信息，而不只是状态码。

**代码**

- 原来 2800 行的单个 `app.vue` 拆成了按职责划分的 TypeScript 模块，去掉了重复的检测和规则匹配代码。
- 界面从 Vue 改为 React。识别、检测、服务商等核心模块不依赖任何界面框架，React 只负责设置面板。
- React 打包进脚本，不再通过 `@require` 从 unpkg 加载；产物因此经过压缩，约 280 KB。
- 服务商由一张表驱动（`src/providers/presets.ts`），新增一家 OpenAI 兼容的服务商只需要加一条记录。
- 增加了单元测试和在真实 Chrome 里跑的端到端测试。

**行为和界面**

- 自动识别模式下，同一张图片只识别一次；上游在一张图片同时命中多个选择器时会重复调用接口。
- 设置面板在副本上编辑，点「取消」会真正丢弃修改。
- API Key 默认以密码框显示，可切换显示。
- 提示词改为所有服务商共用一份。
- 回填输入框时兼容 React / Vue 接管的输入框。
- 找不到匹配的输入框时，改为选离验证码最近的文本输入框；上游会退回到页面上的第一个输入框，可能误填到用户名。
- 通配符规则（如 `*.example.org`）现在可以按域名匹配。
- 「禁用域名」增加了「添加当前网站」按钮。
- 脚本菜单只在顶层页面注册一次。

保存的设置格式与上游不兼容，并且这是一个独立的脚本，需要重新填写 API Key。

## 开发

```bash
npm run dev        # 启动开发服务器，按提示安装开发版脚本，改代码后自动刷新
npm run typecheck  # 类型检查
npm test           # 单元测试
npm run build      # 类型检查并构建
npm run test:e2e   # 端到端测试，需要先 build，且本机装有 Chrome
```

端到端测试使用假的脚本管理器 API 和假的模型接口，不访问任何真实网站或真实模型。

### 目录结构

```
src/
  meta.ts                脚本身份：名称、作者、命名空间、仓库
  main.tsx               入口：挂载 React，启动识别功能
  state.ts               应用状态和操作：设置、规则、面板开关，不依赖 React
  App.tsx                外壳：订阅状态，渲染设置面板
  prompts.ts             默认识别提示词
  components/
    SettingsPanel.tsx    设置面板：标签页切换，管理正在编辑的设置副本
    SelectorList.tsx     可增删的选择器列表
    useAsyncStatus.ts    按钮的加载中 / 成功 / 失败状态
    tabs/
      ProviderTab.tsx    AI 服务商和提示词
      FunctionTab.tsx    功能开关
      DomainTab.tsx      禁用域名
      AdvancedTab.tsx    自定义选择器和站点规则
  core/
    controller.ts        页面行为：扫描、挂图标、监听变化、识别并回填
    detect.ts            查找验证码元素和对应的输入框
    image.ts             把 img / canvas 转成 base64
    fill.ts              回填输入框、复制到剪贴板
    rules.ts             站点规则的加载、缓存和匹配
    pattern.ts           网址和域名的模式匹配
    settings.ts          设置的默认值、读取和保存
    store.ts             状态容器，React 通过 useSyncExternalStore 订阅
    http.ts              请求封装（GM_xmlhttpRequest / fetch）
    storage.ts           存储封装（GM 存储 / localStorage）
    siteFixes.ts         个别网站的图标位置适配
    toast.ts             右上角通知
  providers/
    presets.ts           服务商列表
    protocols.ts         三种接口协议：OpenAI 兼容、Gemini、Anthropic
    index.ts             识别和获取模型列表的入口
    clean.ts             清洗模型输出
rules.json               站点规则（打包进脚本，也可作为远程规则文件）
tests/                   单元测试和端到端测试
```

### 新增服务商

如果接口兼容 OpenAI Chat Completions，在 `src/providers/presets.ts` 里加一条即可：

```ts
{
	id: 'myprovider',
	label: '我的服务商',
	protocol: openaiProtocol,
	defaultUrl: 'https://api.example.com/v1/chat/completions',
	requiresKey: true,
},
```

再把它的域名加进 `vite.config.ts` 的 `connect` 列表。接口格式不同的服务商需要在 `protocols.ts` 里实现一个新的 `Protocol`。

### 适配新网站

在 `rules.json` 里加一条规则，格式见 [docs/advanced-settings.md](docs/advanced-settings.md)。临时适配可以直接在设置面板的「高级设置」里添加选择器。

## 许可与声明

基于 Apache-2.0 许可，见 [LICENSE](LICENSE) 和 [NOTICE](NOTICE)。

请只在你有权使用的账号和网站上使用，并遵守网站的服务条款和适用的法律法规。
