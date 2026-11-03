// 模型代理：服务端调用 cloudalpha（OpenAI 兼容），主模型失败自动换备用模型。
// 密钥只从服务端环境变量读；抛给调用方的错误不带上游细节。

const BASE_URL = process.env.LAB_LLM_BASE_URL || 'https://api.cloudalpha.top/v1';
// 别配 gpt-5.4：cloudalpha 中转会收下请求但静默换成别的模型。
const MODELS = [process.env.LAB_LLM_MODEL || 'gpt-5.5', process.env.LAB_LLM_FALLBACK_MODEL || 'gpt-5.4-mini'];
const TIMEOUT_MS = 60000;

export function hasModelKey() {
  return Boolean(process.env.CLOUDALPHA_API_KEY || process.env.OPENAI_API_KEY);
}

function parseJson(text: string) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no json');
  return JSON.parse(text.slice(start, end + 1));
}

async function callOnce(model: string, system: string, user: string, maxTokens: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.CLOUDALPHA_API_KEY || process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return { data: parseJson(json.choices?.[0]?.message?.content || ''), modelId: (json.model as string) || model };
  } finally {
    clearTimeout(timer);
  }
}

// 返回解析好的 JSON；所有模型都失败时抛出 Error('模型暂不可用')。
// validate 不通过（例如缺字段）也算这个模型失败，换下一个。
export async function chatJSON<T>(
  system: string,
  user: string,
  validate: (data: any) => T,
  maxTokens = 1200,
): Promise<{ data: T; modelId: string }> {
  if (!hasModelKey()) throw new Error('未配置模型密钥');
  for (const model of MODELS) {
    try {
      const { data, modelId } = await callOnce(model, system, user, maxTokens);
      return { data: validate(data), modelId };
    } catch (err: any) {
      console.error(`lab llm ${model} failed:`, err?.name === 'AbortError' ? 'timeout' : err?.message);
    }
  }
  throw new Error('模型暂不可用');
}
