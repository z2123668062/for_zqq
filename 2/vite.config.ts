import { defineConfig } from 'vite';

// base: './' 是关键 —— 站点部署在 GitHub Pages 的子路径下
// （https://<user>.github.io/for_zqq/2/），相对路径保证任何位置都能正确加载资源。
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    port: 5173,
  },
});
