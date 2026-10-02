/** Geometric mean of true-label probabilities, inverse to cross-entropy.
 * Not accuracy, arithmetic mean confidence, distance, or test performance. */
export function learningScore(crossEntropy:number):number {
  return 100*Math.exp(-Math.max(0,crossEntropy));
}
