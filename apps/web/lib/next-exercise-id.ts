/**
 * Picks the next exercise id in list order (wraps to index 0 after the last).
 */
export function nextExerciseIdSequential(
  orderedIds: string[],
  currentId: string | undefined
): string {
  if (orderedIds.length === 0) {
    throw new Error('nextExerciseIdSequential: orderedIds must be non-empty');
  }
  const idx = currentId ? orderedIds.indexOf(currentId) : -1;
  const next = idx === -1 ? 0 : (idx + 1) % orderedIds.length;
  return orderedIds[next]!;
}

/**
 * Picks the previous exercise id in list order (wraps from index 0 to the last).
 */
export function previousExerciseIdSequential(
  orderedIds: string[],
  currentId: string | undefined
): string {
  if (orderedIds.length === 0) {
    throw new Error('previousExerciseIdSequential: orderedIds must be non-empty');
  }
  const idx = currentId ? orderedIds.indexOf(currentId) : -1;
  if (idx === -1) {
    return orderedIds[orderedIds.length - 1]!;
  }
  const prev = (idx - 1 + orderedIds.length) % orderedIds.length;
  return orderedIds[prev]!;
}

/**
 * Picks a random id different from current when possible.
 */
export function nextExerciseIdRandom(orderedIds: string[], currentId: string | undefined): string {
  if (orderedIds.length === 0) {
    throw new Error('nextExerciseIdRandom: orderedIds must be non-empty');
  }
  if (orderedIds.length === 1) {
    return orderedIds[0]!;
  }
  const pool =
    currentId !== undefined ? orderedIds.filter((id) => id !== currentId) : [...orderedIds];
  if (pool.length === 0) {
    return orderedIds[0]!;
  }
  return pool[Math.floor(Math.random() * pool.length)]!;
}
