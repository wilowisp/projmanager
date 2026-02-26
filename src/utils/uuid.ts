export function generateId(): string {
  return (
    Math.random().toString(36).slice(2, 7) +
    Math.random().toString(36).slice(2, 7)
  )
}
