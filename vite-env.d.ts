/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_FIREBASE_API_KEY: string;
    readonly VITE_FIREBASE_AUTH_DOMAIN: string;
    readonly VITE_FIREBASE_PROJECT_ID: string;
    readonly VITE_FIREBASE_STORAGE_BUCKET: string;
    readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
    readonly VITE_FIREBASE_APP_ID: string;
    readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
    readonly VITE_BACKEND_PROVIDER?: 'local' | 'firebase';
    readonly VITE_AI_PROVIDER?: 'gemini';
    readonly VITE_VIDEO_PROVIDER?: 'disabled' | 'gemini' | 'veo';
    readonly VITE_API_BASE_URL?: string;
    // Add other environment variables as needed
}
interface Window {
    aistudio?: {
        hasSelectedApiKey: () => Promise<boolean>;
        openSelectKey: () => Promise<void>;
    };
}
interface ImportMeta {
    readonly env: ImportMetaEnv;
}
