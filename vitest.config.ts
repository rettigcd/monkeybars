import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "happy-dom",
		setupFiles: ["./test/setup.ts"]
	},
	resolve: {
		alias: {
			"~": new URL("./src", import.meta.url).pathname
		}
	}
});
