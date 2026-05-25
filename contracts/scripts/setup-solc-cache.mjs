#!/usr/bin/env node
/**
 * Pre-populates the Hardhat solc compiler cache from the npm `solc` package,
 * bypassing the need to download from https://binaries.soliditylang.org.
 *
 * Hardhat 3 downloads compiler binaries at test time. In sandboxed or
 * network-restricted environments (CI, air-gapped machines), that download
 * fails with HHE905. This script pre-seeds the cache so Hardhat finds the
 * compiler already present and skips the download.
 *
 * Strategy for native platforms (linux-amd64, etc.):
 *   - Create a dummy binary file + a sibling `.does.not.work` marker.
 *   - Hardhat sees the file as "already downloaded" but marks it unusable,
 *     then automatically falls back to the WASM build.
 * Strategy for WASM:
 *   - Copy soljson.js directly from the `solc` npm package.
 */
import { createRequire } from 'module';
import { mkdirSync, writeFileSync, copyFileSync } from 'fs';
import { join } from 'path';

const require = createRequire(import.meta.url);

// env-paths is a transitive dependency of Hardhat; it gives us the OS-correct
// cache directory (e.g. ~/.cache/hardhat-nodejs on Linux).
const envPaths = require('env-paths');
const compilersDir = join(envPaths('hardhat').cache, 'compilers-v3');

// Load the locally installed solc npm package to read the version string.
const solc = require('solc');
const longVersion = solc.version(); // "0.8.34+commit.80d5c536.Emscripten.clang"
const version = longVersion.split('+')[0]; // "0.8.34"
const commitPart = longVersion.split('+')[1]; // "commit.80d5c536.Emscripten.clang"
const soljsonSrc = require.resolve('solc/soljson.js');

function makeList(filename) {
  return JSON.stringify({
    builds: [{ version, longVersion, path: filename, sha256: '0x' + '0'.repeat(64) }],
    releases: { [version]: filename },
    latestRelease: version,
  });
}

// WASM: place the real soljson.js so Hardhat uses it for compilation.
const wasmFilename = `soljson-v${longVersion}.js`;
const wasmDir = join(compilersDir, 'wasm');
mkdirSync(wasmDir, { recursive: true });
writeFileSync(join(wasmDir, 'list.json'), makeList(wasmFilename));
copyFileSync(soljsonSrc, join(wasmDir, wasmFilename));

// Native platforms: dummy binary + .does.not.work forces Hardhat to fall back
// to the WASM build above without attempting any network download.
for (const platform of ['linux-amd64', 'linux-arm64', 'macosx-amd64']) {
  const nativeFilename = `solc-${platform}-v${version}+${commitPart}`;
  const nativeDir = join(compilersDir, platform);
  mkdirSync(nativeDir, { recursive: true });
  writeFileSync(join(nativeDir, 'list.json'), makeList(nativeFilename));
  writeFileSync(join(nativeDir, nativeFilename), '');
  writeFileSync(join(nativeDir, `${nativeFilename}.does.not.work`), '');
}

console.log(`solc ${version} (${longVersion}) compiler cache populated at ${compilersDir}`);
