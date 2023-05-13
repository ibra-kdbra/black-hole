import glsl from 'vite-plugin-glsl';
import { defineConfig } from 'vite'

export default defineConfig({
    root: 'sources',
    build:
    {
        outDir: '../dist',
        emptyOutDir: true,
        sourcemap: true
    },
    plugins: [glsl()]
})