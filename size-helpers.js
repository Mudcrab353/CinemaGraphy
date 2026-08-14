/**
 * Size label helpers for stream titles.
 */
export function cleanSize(size) {
    if (size == null || size === '') {
        return null
    }
    const cleaned = String(size)
        .replace(/^(حجم|size|حجم\s*فایل)\s*[:：\-]?\s*/i, '')
        .replace(/\s+/g, ' ')
        .trim()
    return cleaned || null
}

export function detectSize(text) {
    if (!text) {
        return null
    }
    const match = String(text).match(/(\d+(?:[.,]\d+)?\s*(?:GB|MB|گیگ(?:ابایت)?|مگ(?:ابایت)?))\b/i)
    return match ? match[1].replace(/\s+/g, ' ').trim() : null
}
