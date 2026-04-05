export function putWithProgress(
  url: string,
  body: Blob,
  contentType: string | undefined,
  onProgress: (pct: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable) return
      onProgress(Math.round((evt.loaded / evt.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`))
    }
    xhr.onerror = () => reject(new Error('Network error during upload'))
    if (contentType) xhr.setRequestHeader('Content-Type', contentType)
    xhr.setRequestHeader('x-ms-blob-type', 'BlockBlob')
    xhr.send(body)
  })
}
