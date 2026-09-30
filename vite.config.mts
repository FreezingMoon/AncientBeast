import { defineConfig, loadEnv } from 'vite';
import { createRequire } from 'module';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import phaserAssetManifestPlugin from './assets-manifest.js';
import { ViteEjsPlugin } from 'vite-plugin-ejs';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const require = createRequire(import.meta.url);

export default defineConfig(({ mode, command }) => {
  const isDev = command === 'serve';
  const isProduction = mode === 'production';
  const env = loadEnv(mode, process.cwd(), '');

  const enableServiceWorker = env.ENABLE_SERVICE_WORKER === 'true';
  const isDevvitTarget = env.VITE_DEVVIT_TARGET === 'true';

  const phaserPath = resolve(__dirname, 'node_modules/phaser/dist/phaser.js');

  const entries = {
    app: resolve(__dirname, 'src/script.ts'),
  };

  const htmlPlugins = [
    {
      template: resolve(__dirname, 'src/index.ejs'),
      filename: 'index.html',
      chunks: ['app'],
      inject: 'body',
      minify: isProduction,
    },
  ];

  if (isDevvitTarget) {
    entries.splash = resolve(__dirname, 'src/devvit/splash.ts');
    entries.gameEntry = resolve(__dirname, 'src/devvit/game-entry.ts');

    htmlPlugins.push(
      {
        template: resolve(__dirname, 'src/devvit/splash.ejs'),
        filename: 'splash.html',
        chunks: ['splash'],
        inject: 'body',
        minify: isProduction,
      },
      {
        template: resolve(__dirname, 'src/devvit/game-entry.html'),
        filename: 'game.html',
        chunks: ['gameEntry'],
        inject: 'body',
        minify: isProduction,
      }
    );
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
          entryFileNames: '[name].[contenthash].bundle.js',
          chunkFileNames: '[name].[contenthash].chunk.js',
          assetFileNames: (assetInfo) => {
            if (isProduction && assetInfo.name) {
              const ext = assetInfo.name.split('.').pop();
              return `assets/[contenthash].${ext}`;
            }
            return '[path][name].[ext]';
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
        '@': resolve(__dirname, 'src'),
        assets: resolve(__dirname, 'assets'),
        modules: resolve(__dirname, 'node_modules'),
        underscore: resolve(__dirname, 'node_modules/underscore/underscore-umd.js'),
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
        assetDirs: [
          'assets/autoload/drops',
          'assets/autoload/interface',
          'assets/autoload/units',
          'assets/units/avatars',
          'assets/locations',
          'assets/units/artwork',
        ],
        soundDirs: [
          'assets/sounds',
          'assets/units/sfx',
          'assets/units/shouts',
          'assets/music/epic',
          'assets/music/rock',
        ],
        output: 'assets/index.js',
      }),
      ViteEjsPlugin({
        preMatchHtml: readFileSync(resolve(__dirname, 'src/templates/pre-match.html'), 'utf-8'),
        production: isProduction,
        enableServiceWorker,
        devvitTarget: isDevvitTarget,
      }),
      viteStaticCopy({
        targets: [
          {
            src: 'static',
            dest: '',
          },
        ],
      }),
      {
        name: 'dotenv-config',
        configResolved(config) {
          require('dotenv-defaults').config({
            default: resolve(__dirname, '.env.example'),
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