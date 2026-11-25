const localFile = /^file:\/\/\/[^?#\s\\]+$/

export function resolveUpdateDocument(localAssets: Readonly<Record<string, string>>): string | undefined {
  const documents = Object.entries(localAssets)
    .filter(([key, uri]) => /^[a-f0-9]{32}$/.test(key) && localFile.test(uri) && uri.endsWith(`/${key}.html`))
  return documents.length === 1 ? documents[0][1] : undefined
}

export function allowsLocalDocument(url: string, updateDocument?: string): boolean {
  // The native URL implementation only exposes pathname for HTTP(S).
  const document = url.split('#', 1)[0]
  if (!localFile.test(document)) return false
  if (updateDocument) return document === updateDocument
  return /\/(?:www\.bundle|\.expo-internal)\/[a-f0-9]+\.html$/.test(document)
}
