import vitePluginSocketIO from 'vite-plugin-socket-io'
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [vitePluginSocketIO()]
})