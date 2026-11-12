import { defineConfig } from 'wxt'

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: 'Upwork toolkit - your own freelance assistant',
    description: 'Save time and earn more with Upwork toolkit.',
    action: {
      default_icon: 'icon/32.png',
    },
    permissions: [
      'idle',
      'alarms',
      'storage',
      'cookies',
      'offscreen',
      'notifications',
      'declarativeNetRequest',
    ],
    host_permissions: [
      'https://*.upwork.com/',
      'https://api.openai.com/',
      'https://generativelanguage.googleapis.com/',
      'https://api.telegram.org/',
      'https://ntfy.sh/',
    ],
    // Generic webhook + custom ntfy servers use arbitrary hosts, requested at
    // runtime via browser.permissions.request when the user saves them.
    optional_host_permissions: ['*://*/*'],
    declarative_net_request: {
      rule_resources: [
        {
          id: 'ruleset_1',
          enabled: true,
          path: 'request_modifier.json',
        },
      ],
    },
  },
  imports: false,
  modules: ['@wxt-dev/module-react'],
  outDir: 'build',
  webExt: {
    disabled: true,
  },
  vite: () => ({
    build: {
      chunkSizeWarningLimit: 10000,
      sourcemap: true,
    },
  }),
  zip: {
    exclude: ['**/*.js.map'],
  },
})
