import { defineConfig, loadEnv } from 'vite';
import { createRequire } from 'module';
import { relative, resolve } from 'path';
import { readFileSync } from 'fs';
import phaserAssetManifestPlugin from './assets-manifest.mts';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const require = createRequire(import.meta.url);

// `configLoader: 'native'` (the upcoming Vite default) runs this file as real
// ESM, where `__dirname` does not exist.
const rootDir = import.meta.dirname;

/**
 * Renders `src/index.ejs` into a real HTML entry.
 *
 * The webpack build used `html-webpack-plugin`, which gave the template a
 * `require()` and a `htmlWebpackPlugin.options` global. Vite has no equivalent
 * and no `.html` input existed, so `vite build` emitted bundles but never an
 * `index.html` (and `vite dev` had no document to serve at `/`).
 *
 * This plugin supplies those two globals to the EJS render and wires the
 * resulting markup to the app entry chunk, in both `serve` and `build`.
 *
 * `require()` inside the template resolves as follows:
 * - `./templates/*.html` -> `{ default: <file contents> }`
 * - `./**` (TS modules) -> bundled with esbuild and evaluated in Node
 * - `assets/**`         -> the repo-relative URL, returned as a string
 */
function ejsHtmlPlugin({ devvitTarget, enableServiceWorker }) {
  const srcDir = resolve(rootDir, 'src');
  const templatePath = resolve(srcDir, 'index.ejs');

  /** Resolves the request forms used by index.ejs to an absolute file path. */
  function toAbsolutePath(request) {
    if (request.startsWith('.')) return resolve(srcDir, request);
    if (request.startsWith('assets/')) return resolve(rootDir, request);
    return null;
  }

  /**
   * `DEBUG_*` values for the Node-side render, taken from `.env` and falling
   * back to `.env.example` (which is what `dotenv-defaults` is meant to supply
   * to the app bundle).
   */
  function debugEnv() {
    const values = {};
    for (const file of ['.env', '.env.example']) {
      let contents;
      try {
        contents = readFileSync(resolve(rootDir, file), 'utf-8');
      } catch {
        continue;
      }
      for (const line of contents.split('\n')) {
        const match = /^\s*(DEBUG_[A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
        if (!match) continue;
        const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
        if (!(match[1] in values)) values[match[1]] = value;
      }
    }
    return values;
  }

  /** Bundles a TS module and evaluates it in Node so the template can require it. */
  async function loadTypeScriptModule(absolutePath) {
    const esbuild = await import('esbuild');
    // `src/debug.ts` reads `process.env.DEBUG_*`; feeding it the same values
    // keeps the rendered version string in sync with the app bundle.
    const result = await esbuild.build({
      entryPoints: [absolutePath],
      bundle: true,
      write: false,
      platform: 'node',
      format: 'cjs',
      target: 'node18',
      logLevel: 'silent',
      define: { 'process.env': JSON.stringify(debugEnv()) },
    });
    const moduleExports = { exports: {} };
    const evaluate = new Function('module', 'exports', 'require', result.outputFiles[0].text);
    evaluate(moduleExports, moduleExports.exports, createRequire(absolutePath));
    return moduleExports.exports;
  }

  /**
   * @param {(absolutePath: string) => string} resolveAssetUrl
   *        Maps an asset path to the URL the document should reference.
   */
  async function render(resolveAssetUrl) {
    const ejs = (await import('ejs')).default;
    // The template was written for `html-webpack-plugin`, whose `<%= %>` does
    // not escape. EJS escapes with `<%= %>` and only skips escaping with
    // `<%- %>`, so every interpolation is rewritten to the raw form —
    // otherwise the inlined UI templates end up in the document as text.
    const template = readFileSync(templatePath, 'utf-8').replaceAll('<%=', '<%-');

    // Collect every `require('...')` in the template so the TypeScript ones can
    // be loaded (asynchronously) before the synchronous EJS render runs.
    const requests = Array.from(new Set(Array.from(template.matchAll(/require\('([^']+)'\)/g), (m) => m[1])));
    const moduleCache = new Map();
    for (const request of requests) {
      const absolutePath = toAbsolutePath(request);
      if (!absolutePath || absolutePath.endsWith('.html')) continue;
      if (!/\.(ts|js)$/.test(absolutePath) && !absolutePath.endsWith('version')) continue;
      moduleCache.set(request, await loadTypeScriptModule(absolutePath));
    }

    const templateRequire = (request) => {
      if (moduleCache.has(request)) return moduleCache.get(request);

      const absolutePath = toAbsolutePath(request);
      if (!absolutePath) return require(request);
      if (absolutePath.endsWith('.html')) return { default: readFileSync(absolutePath, 'utf-8') };
      return resolveAssetUrl(absolutePath);
    };

    return ejs.render(template, {
      require: templateRequire,
      htmlWebpackPlugin: { options: { devvitTarget, enableServiceWorker } },
    });
  }

  /** Dev: serve the rendered document for `/` and `/index.html`. */
  function devServer() {
    return {
      name: 'ab-ejs-html:serve',
      apply: 'serve',
      async configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const path = (req.url || '').split('?')[0];
          if (path !== '/' && path !== '/index.html') return next();

          try {
            const html = await render((absolutePath) => `/${relative(rootDir, absolutePath)}`);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/html');
            res.end(
              html
                .replace('</head>', '  <script type="module" src="/@vite/client"></script>\n</head>')
                .replace('</body>', '    <script type="module" src="/src/script.ts"></script>\n  </body>'),
            );
          } catch (error) {
            next(error);
          }
        });
      },
    };
  }

  /** Build: emit `index.html` referencing the hashed app entry chunk and CSS. */
  function build() {
    return {
      name: 'ab-ejs-html:build',
      apply: 'build',
      async generateBundle(_outputOptions, bundle) {
        const outputs = Object.values(bundle);
        const entry = outputs.find((chunk) => chunk.type === 'chunk' && chunk.isEntry && chunk.name === 'app');
        if (!entry) throw new Error('ab-ejs-html: app entry chunk not found');

        // Vite injects these `<link>` tags itself, but only for HTML it owns.
        // `rollupOptions.input` lists entry chunks only, so this plugin has to
        // emit the references: without them the extracted stylesheets ship
        // unreferenced and the document renders unstyled.
        const styles = outputs
          .filter((output) => output.type === 'asset' && output.fileName.endsWith('.css'))
          .map((output) => output.fileName)
          .sort();

        // `assets/` is copied verbatim into the output, so asset URLs stay
        // repo-relative in both `serve` and `build`.
        const html = await render((absolutePath) => relative(rootDir, absolutePath).replace(/\\/g, '/'));

        // The template already indents `</head>` by one tab, so each link only
        // adds the second one and `</head>` keeps the tab it already had.
        const stylesMarkup = styles.map((fileName) => `\t<link rel="stylesheet" href="./${fileName}">\n`).join('');

        this.emitFile({
          type: 'asset',
          fileName: 'index.html',
          source: html
            .replace('</head>', `${stylesMarkup}\t</head>`)
            .replace('</body>', `    <script type="module" src="./${entry.fileName}"></script>\n  </body>`),
        });
      },
    };
  }

  return [devServer(), build()];
}

export default defineConfig(({ mode, command }) => {
  const isDev = command === 'serve';
  const isProduction = mode === 'production';
  const env = loadEnv(mode, process.cwd(), '');

  const enableServiceWorker = env.ENABLE_SERVICE_WORKER === 'true';
  const isDevvitTarget = env.VITE_DEVVIT_TARGET === 'true';

  const phaserPath = resolve(rootDir, 'node_modules/phaser/dist/phaser.js');

  const entries = {
    app: resolve(rootDir, 'src/script.ts'),
  };

  if (isDevvitTarget) {
    entries.splash = resolve(rootDir, 'src/devvit/splash.ts');
    entries.gameEntry = resolve(rootDir, 'src/devvit/game-entry.ts');
  }

  return {
    root: '.',
    base: isProduction ? './' : '/',
    publicDir: 'static',
    build: {
      outDir: isDevvitTarget ? 'dist/client' : 'deploy',
      emptyOutDir: true,
      sourcemap: isProduction ? 'hidden' : 'inline',
      minify: isProduction ? 'terser' : false,
      terserOptions: isProduction ? {
        compress: {
          drop_console: false,
          drop_debugger: true,
        },
      } : undefined,
      rollupOptions: {
        input: entries,
        output: {
          // Rolldown (Vite 8) only understands the `[hash]` placeholder; the
          // rollup-style `[contenthash]` is emitted verbatim into filenames.
          entryFileNames: '[name].[hash].bundle.js',
          chunkFileNames: '[name].[hash].chunk.js',
          assetFileNames: (assetInfo) => {
            if (isProduction && assetInfo.name) {
              const ext = assetInfo.name.split('.').pop();
              return `assets/[hash].${ext}`;
            }
            // Rolldown only understands `[hash]`; the rollup-style `[path]` and
            // `[name]` placeholders are not substituted and end up literally in
            // the emitted filename (e.g. `[path]app.css`), which is what a
            // non-production `vite build` used to produce.
            const ext = assetInfo.name?.split('.').pop();
            return ext ? `[name].[hash].${ext}` : '[name].[hash]';
          },
          manualChunks: undefined,
        },
      },
      target: 'es2020',
      cssCodeSplit: true,
      modulePreload: {
        polyfill: false,
      },
    },
    server: {
      hmr: false,
      port: 8080,
      open: true,
      host: true,
      proxy: {
        '/api': {
          target: 'http://159.65.232.104:7350',
          changeOrigin: true,
        },
      },
      fs: {
        allow: ['..'],
      },
    },
    preview: {
      port: 8080,
    },
    resolve: {
      alias: {
        phaser: phaserPath,
        '@': resolve(rootDir, 'src'),
        assets: resolve(rootDir, 'assets'),
        modules: resolve(rootDir, 'node_modules'),
        underscore: resolve(rootDir, 'node_modules/underscore/underscore-umd.js'),
      },
      extensions: ['.ts', '.js', '.json'],
      conditions: ['browser', 'import', 'require', 'default'],
    },
    define: {
      'process.env': {},
      'process.env.NODE_ENV': JSON.stringify(mode),
      'process.env.ENABLE_SERVICE_WORKER': JSON.stringify(enableServiceWorker),
      'process.env.VITE_DEVVIT_TARGET': JSON.stringify(isDevvitTarget),
      'global': 'globalThis',
    },
    optimizeDeps: {
      include: ['phaser', 'jquery', 'jquery.transit', 'underscore', 'peerjs', 'js-cookie'],
      exclude: ['@devvit/web', 'devvit', 'hono'],
    },
    esbuild: {
      target: 'es2020',
      treeShaking: true,
      legalComments: 'none',
    },
    css: {
      preprocessorOptions: {
        less: {
          javascriptEnabled: true,
        },
      },
    },
    plugins: [
      phaserAssetManifestPlugin({
        soundDirs: [
          'assets/sounds',
          'assets/units/sfx',
          'assets/units/shouts',
          'assets/music/epic',
          'assets/music/rock',
        ],
        output: 'assets/index.js',
      }),
      ejsHtmlPlugin({ devvitTarget: isDevvitTarget, enableServiceWorker }),
      // Build only. The plugin's dev middleware serves the copied trees with
      // their raw MIME type, so it swallows `?import` requests for files under
      // `assets/` and the browser rejects them as module scripts. In serve mode
      // Vite already exposes `static/` through `publicDir` and serves `assets/`
      // from the project root, and only the build needs the tree copied into
      // the output directory.
      ...(isDev
        ? []
        : [
            viteStaticCopy({
              targets: [
                {
                  // Runtime asset URLs (music, cards, avatars, ability icons)
                  // are repo-relative paths produced by `assets/index.js`, so the
                  // tree has to be published under the same paths. (`static` is
                  // already handled by `publicDir`.)
                  src: 'assets',
                  dest: '.',
                },
              ],
            }),
          ]),
      {
        name: 'dotenv-config',
        configResolved(config) {
          require('dotenv-defaults').config({
            default: resolve(rootDir, '.env.example'),
            silent: true,
          });
        },
      },
    ],
    worker: {
      format: 'es',
    },
  };
});