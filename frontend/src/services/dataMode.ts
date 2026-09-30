// Explicit development-only preview. Production uses authenticated HTTP paths.
// 只有开发环境并且 VITE_MOCK_PREVIEW 明确设为字符串 'true' 才开启演示；路由用它选择预览页面。
export const mockPreview = import.meta.env.DEV && import.meta.env.VITE_MOCK_PREVIEW === 'true'
