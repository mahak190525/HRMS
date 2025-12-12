import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2015',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
          supabase: ['@supabase/supabase-js'],
          utils: ['date-fns', 'clsx', 'tailwind-merge'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    include: ['react', 'react-dom/client', "xlsx", "file-saver", "jspdf", "jspdf-autotable", "recharts", "@radix-ui/react-tooltip", "jszip", "@radix-ui/react-scroll-area", "@tiptap/react", "@tiptap/starter-kit", "@tiptap/extension-image", "@tiptap/extension-list", "@tiptap/extension-text-align", "@tiptap/extension-typography", "@tiptap/extension-highlight", "@tiptap/extension-subscript", "@tiptap/extension-superscript", "@tiptap/pm/state", "@tiptap/extension-horizontal-rule", "@floating-ui/react", "react-hotkeys-hook", "@radix-ui/react-select", "@radix-ui/react-tabs", "@radix-ui/react-switch", "@radix-ui/react-separator", "@radix-ui/react-progress", "@radix-ui/react-popover", "cmdk", "@radix-ui/react-checkbox", "react-router-dom", "@tanstack/react-query", "sonner", "@azure/msal-browser", "@azure/msal-react", "bcryptjs", "lucide-react", "@radix-ui/react-slot", "class-variance-authority", "@supabase/supabase-js", "react-hook-form", "@hookform/resolvers/zod", "zod", "@radix-ui/react-dialog", "@radix-ui/react-label", "clsx", "tailwind-merge", "@radix-ui/react-avatar", "@radix-ui/react-dropdown-menu", "date-fns", "uuid"]
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    allowedHosts: ['dev.hrms.mechlintech.com'],
  },
});
