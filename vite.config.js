import { defineConfig } from 'vite'
import glsl from 'vite-plugin-glsl'

export default defineConfig(({ command }) => ({
    root: 'sources',

    // Relative base so the build runs from any static host, including
    // GitHub Pages project sites served under a sub-path
    base: './',

    plugins: [
        glsl({
            // Strip comments and whitespace from shaders in production,
            // keep them readable in development
            minify: command === 'build'
        })
    ],

    build: {
        outDir: '../dist',
        emptyOutDir: true,
        sourcemap: true,

        // A single-page WebGL app ships three.js as one chunk on purpose
        chunkSizeWarningLimit: 700
    }
}))
