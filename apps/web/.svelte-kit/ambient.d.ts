
// this file is generated — do not edit it


/// <reference types="@sveltejs/kit" />

/**
 * This module provides access to environment variables that are injected _statically_ into your bundle at build time and are limited to _private_ access.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Static environment variables are [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env` at build time and then statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * **_Private_ access:**
 * 
 * - This module cannot be imported into client-side code
 * - This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured)
 * 
 * For example, given the following build time environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { ENVIRONMENT, PUBLIC_BASE_URL } from '$env/static/private';
 * 
 * console.log(ENVIRONMENT); // => "production"
 * console.log(PUBLIC_BASE_URL); // => throws error during build
 * ```
 * 
 * The above values will be the same _even if_ different values for `ENVIRONMENT` or `PUBLIC_BASE_URL` are set at runtime, as they are statically replaced in your code with their build time values.
 */
declare module '$env/static/private' {
	export const SHELL: string;
	export const npm_command: string;
	export const COREPACK_ENABLE_AUTO_PIN: string;
	export const GHOSTTY_BIN_DIR: string;
	export const FISH_AUDIO_MODEL: string;
	export const COLORTERM: string;
	export const __FISH_EXA_BASE_ALIASES: string;
	export const __FISH_EXA_EXPANDED: string;
	export const XPC_FLAGS: string;
	export const EXA_LAD_OPTIONS: string;
	export const TERM_PROGRAM_VERSION: string;
	export const EXA_LG_OPTIONS: string;
	export const FREESOUND_API_ID: string;
	export const TURN_HOST: string;
	export const NODE: string;
	export const EXA_LAI_OPTIONS: string;
	export const EXA_LE_OPTIONS: string;
	export const APP_STORE_CONNECT_API_KEY_ID: string;
	export const __CFBundleIdentifier: string;
	export const SSH_AUTH_SOCK: string;
	export const STRIPE_WEBHOOK_SECRET: string;
	export const GOOGLE_CLOUD_PROJECT_ID: string;
	export const TELNYX_API_KEY: string;
	export const CLAUDE_SETUP_TOKEN_SPYDER: string;
	export const OURACLE_OPENROUTER_EMBEDDING_MODEL: string;
	export const GEMINI_API_KEY: string;
	export const APP_STORE_CONNECT_API_KEY_SECRET: string;
	export const __FISH_EXA_ALIASES: string;
	export const TODOIST_VERIFICATION_TOKEN: string;
	export const OSLogRateLimit: string;
	export const npm_config_local_prefix: string;
	export const HOMEBREW_AUTO_UPDATE_SECS: string;
	export const HOMEBREW_PREFIX: string;
	export const EXA_LAAI_OPTIONS: string;
	export const EDITOR: string;
	export const PWD: string;
	export const EXA_LI_OPTIONS: string;
	export const LOGNAME: string;
	export const TURN_API_KEY: string;
	export const MANPATH: string;
	export const PNPM_HOME: string;
	export const TURSO_API_KEY_SVNR: string;
	export const LaunchInstanceID: string;
	export const EXA_LL_OPTIONS: string;
	export const NoDefaultCurrentDirectoryInExePath: string;
	export const TURSO_API_KEY_FULLSMILE: string;
	export const FREESOUND_API_KEY: string;
	export const GEMINI_SPYDER_API_KEY: string;
	export const CLAUDECODE: string;
	export const COMMAND_MODE: string;
	export const GHOSTTY_SHELL_FEATURES: string;
	export const HOME: string;
	export const LANG: string;
	export const MIRO_ACCESS_TOKEN: string;
	export const TURN_USERNAME: string;
	export const APP_STORE_CONNECT_API_ISSUER_ID: string;
	export const CLAUDE_SETUP_TOKEN_OURSELF: string;
	export const EXA_LAID_OPTIONS: string;
	export const CARGO_HOME: string;
	export const npm_package_version: string;
	export const SECURITYSESSIONID: string;
	export const HOMEBREW_NO_ENV_HINTS: string;
	export const STARSHIP_SHELL: string;
	export const TOKEN_AGENTMAIL_SVNR: string;
	export const TMPDIR: string;
	export const EXA_LA_OPTIONS: string;
	export const AICQ_TOKEN: string;
	export const __FISH_EXA_EXPANDED_OPT_NAME: string;
	export const EXA_LAAD_OPTIONS: string;
	export const MIRO_CLIENT_SECRET: string;
	export const OPEN_AI_KEY: string;
	export const EXA_LID_OPTIONS: string;
	export const FISH_API_KEY: string;
	export const TODOIST_ACCESS_TOKEN: string;
	export const TODOIST_CLIENT_SECRET: string;
	export const OURACLE_OPENROUTER_MODEL: string;
	export const __FISH_EXA_OPT_NAMES: string;
	export const STARSHIP_SESSION_KEY: string;
	export const OURACLE_OPENROUTER_PROVIDER_ORDER: string;
	export const INFOPATH: string;
	export const npm_lifecycle_script: string;
	export const OURACLE_OPENAI_API_KEY: string;
	export const EXA_STANDARD_OPTIONS: string;
	export const TWILIO_SVNR_SECRET: string;
	export const NOTION_OPENCLAW_SECRET: string;
	export const GHOSTTY_RESOURCES_DIR: string;
	export const TELNYX_PHONE_NUMBER: string;
	export const ANDROID_HOME: string;
	export const TOKEN_AGENTMAIL_ORFX: string;
	export const TERM: string;
	export const TERMINFO: string;
	export const npm_package_name: string;
	export const OPENCLAW_OPENROUTER_API_KEY: string;
	export const MIRO_CLIENT_ID: string;
	export const ANTHROPIC_API_KEY_LEVELOUT: string;
	export const ASDF_DIR: string;
	export const __FISH_EXA_BINARY: string;
	export const USER: string;
	export const TELNYX_PROFILE_ID: string;
	export const HOMEBREW_CELLAR: string;
	export const TWILIO_SVNR_SID: string;
	export const CARGO_INSTALL_ROOT: string;
	export const npm_lifecycle_event: string;
	export const SHLVL: string;
	export const EXA_LT_OPTIONS: string;
	export const FISH_AUDIO_VOICE_ALF: string;
	export const ELEVENLABS_API_KEY: string;
	export const EXA_LAA_OPTIONS: string;
	export const GIT_EDITOR: string;
	export const ANDROID_SDK_ROOT: string;
	export const HOMEBREW_REPOSITORY: string;
	export const GROQ_API_KEY: string;
	export const __FISH_EXA_SORT_OPTIONS: string;
	export const NOTION_API_KEY: string;
	export const XPC_SERVICE_NAME: string;
	export const npm_config_user_agent: string;
	export const OURACLE_OPENROUTER_API_KEY: string;
	export const TOKEN_TELEGRAM_ORFXBOT: string;
	export const OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE: string;
	export const npm_execpath: string;
	export const EXA_LC_OPTIONS: string;
	export const EXA_LAAID_OPTIONS: string;
	export const EXA_LO_OPTIONS: string;
	export const CLAUDE_CODE_ENTRYPOINT: string;
	export const PYENV_ROOT: string;
	export const GOOGLE_API_KEY: string;
	export const TURN_PASSWORD: string;
	export const npm_package_json: string;
	export const EXA_LD_OPTIONS: string;
	export const TWILIO_AUTH_TOKEN: string;
	export const XDG_DATA_DIRS: string;
	export const TURSO_AUTH_TOKEN_LEVELOUT: string;
	export const PATH: string;
	export const EELIOT_ADMIN_PASSWORD: string;
	export const BRAVE_SEARCH_API_KEY: string;
	export const d8df024d9f604cccb4426f28fd08bbc4: string;
	export const OPENROUTER_MODEL: string;
	export const FISH_AUDIO_MODEL_ID: string;
	export const METERED_CA_SECRET: string;
	export const FISH_AUDIO_VOICE_OPRAH: string;
	export const FISH_AUDIO_API_KEY: string;
	export const npm_node_execpath: string;
	export const TODOIST_CLIENT_ID: string;
	export const OLDPWD: string;
	export const __CF_USER_TEXT_ENCODING: string;
	export const FREESOUND_API_SECRET: string;
	export const FISH_AUDIO_VOICE_GALADRIEL: string;
	export const EXA_L_OPTIONS: string;
	export const TERM_PROGRAM: string;
	export const _: string;
	export const NODE_ENV: string;
}

