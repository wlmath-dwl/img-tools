import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { fileToImageInfo, revokeImageInfo, type ImageInfo } from './image'

export type ImageItem = {
  id: string
  file: File
  info: ImageInfo
}

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/**
 * 通用多图选择状态：
 * - 上传/追加多张图片
 * - 维护当前 active
 * - 统一回收 blob URL（避免内存泄漏）
 */
export function useImageItems() {
  const [items, setItems] = useState<ImageItem[]>([])
  const [activeId, setActiveId] = useState('')

  const itemsRef = useRef<ImageItem[]>([])
  itemsRef.current = items

  // 页面卸载时回收所有 blob URL
  useEffect(() => {
    return () => {
      for (const it of itemsRef.current) revokeImageInfo(it.info)
    }
  }, [])

  const active = useMemo(() => {
    return items.find((x) => x.id === activeId) ?? items[0] ?? null
  }, [items, activeId])

  async function addFiles(files: File[]) {
    const nextInfos = await Promise.all(files.map(async (file) => {
      const info = await fileToImageInfo(file)
      return { id: makeId(), file, info } satisfies ImageItem
    }))
    setItems((prev) => [...prev, ...nextInfos])
    // 用函数式更新避免与 clearAll/removeOne 的异步状态更新产生竞态
    if (nextInfos.length > 0) setActiveId((prev) => prev || nextInfos[0].id)
  }

  function removeOne(id: string) {
    const nextIds = items.filter((x) => x.id !== id).map((x) => x.id)
    if (activeId === id) setActiveId(nextIds[0] ?? '')
    setItems((prev) => {
      const target = prev.find((x) => x.id === id)
      if (target) revokeImageInfo(target.info)
      return prev.filter((x) => x.id !== id)
    })
  }

  function clearAll() {
    setItems((prev) => {
      for (const it of prev) revokeImageInfo(it.info)
      return []
    })
    setActiveId('')
  }

  return {
    items,
    activeId,
    setActiveId,
    active,
    addFiles,
    removeOne,
    clearAll,
  }
}

