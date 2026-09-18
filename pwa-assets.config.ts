import { defineConfig } from '@vite-pwa/assets-generator/config';

// The app's paper colour, as src/style.css sets --paper.
const PAPER = '#fffaf0';

// The icons the manifest and index.html name, generated from public/icon.svg
// by `npm run icons` and committed under public/. The source already holds
// the paper background and the safe-zone margin, so nothing here adds
// padding; every icon is opaque, which is what iOS needs for a home screen
// icon.
export default defineConfig({
  preset: {
    transparent: {
      sizes: [192, 512],
      padding: 0,
      favicons: [[48, 'favicon.ico']],
    },
    maskable: {
      sizes: [512],
      padding: 0,
      resizeOptions: { background: PAPER },
    },
    apple: {
      sizes: [180],
      padding: 0,
      resizeOptions: { background: PAPER },
    },
  },
  images: ['public/icon.svg'],
});
