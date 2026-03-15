**Temple: a custom local/remote model for Ouracle**

Goal: develop and tune an oracle-style LLM flow locally with Ollama, then run it remotely using Groq’s OpenAI-compatible API, behind one shared abstraction (`LlmClient`).

---

## 1. Local Dev with Ollama

Environment: macOS (M1) with Ollama installed and running.

1. Pull a model that has a close cousin on Groq, for example:

   - `ollama pull llama3`

   - or `ollama pull llama3:8b`

   - or `ollama pull gemma2:9b`

2. Verify local chat works:

   - Use `curl http://localhost:11434/api/chat` with a JSON body like:

     - model: `"llama3"`

     - messages:

       - system: `"You are an ancient temple priestess oracle."`

       - user: `"Offer a three-line blessing about grief turning into beauty."`

3. Use this local endpoint to iterate on:

   - system prompts

   - temperature / sampling settings

   - output shape and formatting

All “oracle voice” tuning happens here first.

---

## 2. Remote Prod with Groq

1. Obtain a Groq API key and export it:

   - `export GROQ_API_KEY="sk-...redacted..."`

2. Choose a Groq model that conceptually matches the local Ollama model:

   - Local `llama3` → Groq `llama-3.3-70b-specdec` or `llama-3.1-8b-instant`

   - Local `gemma2:9b` → Groq `gemma2-9b-it`

3. Verify Groq chat API:

   - Send a POST to `https://api.groq.com/openai/v1/chat/completions` with:

     - headers:

       - `Content-Type: application/json`

       - `Authorization: Bearer $GROQ_API_KEY`

     - body:

       - model: `"llama-3.3-70b-specdec"`

       - messages:

         - system: `"You are an ancient temple priestess oracle."`

         - user: `"Offer a three-line blessing about grief turning into beauty."`

       - temperature: `0.8`

If that returns a completion, the remote head is alive.

---

## 3. Unified LLM Client

Implement one small client that can talk to either Ollama (local) or Groq (remote) with the same `chat()` signature.

Example in Node/JS (convert to your language as needed):

- Create `llmClient.js` with a class `LlmClient` that takes:

  - `provider`: `"ollama"` or `"groq"`

  - `model`: model name string

  - `apiKey`: for Groq

  - `baseUrl`: optional override

- Implement:

  - `chat({ system, user, temperature, maxTokens })`:

    - if provider is `ollama`, call a private `#chatOllama`

    - if provider is `groq`, call a private `#chatGroq`

- `#chatOllama`:

  - POST to `http://localhost:11434/api/chat` (or `baseUrl`)

  - JSON body:

    - model: local model name (e.g. `"llama3"`)

    - temperature: float

    - messages: `[ { role: "system", content: system }, { role: "user", content: user } ]`

  - Return `json.message.content`

- `#chatGroq`:

  - POST to `https://api.groq.com/openai/v1/chat/completions` (or `baseUrl`)

  - headers include `Authorization: Bearer apiKey`

  - JSON body:

    - model: Groq model name (e.g. `"llama-3.3-70b-specdec"`)

    - temperature: float

    - max_tokens: integer

    - messages: `[ { role: "system", content: system }, { role: "user", content: user } ]`

  - Return `json.choices[0].message.content`

The rest of your system (MEATAPI, TUI, etc.) calls only `llmClient.chat(...)`.

---

## 4. Environment-Based Switch

In your CLI/TUI or backend bootstrap:

1. Read `LLM_PROVIDER` from the environment (default to `"ollama"`).

2. Construct `llmClient` accordingly:

   - If `LLM_PROVIDER=ollama`:

     - provider: `"ollama"`

     - model: `"llama3"`

   - If `LLM_PROVIDER=groq`:

     - provider: `"groq"`

     - model: `"llama-3.3-70b-specdec"` (or chosen Groq model)

     - apiKey: `process.env.GROQ_API_KEY`

3. Usage example:

   - `llmClient.chat({ system: "You are an ancient temple priestess oracle of Ouracle.", user: "What is the medicine in today's storm?" })`

Local dev:

- `LLM_PROVIDER=ollama`

- `llama3` served by Ollama on `localhost:11434`.

Remote / prod:

- `LLM_PROVIDER=groq`

- `GROQ_API_KEY` set

- Requests go to Groq’s OpenAI-style endpoint.

---

## 5. Tuning Flow

- Do all prompt / temperature / output-structure tuning against Ollama locally.

- Once the oracle voice feels right, switch env to Groq and:

  - keep the same prompt scaffolding

  - adjust only:

    - provider: `"groq"`

    - model: Groq variant name

    - any minor temperature / max_tokens tweaks

- Keep all higher-level oracle logic dependent only on `llmClient.chat()` so you can swap providers and models without touching MEATAPI or the TUI behavior.


