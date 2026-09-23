export function normalizeScanRootPath(path: string): string {
  if (!path.trim() || !path.startsWith('/') || path.split('/').some(part => part === '.' || part === '..')) {
    throw new Error('无法选择这个影片文件夹，请返回上一级重试。')
  }
  return path.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/'
}

export function getScanRootRelation(a: string, b: string): 'same' | 'ancestor' | 'descendant' | 'none' {
  a = normalizeScanRootPath(a)
  b = normalizeScanRootPath(b)
  if (a === b) return 'same'
  if (a === '/' || b.startsWith(`${a}/`)) return 'ancestor'
  if (b === '/' || a.startsWith(`${b}/`)) return 'descendant'
  return 'none'
}

export function findCoveringAncestor(path: string, paths: readonly string[]) {
  return paths.find(item => getScanRootRelation(item, path) === 'ancestor')
}

export function findContainedDescendants(path: string, paths: readonly string[]) {
  return paths.filter(item => getScanRootRelation(path, item) === 'ancestor')
}

export function validateScanRootPaths(paths: readonly string[]): string[] {
  const normalized = paths.map(normalizeScanRootPath)
  for (let i = 0; i < normalized.length; i++) {
    for (let j = 0; j < i; j++) {
      if (getScanRootRelation(normalized[i]!, normalized[j]!) !== 'none') {
        throw new Error('不能重复选择同一个影片文件夹，也不能同时选择它和里面的文件夹。')
      }
    }
  }
  return normalized
}

export function sameScanRootSelection(a: readonly string[], b: readonly string[]): boolean {
  const left = new Set(a.map(normalizeScanRootPath))
  const right = new Set(b.map(normalizeScanRootPath))
  return left.size === right.size && [...left].every(path => right.has(path))
}

/** 仅在 UI 明确确认后调用；返回新草稿，不写入来源状态。 */
export function replaceDescendantsWithParent(paths: readonly string[], parent: string): string[] {
  const candidate = normalizeScanRootPath(parent)
  return validateScanRootPaths([...paths.filter(path => getScanRootRelation(candidate, path) !== 'ancestor'), candidate])
}
