import type { HttpRequest } from '../core/http';

/** 每个服务商各自保存的配置 */
export interface ProviderConfig {
	apiKey: string;
	/** 自定义 API 地址，留空使用该服务商的默认地址 */
	apiUrl: string;
	model: string;
}

/** 接口协议：决定请求怎么拼、响应怎么解析 */
export interface Protocol {
	/** 构造识别请求 */
	buildRecognize(def: ProviderDef, config: ProviderConfig, prompt: string, base64Png: string): HttpRequest;
	/** 从识别响应中取出模型输出的原始文本 */
	parseText(response: unknown): string;
	/** 构造「获取模型列表」请求 */
	buildListModels(def: ProviderDef, config: ProviderConfig): HttpRequest;
	/** 从模型列表响应中取出模型名 */
	parseModels(response: unknown): string[];
}

/** 服务商定义。新增服务商只需要往 presets.ts 里加一条 */
export interface ProviderDef {
	id: string;
	label: string;
	protocol: Protocol;
	/** 默认 API 地址；为空表示必须由用户填写 */
	defaultUrl: string;
	/** 是否必须填写 API Key */
	requiresKey: boolean;
	keyPlaceholder?: string;
	/** 模型输入框的示例 */
	modelPlaceholder?: string;
	/** 追加到请求体里的额外参数 */
	extraBody?: Record<string, unknown>;
	/** 显示在表单下方的说明 */
	note?: string;
}
