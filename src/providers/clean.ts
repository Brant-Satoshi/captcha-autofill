/**
 * 清洗模型输出：去掉思考过程标签，只保留字母、数字和负号
 * （负号用于算术题验证码的负数结果）。
 */
export function cleanResult(raw: string): string {
	return raw
		.replace(/<think>[\s\S]*?<\/think>/gi, '')
		.trim()
		.replace(/[^a-zA-Z0-9-]/g, '');
}
