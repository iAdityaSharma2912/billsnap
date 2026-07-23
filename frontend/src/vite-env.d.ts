/// <reference types="vite/client" />

// CSS modules
declare module '*.css' {
  const content: Record<string, string>
  export default content
}

// Plain CSS side-effect imports (import './index.css')
declare module '*.css?inline' {
  const content: string
  export default content
}
