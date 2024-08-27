import { defineConfig } from "vite";
import { resolve, extname, dirname, basename, join, relative } from "path";
import fs from "fs";
import autoprefixer from "autoprefixer";
import * as dotenv from "dotenv";
// import glsl from "vite-plugin-glsl";

const result = dotenv.config();
if (result.error) throw result.error;

const DIR = {
  DIST: "dist",
  SRC: "src",
  PUBLIC: "public",
};

const HASH = `${new Date().getFullYear()}${
  new Date().getMonth() + 1
}${new Date().getDate()}`;

// 再帰的にディレクトリを探索して、全ての .html ファイルを取得する関数
const getAllHtmlFiles = (dir) => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = resolve(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      // サブディレクトリを再帰的に探索
      results = results.concat(getAllHtmlFiles(filePath));
    } else if (extname(file) === ".html") {
      // .htmlファイルを追加
      results.push(filePath);
    }
  });
  return results;
};

// srcディレクトリ配下の全ての.htmlファイルを取得
const htmlFiles = getAllHtmlFiles(resolve(__dirname, DIR.SRC));

// ファイル名から入力オブジェクトを作成
const input = {};
htmlFiles.forEach((file) => {
  // `src` ディレクトリを基準にした相対パスを取得
  const relativePath = file.replace(resolve(__dirname, DIR.SRC) + "/", "");

  // 拡張子を除去
  let name = relativePath.replace(/\.html$/, "");

  // ディレクトリ階層を含めた名前にする
  const dirName = basename(dirname(name));

  if (basename(name) === "index") {
    name = dirName ? `${dirName}` : "index";
  } else {
    name = `${dirName ? dirName + "-" : ""}${basename(name)}`;
  }

  // 空白の場合は「index」を使用
  if (name === "." || name.includes(".") || name === "") name = "index";

  input[name] = file;
});

export default defineConfig(({ mode }) => {
  // const IS_DEV = mode === "development";
  return {
    base: "./",
    root: DIR.SRC,
    publicDir: resolve(__dirname, DIR.PUBLIC),
    resolve: {
      alias: {
        "@scss": resolve(__dirname, "src/assets/scss"), // 'src/assets/scss'ディレクトリへのエイリアスを作成
      },
    },
    css: {
      devSourcemap: true,
      postcss: {
        plugins: [autoprefixer({ grid: true })],
      },
      preprocessorOptions: {
        scss: {
          additionalData: `@import "@scss/common.scss";`, // 共通のスタイルを自動的にインポート
        },
      },
    },
    esbuild: {
      drop: ["console", "debugger"],
    },
    build: {
      outDir: resolve(__dirname, DIR.DIST),
      emptyOutDir: true,
      polyfillModulePreload: false,
      chunkSizeWarningLimit: 100000000, // 500kb
      rollupOptions: {
        input: input, // 動的に取得した.htmlファイルをエントリーポイントとして設定
        output: {
          entryFileNames: (chunkInfo) => {
            const relativePath = relative(
              join(process.cwd()),
              chunkInfo.facadeModuleId
            ); // basepath, fullpath
            let filename = relativePath
              .replace("src/", "")
              .replace("index.html", "")
              .replace(/\//g, "-")
              .replace(/-$/, "");
            if (filename === "") filename = "index";
            filename = filename || chunkInfo.name || "index";
            return `assets/js/${filename}.${HASH}.js`;
          },
          chunkFileNames: (chunkInfo) => {
            const name = chunkInfo.name || "index";
            return `assets/js/_chunk/${name}.${HASH}.js`;
          },
          assetFileNames: (assetInfo) => {
            let filename = assetInfo.originalFileName;
            if (filename != null) {
              filename = assetInfo.originalFileName;
              filename = filename
                .replace("index.html", "")
                .replace(/\//g, "-")
                .replace(/-$/, "");
              if (filename === "") filename = "index";
            }
            return filename != null
              ? `assets/[ext]/${filename}.${HASH}[extname]`
              : `assets/[ext]/[name].${HASH}[extname]`;
          },
          manualChunks: undefined, // コード分割を無効化
        },
      },
    },
    // plugins: [glsl()],
    server: {
      open: true,
      port: process.env.PORT,
      host: true,
    },
  };
});