/**
 * This module provides access to environment variables that are injected _statically_ into your bundle at build time and are _publicly_ accessible.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Static environment variables are [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env` at build time and then statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * **_Public_ access:**
 * 
 * - This module _can_ be imported into client-side code
 * - **Only** variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`) are included
 * 
 * For example, given the following build time environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { ENVIRONMENT, PUBLIC_BASE_URL } from '$env/static/public';
 * 
 * console.log(ENVIRONMENT); // => throws error during build
 * console.log(PUBLIC_BASE_URL); // => "http://site.com"
 * ```
 * 
 * The above values will be the same _even if_ different values for `ENVIRONMENT` or `PUBLIC_BASE_URL` are set at runtime, as they are statically replaced in your code with their build time values.
 */
declare module '$env/static/public' {
	
}

/**
 * This module provides access to environment variables set _dynamically_ at runtime and that are limited to _private_ access.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Dynamic environment variables are defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`.
 * 
 * **_Private_ access:**
 * 
 * - This module cannot be imported into client-side code
 * - This module includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured)
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 * 
 * > [!NOTE] To get correct types, environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * >
 * > ```env
 * > MY_FEATURE_FLAG=
 * > ```
 * >
 * > You can override `.env` values from the command line like so:
 * >
 * > ```sh
 * > MY_FEATURE_FLAG="enabled" npm run dev
 * > ```
 * 
 * For example, given the following runtime environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { env } from '$env/dynamic/private';
 * 
 * console.log(env.ENVIRONMENT); // => "production"
 * console.log(env.PUBLIC_BASE_URL); // => undefined
 * ```
 */
