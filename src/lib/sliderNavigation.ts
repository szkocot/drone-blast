function clamp(value: number, max: number): number {
  return Math.max(0, Math.min(max, value));
}

export function nextOffsetFromKey(
  key: string,
  current: number,
  max: number
): number | null {
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowDown':
      return clamp(current - 1, max);
    case 'ArrowRight':
    case 'ArrowUp':
      return clamp(current + 1, max);
    case 'PageUp':
      return clamp(current + 6, max);
    case 'PageDown':
      return clamp(current - 6, max);
    case 'Home':
      return 0;
    case 'End':
      return max;
    default:
      return null;
  }
}
