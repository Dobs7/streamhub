import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({mode})=>({base:'./',plugins:[react()],build:{outDir:mode==='tv'?'dist-tv':'dist',target:mode==='tv'?'chrome94':'es2022'}}));
