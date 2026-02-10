export type ImageInfo = {
  url: string
  width: number
  height: number
  name: string
}

export async function fileToImageInfo(file: File): Promise<ImageInfo> {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    return { url, width: img.naturalWidth, height: img.naturalHeight, name: file.name }
  } catch (err) {
    URL.revokeObjectURL(url)
    throw err
  }
}

export function revokeImageInfo(info: ImageInfo | null) {
  if (!info) return
  // 只回收由 URL.createObjectURL 创建的 blob URL（data URL 不需要/也不能 revoke）
  if (info.url.startsWith('blob:')) {
    URL.revokeObjectURL(info.url)
  }
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = url
  })
}

export async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: 'image/png' | 'image/jpeg' | 'image/webp',
  quality: number,
): Promise<Blob> {
  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('导出失败（浏览器返回空 Blob）'))
        else resolve(blob)
      },
      type,
      quality,
    )
  })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

