import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  if(Object.keys(env).some(key=>key.startsWith('VITE_')&&/(GEMINI|SECRET|PRIVATE|TOKEN|API_KEY)/i.test(key)&&key!=='VITE_FIREBASE_API_KEY'))throw Error('Provider secrets must not use the VITE_ browser-exposed prefix');
  return {
    server: {
      port: Number(env.FORMLAB_WEB_PORT || 3017),
      host: '127.0.0.1',
      strictPort: true,
      proxy: {
        '/api': { target: `http://127.0.0.1:${env.FORMLAB_API_PORT || 8787}`, changeOrigin: true },
        '/assets': { target: `http://127.0.0.1:${env.FORMLAB_API_PORT || 8787}`, changeOrigin: true, bypass(req) { if (!/^\/assets\/[a-f0-9-]{36}$/.test(req.url || '')) return req.url; } },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
