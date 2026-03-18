/**
 * llm-client.js — unified LLM client for Ollama (local) and Groq (remote)
 *
 * Both providers speak OpenAI-compatible chat/completions, so we use the
 * openai SDK for both — just different baseURL and apiKey.
 *
 * Usage:
 *   const client = makeLlmClient();   // reads LLM_PROVIDER from env
 *   const reply = await client.chat({ system, messages, temperature });
 *
 * Environment:
 *   LLM_PROVIDER   'ollama' (default) | 'groq' | 'openrouter'
 *   OLLAMA_MODEL   default: 'llama3:8b'
 *   OLLAMA_HOST    default: 'http://localhost:11434'
 *   GROQ_API_KEY   required when LLM_PROVIDER=groq
 *   GROQ_MODEL     default: 'llama-3.1-8b-instant'
 *   OURACLE_OPENROUTER_API_KEY   required when LLM_PROVIDER=openrouter
 *   OPENROUTER_MODEL            default: 'openrouter/hunter-alpha'
 */

import OpenAI from 'openai';

const PROVIDERS = {
  ollama: {
    baseURL: () => `${process.env.OLLAMA_HOST || 'http://localhost:11434'}/v1`,
    apiKey: () => 'ollama',
    model: () => process.env.OLLAMA_MODEL || 'llama3:8b',
    headers: () => ({}),
  },
  groq: {
    baseURL: () => 'https://api.groq.com/openai/v1',
    apiKey: () => {
      const key = process.env.GROQ_API_KEY;
      if (!key) throw new Error('GROQ_API_KEY is not set.');
      return key;
    },
    model: () => process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    headers: () => ({}),
  },
  openrouter: {
    baseURL: () => 'https://openrouter.ai/api/v1',
    apiKey: () => {
      const key = process.env.OURACLE_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
      if (!key) throw new Error('OURACLE_OPENROUTER_API_KEY is not set.');
      return key;
    },
    model: () => process.env.OPENROUTER_MODEL || 'openrouter/hunter-alpha',
    headers: () => ({
      ...(process.env.OPENROUTER_REFERER ? { 'HTTP-Referer': process.env.OPENROUTER_REFERER } : {}),
      ...(process.env.OPENROUTER_TITLE ? { 'X-Title': process.env.OPENROUTER_TITLE } : {}),
    }),
  },
};

export function makeLlmClient(providerOverride) {
  const providerName = providerOverride
    || process.env.LLM_PROVIDER
    || (process.env.GROQ_API_KEY ? 'groq' : 'ollama');
  const provider = PROVIDERS[providerName];
  if (!provider) throw new Error(`Unknown LLM provider: "${providerName}". Use 'ollama', 'groq', or 'openrouter'.`);

  const openai = new OpenAI({
    baseURL: provider.baseURL(),
    apiKey: provider.apiKey(),
    defaultHeaders: provider.headers(),
  });

  const model = provider.model();

  /**
   * chat({ system, messages, temperature, maxTokens, stream })
   *
   * messages: [{ role: 'user'|'assistant', content: string }, ...]
   * Returns the full reply string (non-streaming) or an async iterable of
   * token strings (streaming).
   */
  async function chat({ system, messages = [], temperature = 0.9, maxTokens = 1024, stream = false }) {
    const payload = {
      model,
      temperature,
      max_tokens: maxTokens,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        ...messages,
      ],
      stream,
    };

    if (stream) {
      return openai.chat.completions.create({ ...payload, stream: true });
    }

    const res = await openai.chat.completions.create(payload);
    return res.choices[0]?.message?.content ?? '';
  }

  return { chat, model, provider: providerName };
}

/**
 * makeRawClient() — returns { openai, model, provider }
 * Use when you need direct access to the OpenAI SDK instance
 * (e.g. tool calling, structured output).
 */
export function makeRawClient(providerOverride) {
  const providerName = providerOverride
    || process.env.LLM_PROVIDER
    || (process.env.GROQ_API_KEY ? 'groq' : 'ollama');
  const provider = PROVIDERS[providerName];
  if (!provider) throw new Error(`Unknown LLM provider: "${providerName}". Use 'ollama', 'groq', or 'openrouter'.`);
  const openai = new OpenAI({ baseURL: provider.baseURL(), apiKey: provider.apiKey(), defaultHeaders: provider.headers() });
  return { openai, model: provider.model(), provider: providerName };
}
