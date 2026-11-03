import { SKILLS } from './skills.generated';
import { ToolDef } from './registry';

// 只在服务端用：skill 原文很长，不进前端包。

export function skillHash(tool: ToolDef) {
  return SKILLS[tool.skill]?.hash || '';
}

// skill 原文 + 网页版约束。网页版约束放在后面并写明优先级。
export function toolInstructions(tool: ToolDef, today: string) {
  return `${SKILLS[tool.skill].text}

---

# 网页版运行约束（优先级高于上面的 skill 原文）

你现在运行在一个网页工具里，用户在手机或电脑上等结果，看不到你的中间过程，也不能回答你的问题。
- 今天是 ${today}。用 web_search 搜集信息，优先最近 12 个月；财务数字必须注明财年/财季。
- 只输出最终的 Markdown 报告正文。不要寒暄，不要说“我将……”，不要向用户提问，不要提到 skill、保存文件、提交或推送。
- 第一行写：> 数据截止 ${today}｜仅供研究参考，不构成投资建议
- 第二行起用一级标题写报告名，例如“# 快手：现金故事”。
- 篇幅：${tool.length}。手机上读，段落短，多用小标题和列表；表格最多 4 列。
- 关键数字就近附上来源链接。搜不到的数据写「数据暂缺」，绝不编造。
- 如果用户给的公司名有歧义或查不到，就在报告里说明你按哪家公司理解的。
- 建议下一步时只用这些网页工具名，不写 skill 英文名：现金故事、致命风险、反方备忘录、公司故事、买方报告。`;
}

export function toolInput(tool: ToolDef, company: string, extra: string) {
  return [`公司：${company}`, extra ? `${tool.extra?.label.replace(/（可选）/, '') || '补充'}：${extra}` : ''].filter(Boolean).join('\n');
}
