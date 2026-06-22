export type OpenAIModelOption = {
  value: string;
  label: string;
  description: string;
};

export const CUSTOM_MODEL_VALUE = "__custom_openai_model__";

export const TEXT_MODEL_OPTIONS: OpenAIModelOption[] = [
  {
    value: "gpt-5.5",
    label: "gpt-5.5",
    description: "推荐：复杂解释、投资判断、方案比选"
  },
  {
    value: "gpt-5.4",
    label: "gpt-5.4",
    description: "均衡：质量较高，成本低于 flagship"
  },
  {
    value: "gpt-5.4-mini",
    label: "gpt-5.4-mini",
    description: "更快：适合日常解释和批量生成"
  },
  {
    value: "gpt-5.4-nano",
    label: "gpt-5.4-nano",
    description: "最低成本：适合轻量文本任务"
  },
  {
    value: "gpt-4.1",
    label: "gpt-4.1",
    description: "非推理备选：文本稳定，推理能力较弱"
  }
];

export const FAST_MODEL_OPTIONS: OpenAIModelOption[] = [
  {
    value: "gpt-5.4-mini",
    label: "gpt-5.4-mini",
    description: "推荐：简报抽取、轻量解析"
  },
  {
    value: "gpt-5.4-nano",
    label: "gpt-5.4-nano",
    description: "更低成本：高频简单抽取"
  },
  {
    value: "gpt-5.4",
    label: "gpt-5.4",
    description: "更稳：复杂资料抽取"
  },
  {
    value: "gpt-5.5",
    label: "gpt-5.5",
    description: "最高质量：慢一些，成本更高"
  }
];

export function modelSelectValue(value: string, options: OpenAIModelOption[]) {
  return options.some((option) => option.value === value) ? value : CUSTOM_MODEL_VALUE;
}

export function modelDescription(value: string, options: OpenAIModelOption[]) {
  return options.find((option) => option.value === value)?.description ?? "自定义模型 ID";
}
