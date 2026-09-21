# Practice network simplification — 2026-09-21

## Scope

The practice stage previously showed products, sums, activations, output scores and probability conversion simultaneously. Its default view now contains the input bundle, hidden neurons and class probability bars. Arithmetic and the legacy full wiring view are inside one closed disclosure. Understanding lessons, training, decision surfaces and exports are unchanged.

## Display contract

- Hidden-node color identities match the decision-map neuron colors.
- Node ink encodes activation magnitude on a fixed scale, not prediction correctness. A small +/− distinguishes the sign. For tanh/sigmoid the magnitude is bounded by one; ReLU uses `abs(value)/(1+abs(value))` for display only.
- The lines in the simplified view indicate connectivity, not weight magnitude or positive class support. A selected neuron's route is colored. Other routes stay neutral.
- Bars use the unrounded probabilities from the actual forward pass. No decorative/fabricated probability values. Equal leading probabilities are described as tied.
- Pixel input is explicitly one visual bundle of all pixel values. It is not a single scalar input neuron.
- Input changes can pulse changed neuron responses but never claim that training occurred. Connection flashes require increased training epoch and changed weights. Bias-only changes highlight the relevant node, not unchanged wires. Unchanged renders do not replay the animation. Reduced-motion preference disables animations.
- Detailed arithmetic still includes all input products and all hidden-to-output products. Display rounding never changes inference. Disclosure state and selected nodes survive updates, including hidden-unit removal.
- Basic practice removes duplicate percentage reports and long input-value lists. Training accuracy and epoch count remain visible.

## Verification

- TypeScript and production build.
- Unit coverage for probability-bar equality with inference, negative responses, equal predictions, all 16 hidden nodes and six classes, default-closed arithmetic, disclosure/SVG preservation, input-only changes and actual learning changes.
- Browser: penalty practice route and learning; custom numeric practice including eight hidden neurons; custom drawing collection and training, two-feature and full-196-pixel modes, 16 hidden neurons, class selection and detailed arithmetic.
- Basic panels tested at 1280×720 and 390×844. Numeric eight-node and image sixteen-node panels fit without internal overflow in the checked states. Expanded arithmetic can scroll; it is deliberately not part of the basic screen. Arbitrary browser zoom/long class labels and all possible viewports are not claimed tested.
- Browser console: no errors in the verified local session.

This checks implementation and mathematical consistency, not empirical learning effectiveness with students.
