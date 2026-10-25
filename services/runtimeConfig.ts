export type BackendProvider = 'local' | 'firebase';
export type AiProvider = 'gemini';
export type VideoProvider = 'disabled' | 'gemini' | 'veo';

const select = <T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T =>
  value && allowed.includes(value as T) ? value as T : fallback;

export const runtimeConfig = Object.freeze({
  backendProvider: select(import.meta.env.VITE_BACKEND_PROVIDER, ['local', 'firebase'] as const, 'local'),
  aiProvider: select(import.meta.env.VITE_AI_PROVIDER, ['gemini'] as const, 'gemini'),
  videoProvider: select(import.meta.env.VITE_VIDEO_PROVIDER, ['disabled', 'gemini', 'veo'] as const, 'disabled'),
  apiBaseUrl: import.meta.env.VITE_BACKEND_PROVIDER === 'firebase' ? (import.meta.env.VITE_API_BASE_URL || '') : '',
});

export const isLocalMode = runtimeConfig.backendProvider === 'local';
