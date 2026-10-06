/** Shared grader helpers. */

/**
 * Indices whose value is the extreme (max or min), ties included. Used for the
 * Button Buck award, Horseshoe / Hard-luck hunter, and the coulda-shoulda
 * callout, so the tie rule lives in one place.
 */
export function extremesIndices(
  values: readonly number[],
  pick: (...n: number[]) => number,
): number[] {
  if (values.length === 0) return [];
  const target = pick(...values);
  const out: number[] = [];
  values.forEach((v, i) => {
    if (v === target) out.push(i);
  });
  return out;
}
