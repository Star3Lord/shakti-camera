// import adapter from '@sveltejs/adapter-auto';
// import adapter from '@sveltejs/adapter-cloudflare';
import adapter from '@sveltejs/adapter-vercel';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  compilerOptions: {
    experimental: {
      async: true,
    },
    // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
    runes: ({ filename }) =>
      filename.split(/[/\\]/).includes('node_modules') ? undefined : true,
  },
  kit: {
    adapter: adapter({
      runtime: 'nodejs22.x',
    }),
    experimental: {
      remoteFunctions: true,
    },
  },
  vitePlugin: {
    inspector: {
      toggleKeyCombo: 'alt-x',
      showToggleButton: 'active',
      toggleButtonPos: 'bottom-right',
    },
  },
};

export default config;
