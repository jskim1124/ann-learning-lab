# Understanding: integrated exploration and stable plots

## Learning flow

- Image activities (digits, OMR and collected webcam images) retain feature calculation and distribution selection. Understanding sections 3 and 4 now open the shared hands-on workspace directly, inside the existing lesson rather than in a separate practice dialog.
- Penalty understanding uses the same workspace in the neuron-addition and line-movement sections. These are explicitly **small A/B examples**, not a claim to simulate football or classify the original images. The problem-specific explanations remain available under “원리 설명”.
- “원리 설명 / 직접 고치기” are two views of the same understanding contents. The four-item contents remains visible. Returning to an earlier section preserves the student's experimental model. Resetting the activity clears its checks and experimental state.
- Line exploration requires a successful six-example classification, a small calculation and a correct direction prediction. Two-neuron exploration requires successful classification, a comparison with an actually connected neuron disabled, and a two-neuron output calculation. Adding a neuron or clicking Next alone cannot complete these checks.
- The existing explanation-and-quiz route remains available. Entering practice through either route still requires the preceding understanding checks. The user's original training data/model and exports remain separate from the examples.

## Meaning and consistency

The UI distinguishes labeled data points, a hidden neuron's zero-sum line, and the final prediction boundary. It calls a hidden neuron a calculator producing one number, and an output a calculator assigning a score to each answer. Output controls explain zero, positive and negative connection multipliers at the selected value. Network bars are labeled as prediction proportions, not raw output scores. Calculations, decisions and contours use the same actual forward pass as the manual workspace.

The examples are simplified ReLU networks, not a claim that all neural networks behave identically or that a colored line is literally a neuron. The probability ranking and output weights have not been replaced with decorative motion.

## Plot-size repair

The canvases were flex items whose intrinsic dimensions changed when the renderer resized their backing stores. The manual plot also shared flexible space with varying captions. These sources of layout feedback are removed:

- A size-contained wrapper owns layout; the drawing canvas is absolutely positioned inside it with explicit CSS width/height.
- Manual plot tools, point/score rows and legend have reserved grid tracks. Point selection and changing feedback in the other panel do not resize the plot.
- Image and penalty explanation canvases use stable wrappers and viewport-based display heights. Dynamic canvas resolution no longer determines display height.
- Existing hit testing continues using the same measured CSS geometry and margins as rendering.

## Verification

- New tests cover embedded non-modal rendering, unique scoped IDs, navigation/state preservation, calculation/prediction/comparison gates, all three image tasks, unchanged original state, and idempotent canvas wrapping.
- Legacy explanation, animation, 13-hit line tracing, quizzes and practice-navigation regression tests remain in the full suite.
- Browser at 1280×720: the embedded plot stayed **707.96875 × 286.39203 CSS px** across four point selections and two bias adjustments. Successful classification changed from 3/6 to 6/6 without changing plot size.
- The original line-tracing plot stayed **611.25 × 266.39203 CSS px**, with identical top/left position after four separate strokes. Hit count correctly increased to 4/13.
- Verified understanding calculation and prediction enable the transition into two-neuron exploration; earlier feature checks still block entering practice prematurely. Verified the penalty activity opens the same embedded UI.
- Checked the basic line-editing layout at 390×844: graph, basic controls and progression remain on screen; control panel measured 300px client/scroll height. Additional controls/expanded feedback on smaller displays can use panel scrolling. No claim of zero scrolling at every viewport or for arbitrary custom labels.
- No browser console errors in the tested session. Type checking, complete test suite and production build are release gates.

Repeated legacy lesson renders now reuse persistent element references and skip unchanged explorer chrome. This removes unnecessary work while a learner draws, without weakening test timeouts or removing assertions.
