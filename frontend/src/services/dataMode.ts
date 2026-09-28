// Explicit development-only preview. Production uses authenticated HTTP paths.
export const mockPreview = import.meta.env.DEV && import.meta.env.VITE_MOCK_PREVIEW === 'true'
