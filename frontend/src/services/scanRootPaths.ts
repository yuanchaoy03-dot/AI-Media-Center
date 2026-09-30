// 统一路径格式：合并重复斜杠、去掉末尾斜杠，根目录仍保留 /；拒绝 . 和 .. 这类相对跳转。
export function normalizeScanRootPath(path: string): string {
  if (!path.trim() || !path.startsWith('/') || path.split('/').some(part => part === '.' || part === '..')) {
    throw new Error('无法选择这个影片文件夹，请返回上一级重试。')
  }
  return path.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/'
}

// 以 a 为参照判断关系。比较时加上 /，这样 /Movies 不会误算成 /Movies2 的上级。
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

// 选上级目录已经包含里面的内容，因此逐对检查，禁止重复选择或同时选择父子目录。
// readonly string[] 表示函数只能读取传入的数组；这里通过 map 创建新数组来处理。
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

// Set 用来比较选了哪些路径，不把勾选顺序的变化当成选择变化。
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
