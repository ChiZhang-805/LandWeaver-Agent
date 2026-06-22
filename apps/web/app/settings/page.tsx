"use client";

import { Eye, EyeOff, KeyRound, RefreshCcw, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { StatusPill } from "@/components/StatusPill";
import { clearOpenAISettings, getOpenAISettings, getStoredOpenAISettings, saveOpenAISettings } from "@/lib/api";
import {
  CUSTOM_MODEL_VALUE,
  FAST_MODEL_OPTIONS,
  OpenAIModelOption,
  TEXT_MODEL_OPTIONS,
  modelDescription,
  modelSelectValue
} from "@/lib/openaiModels";
import type { OpenAISettingsStatus } from "@/lib/types";

function sourceLabel(source?: OpenAISettingsStatus["source"]) {
  if (source === "browser") return "本浏览器";
  if (source === "web") return "网页设置";
  if (source === "env") return "环境变量";
  return "Mock";
}

function ModelSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: OpenAIModelOption[];
  onChange: (value: string) => void;
}) {
  const selected = modelSelectValue(value, options);

  return (
    <label className="grid gap-1.5 text-sm font-semibold text-ink">
      <span className="text-xs text-slate-500">{label}</span>
      <select
        className="input-control"
        value={selected}
        onChange={(event) => onChange(event.target.value === CUSTOM_MODEL_VALUE ? "" : event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        <option value={CUSTOM_MODEL_VALUE}>自定义模型 ID</option>
      </select>
      {selected === CUSTOM_MODEL_VALUE ? (
        <input
          className="input-control font-mono text-sm"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="例如 gpt-5.5"
          autoComplete="off"
          spellCheck={false}
        />
      ) : (
        <span className="text-xs font-medium leading-5 text-slate-500">{modelDescription(value, options)}</span>
      )}
    </label>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<OpenAISettingsStatus | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [modelText, setModelText] = useState("gpt-5.5");
  const [modelFast, setModelFast] = useState("gpt-5.4-mini");
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState("");

  async function load() {
    try {
      setStatus("");
      const next = await getOpenAISettings();
      const stored = getStoredOpenAISettings();
      setSettings(next);
      setModelText(stored.modelText || next.model_text);
      setModelFast(stored.modelFast || next.model_fast);
      setApiKey("");
    } catch (event) {
      setStatus(event instanceof Error ? event.message : "加载失败");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    try {
      const cleanedModelText = modelText.trim();
      const cleanedModelFast = modelFast.trim();
      if (!cleanedModelText || !cleanedModelFast) {
        setStatus("请先选择或填写完整模型 ID");
        return;
      }
      const payload: { api_key?: string; model_text?: string; model_fast?: string } = {
        model_text: cleanedModelText,
        model_fast: cleanedModelFast
      };
      if (apiKey.trim()) payload.api_key = apiKey.trim();
      const next = await saveOpenAISettings(payload);
      setSettings(next);
      setApiKey("");
      setShowKey(false);
      setStatus("OpenAI 设置已保存到当前浏览器");
    } catch (event) {
      setStatus(event instanceof Error ? event.message : "保存失败");
    }
  }

  async function clear() {
    if (!window.confirm("清除当前浏览器保存的 OpenAI API Key 和模型选择？")) return;
    try {
      const next = await clearOpenAISettings();
      setSettings(next);
      setApiKey("");
      setModelText(next.model_text);
      setModelFast(next.model_fast);
      setStatus("当前浏览器保存的 OpenAI 设置已清除");
    } catch (event) {
      setStatus(event instanceof Error ? event.message : "清除失败");
    }
  }

  return (
    <Shell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="page-kicker">SETTINGS</p>
          <h1 className="page-title mt-2">OpenAI 设置</h1>
          <p className="page-copy mt-2">模型、密钥和当前来源；Key 与模型选择只保存在当前浏览器。</p>
        </div>
        <button title="刷新" className="icon-button border border-line bg-white" onClick={load}>
          <RefreshCcw size={16} aria-hidden />
          <span>刷新</span>
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.72fr_1.28fr]">
        <div className="panel p-5">
          <h2 className="section-title">连接状态</h2>
          <div className="mt-4 grid gap-3">
            <div className="rounded-[8px] border border-line bg-white p-4">
              <p className="text-xs font-bold text-slate-500">状态</p>
              <div className="mt-2">
                <StatusPill tone={settings?.configured ? "ok" : "warn"}>{settings?.configured ? "已配置" : "未配置"}</StatusPill>
              </div>
            </div>
            <div className="rounded-[8px] border border-line bg-white p-4">
              <p className="text-xs font-bold text-slate-500">来源</p>
              <p className="mt-2 text-lg font-black text-ink">{sourceLabel(settings?.source)}</p>
            </div>
            <div className="rounded-[8px] border border-line bg-white p-4">
              <p className="text-xs font-bold text-slate-500">Key</p>
              <p className="mt-2 font-mono text-sm font-bold text-ink">{settings?.masked_key || "-"}</p>
            </div>
          </div>
        </div>

        <div className="panel p-5">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-[8px] border border-teal/20 bg-teal/10 text-teal">
              <KeyRound size={18} aria-hidden />
            </span>
            <h2 className="section-title">API Key</h2>
          </div>

          <div className="grid gap-4">
            <label className="grid gap-1.5 text-sm font-semibold text-ink">
              <span className="text-xs text-slate-500">OpenAI API Key</span>
              <div className="flex overflow-hidden rounded-[8px] border border-line bg-white focus-within:border-teal focus-within:shadow-[0_0_0_4px_rgba(15,118,110,0.1)]">
                <input
                  className="min-h-[42px] min-w-0 flex-1 bg-transparent px-3 font-mono text-sm text-ink outline-none"
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  placeholder={settings?.masked_key || "sk-..."}
                  onChange={(event) => setApiKey(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  title={showKey ? "隐藏 API Key" : "显示 API Key"}
                  className="flex w-11 items-center justify-center border-l border-line text-slate-500 hover:bg-field hover:text-ink"
                  onClick={() => setShowKey((value) => !value)}
                >
                  {showKey ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
                </button>
              </div>
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <ModelSelect label="解释模型" value={modelText} options={TEXT_MODEL_OPTIONS} onChange={setModelText} />
              <ModelSelect label="简报模型" value={modelFast} options={FAST_MODEL_OPTIONS} onChange={setModelFast} />
            </div>

            <div className="flex flex-wrap gap-2">
              <button title="保存 OpenAI 设置" className="icon-button bg-teal text-white" onClick={save}>
                <Save size={16} aria-hidden />
                <span>保存到本浏览器</span>
              </button>
              <button title="清除浏览器设置" className="icon-button border border-line bg-white text-rose" onClick={clear}>
                <Trash2 size={16} aria-hidden />
                <span>清除</span>
              </button>
            </div>
            <p className="text-xs leading-5 text-slate-500">
              API Key 和模型选择不会写入 Render 或后端文件；当前浏览器会在调用简报解析、方案解释和视觉设计时通过请求头临时发送。
            </p>
          </div>
        </div>
      </div>

      {status ? <p className={`mt-3 status-message ${status.includes("失败") ? "danger-message" : ""}`}>{status}</p> : null}
    </Shell>
  );
}
