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

// 联网研究：走 Responses API + web_search 工具（中转支持，chat/completions 不支持搜索）。
// 返回 Markdown 正文和模型引用过的链接；instructions 必须传，否则中转会套上它自己的默认人设。
export async function researchMarkdown(
  instructions: string,
  input: string,
  maxOutputTokens = 6000,
  timeoutMs = 240000,
): Promise<{ text: string; sources: { title: string; url: string }[]; modelId: string; searches: number }> {
  if (!hasModelKey()) throw new Error('未配置模型密钥');
  for (const model of MODELS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${BASE_URL}/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.CLOUDALPHA_API_KEY || process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({ model, instructions, input, tools: [{ type: 'web_search' }], max_output_tokens: maxOutputTokens }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const output: any[] = json.output || [];
      const parts = output.filter((o) => o.type === 'message').flatMap((o) => o.content || []);
      const text = parts.map((c) => c.text || '').join('\n').trim();
      if (text.length < 200) throw new Error('empty output');
      const seen = new Set<string>();
      const sources = parts
        .flatMap((c) => c.annotations || [])
        .filter((a) => a.url && !seen.has(a.url) && seen.add(a.url))
        .map((a) => ({ title: String(a.title || a.url).slice(0, 120), url: String(a.url) }));
      const searches = output.filter((o) => o.type === 'web_search_call').length;
      return { text, sources, modelId: (json.model as string) || model, searches };
    } catch (err: any) {
      console.error(`lab research ${model} failed:`, err?.name === 'AbortError' ? 'timeout' : err?.message);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('模型暂不可用');
}
