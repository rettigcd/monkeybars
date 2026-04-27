import * as esbuild from "esbuild";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const projectRoot = process.cwd();
const scriptsDir = path.join(projectRoot, "src");
const distDir = path.join(projectRoot, "dist");
const isWatch = process.argv.includes("--watch");
const isDev = process.argv.includes("--dev");

async function ensureDirectory(dirPath) {
	await fs.mkdir(dirPath, { recursive: true });
}

async function getUserScriptEntries(dir = scriptsDir) {
	const entries = await fs.readdir(dir, { withFileTypes: true });

	const results = await Promise.all(
		entries.map(async (entry) => {
			const fullPath = path.join(dir, entry.name);

			if (entry.isDirectory())
				return getUserScriptEntries(fullPath); // recurse

			if (entry.isFile() && entry.name.endsWith(".user.ts"))
				return [fullPath];

			return [];
		})
	);

	return results.flat();
}

async function readMetadataBlock(entryPath) {
	const source = await fs.readFile(entryPath, "utf8");
	const metadataMatch = source.match(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/);

	if (!metadataMatch) {
		throw new Error(`Missing userscript metadata block in ${path.basename(entryPath)}.`);
	}

	return metadataMatch[0];
}

async function buildEntry(entryPath) {
	const metadataBlock = await readMetadataBlock(entryPath);
	const entryName = path.basename(entryPath).replace(/\.ts$/, ".js");
	const outfile = path.join(distDir, entryName);

	await esbuild.build({
		entryPoints: [entryPath],
		outfile,
		bundle: true,
		minify: !isDev,
		format: "iife",
		platform: "browser",
		target: ["es2020"],
		treeShaking: true,
		legalComments: isDev ? "inline" : "none",
		sourcemap: isDev ? "inline" : false,
		keepNames: isDev,
		alias: {
			"~": path.join(projectRoot, "src"),
		},
		banner: {
			js: `${metadataBlock}\n`
		}
	});

	console.log(`Built ${path.relative(projectRoot, outfile)}${isDev ? " [dev]" : ""}`);
}

async function buildAll() {
	await ensureDirectory(distDir);
	const entries = await getUserScriptEntries();

	if (entries.length === 0) {
		throw new Error("No .user.ts files found in src/scripts.");
	}

	await Promise.all(entries.map(buildEntry));
}

async function main() {
	if (!isWatch) {
		await buildAll();
		return;
	}

	console.log(`Watching for changes${isDev ? " (dev mode)" : ""}...`);
	await buildAll();

	const watcher = await fs.watch(scriptsDir, { recursive: true });
	let timer = null;

	for await (const _event of watcher) {
		if (timer) {
			clearTimeout(timer);
		}

		timer = setTimeout(async () => {
			try {
				await buildAll();
			} catch (error) {
				console.error(error);
			}
		}, 100);
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});