declare module '$env/dynamic/private' {
	export const env: {
		SHELL: string;
		npm_command: string;
		COREPACK_ENABLE_AUTO_PIN: string;
		GHOSTTY_BIN_DIR: string;
		FISH_AUDIO_MODEL: string;
		COLORTERM: string;
		__FISH_EXA_BASE_ALIASES: string;
		__FISH_EXA_EXPANDED: string;
		XPC_FLAGS: string;
		EXA_LAD_OPTIONS: string;
		TERM_PROGRAM_VERSION: string;
		EXA_LG_OPTIONS: string;
		FREESOUND_API_ID: string;
		TURN_HOST: string;
		NODE: string;
		EXA_LAI_OPTIONS: string;
		EXA_LE_OPTIONS: string;
		APP_STORE_CONNECT_API_KEY_ID: string;
		__CFBundleIdentifier: string;
		SSH_AUTH_SOCK: string;
		STRIPE_WEBHOOK_SECRET: string;
		GOOGLE_CLOUD_PROJECT_ID: string;
		TELNYX_API_KEY: string;
		CLAUDE_SETUP_TOKEN_SPYDER: string;
		OURACLE_OPENROUTER_EMBEDDING_MODEL: string;
		GEMINI_API_KEY: string;
		APP_STORE_CONNECT_API_KEY_SECRET: string;
		__FISH_EXA_ALIASES: string;
		TODOIST_VERIFICATION_TOKEN: string;
		OSLogRateLimit: string;
		npm_config_local_prefix: string;
		HOMEBREW_AUTO_UPDATE_SECS: string;
		HOMEBREW_PREFIX: string;
		EXA_LAAI_OPTIONS: string;
		EDITOR: string;
		PWD: string;
		EXA_LI_OPTIONS: string;
		LOGNAME: string;
		TURN_API_KEY: string;
		MANPATH: string;
		PNPM_HOME: string;
		TURSO_API_KEY_SVNR: string;
		LaunchInstanceID: string;
		EXA_LL_OPTIONS: string;
		NoDefaultCurrentDirectoryInExePath: string;
		TURSO_API_KEY_FULLSMILE: string;
		FREESOUND_API_KEY: string;
		GEMINI_SPYDER_API_KEY: string;
		CLAUDECODE: string;
		COMMAND_MODE: string;
		GHOSTTY_SHELL_FEATURES: string;
		HOME: string;
		LANG: string;
		MIRO_ACCESS_TOKEN: string;
		TURN_USERNAME: string;
		APP_STORE_CONNECT_API_ISSUER_ID: string;
		CLAUDE_SETUP_TOKEN_OURSELF: string;
		EXA_LAID_OPTIONS: string;
		CARGO_HOME: string;
		npm_package_version: string;
		SECURITYSESSIONID: string;
		HOMEBREW_NO_ENV_HINTS: string;
		STARSHIP_SHELL: string;
		TOKEN_AGENTMAIL_SVNR: string;
		TMPDIR: string;
		EXA_LA_OPTIONS: string;
		AICQ_TOKEN: string;
		__FISH_EXA_EXPANDED_OPT_NAME: string;
		EXA_LAAD_OPTIONS: string;
		MIRO_CLIENT_SECRET: string;
		OPEN_AI_KEY: string;
		EXA_LID_OPTIONS: string;
		FISH_API_KEY: string;
		TODOIST_ACCESS_TOKEN: string;
		TODOIST_CLIENT_SECRET: string;
		OURACLE_OPENROUTER_MODEL: string;
		__FISH_EXA_OPT_NAMES: string;
		STARSHIP_SESSION_KEY: string;
		OURACLE_OPENROUTER_PROVIDER_ORDER: string;
		INFOPATH: string;
		npm_lifecycle_script: string;
		OURACLE_OPENAI_API_KEY: string;
		EXA_STANDARD_OPTIONS: string;
		TWILIO_SVNR_SECRET: string;
		NOTION_OPENCLAW_SECRET: string;
		GHOSTTY_RESOURCES_DIR: string;
		TELNYX_PHONE_NUMBER: string;
		ANDROID_HOME: string;
		TOKEN_AGENTMAIL_ORFX: string;
		TERM: string;
		TERMINFO: string;
		npm_package_name: string;
		OPENCLAW_OPENROUTER_API_KEY: string;
		MIRO_CLIENT_ID: string;
		ANTHROPIC_API_KEY_LEVELOUT: string;
		ASDF_DIR: string;
		__FISH_EXA_BINARY: string;
		USER: string;
		TELNYX_PROFILE_ID: string;
		HOMEBREW_CELLAR: string;
		TWILIO_SVNR_SID: string;
		CARGO_INSTALL_ROOT: string;
		npm_lifecycle_event: string;
		SHLVL: string;
		EXA_LT_OPTIONS: string;
		FISH_AUDIO_VOICE_ALF: string;
		ELEVENLABS_API_KEY: string;
		EXA_LAA_OPTIONS: string;
		GIT_EDITOR: string;
		ANDROID_SDK_ROOT: string;
		HOMEBREW_REPOSITORY: string;
		GROQ_API_KEY: string;
		__FISH_EXA_SORT_OPTIONS: string;
		NOTION_API_KEY: string;
		XPC_SERVICE_NAME: string;
		npm_config_user_agent: string;
		OURACLE_OPENROUTER_API_KEY: string;
		TOKEN_TELEGRAM_ORFXBOT: string;
		OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE: string;
		npm_execpath: string;
		EXA_LC_OPTIONS: string;
		EXA_LAAID_OPTIONS: string;
		EXA_LO_OPTIONS: string;
		CLAUDE_CODE_ENTRYPOINT: string;
		PYENV_ROOT: string;
		GOOGLE_API_KEY: string;
		TURN_PASSWORD: string;
		npm_package_json: string;
		EXA_LD_OPTIONS: string;
		TWILIO_AUTH_TOKEN: string;
		XDG_DATA_DIRS: string;
		TURSO_AUTH_TOKEN_LEVELOUT: string;
		PATH: string;
		EELIOT_ADMIN_PASSWORD: string;
		BRAVE_SEARCH_API_KEY: string;
		d8df024d9f604cccb4426f28fd08bbc4: string;
		OPENROUTER_MODEL: string;
		FISH_AUDIO_MODEL_ID: string;
		METERED_CA_SECRET: string;
		FISH_AUDIO_VOICE_OPRAH: string;
		FISH_AUDIO_API_KEY: string;
		npm_node_execpath: string;
		TODOIST_CLIENT_ID: string;
		OLDPWD: string;
		__CF_USER_TEXT_ENCODING: string;
		FREESOUND_API_SECRET: string;
		FISH_AUDIO_VOICE_GALADRIEL: string;
		EXA_L_OPTIONS: string;
		TERM_PROGRAM: string;
		_: string;
		NODE_ENV: string;
		[key: `PUBLIC_${string}`]: undefined;
		[key: `${string}`]: string | undefined;
	}
}

/**
 * This module provides access to environment variables set _dynamically_ at runtime and that are _publicly_ accessible.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Dynamic environment variables are defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`.
 * 
 * **_Public_ access:**
 * 
 * - This module _can_ be imported into client-side code
 * - **Only** variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`) are included
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 * 
 * > [!NOTE] To get correct types, environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * >
 * > ```env
 * > MY_FEATURE_FLAG=
 * > ```
 * >
 * > You can override `.env` values from the command line like so:
 * >
 * > ```sh
 * > MY_FEATURE_FLAG="enabled" npm run dev
 * > ```
 * 
 * For example, given the following runtime environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://example.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { env } from '$env/dynamic/public';
 * console.log(env.ENVIRONMENT); // => undefined, not public
 * console.log(env.PUBLIC_BASE_URL); // => "http://example.com"
 * ```
 * 
 * ```
 * 
 * ```
 */
declare module '$env/dynamic/public' {
	export const env: {
		[key: `PUBLIC_${string}`]: string | undefined;
	}
}
