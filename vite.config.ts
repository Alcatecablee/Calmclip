import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const COI_HEADERS = {
  'Cross-Origin-Opener-Policy':   'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'onnxruntime-node': path.resolve(__dirname, './stubs/onnxruntime-node.js'),
    },
  },
  server: {
    port: 5000,
    host: true,
    allowedHosts: true,
    headers: COI_HEADERS,
    fs: {
      allow: ['..'],
    },
  },
  preview: {
    port: 5000,
    host: true,
    headers: COI_HEADERS,
  },
  optimizeDeps: {
    include: ['onnxruntime-web'],
    // Excluded packages use new URL("./worker.js", import.meta.url) internally.
    // Pre-bundling rewrites import.meta.url to the deps cache path, breaking
    // relative worker URL resolution. Serving them as-is preserves the correct path.
    exclude: ['@xenova/transformers', '@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  worker: {
    format: 'es',
  },
})
