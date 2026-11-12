/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly WXT_GITHUB_URL: string
  readonly WXT_X_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
