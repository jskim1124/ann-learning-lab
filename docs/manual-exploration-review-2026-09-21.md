# Manual exploration in practice — 2026-09-21

## Student activity

Practice now offers **내가 모델이 되어 보기** without replacing automatic training. The student can explore three independent workspaces:

1. Move a hidden neuron's line while keeping six labeled points fixed. Observe predictions, correct-count change and a best-so-far count; undo a complete drag in one step.
2. Add and connect a second hidden neuron. Compare the same model with that neuron's output connections temporarily disabled. Calculate the two contributions and inspect the resulting bent decision boundary.
3. Repeat the experiment using the current problem's actual two selected features, class names and examples. For images these are projected feature coordinates, not the full 196-pixel model.

Controls are separated into line editing, output connections and a small calculation. A prediction question asks whether adding 0.25 to the selected hidden bias increases, decreases or leaves unchanged the selected class score at the current point. Incorrect answers do not modify the model or reveal the correct choice. Free editing remains available; quizzes do not gate exploration.

## Mathematical contract

- A real two-input ReLU network drives the entire experiment. Hidden values are `max(0, wx*x + wy*y + b)`; class scores are weighted sums of hidden values plus output biases. Probability bars come from the existing softmax forward pass.
- Colored lines indicate hidden preactivation zero, not neurons themselves or guaranteed final class boundaries. The black contour is where leading class scores exchange rank.
- Class A (or the first class) has reference score zero. Other output weights and biases can be positive, negative or zero. Output scores are **not** clamped at zero. Subtracting the same reference score from all logits preserves probabilities and decisions; this fixed reference is a teaching simplification, not a claim that every classifier has a zero first output.
- A newly added neuron has zero outgoing weights. It does not change predictions until the student connects it. Removing or temporarily disconnecting neurons uses the same forward pass.
- The two-neuron example can yield `B = max(0,x) + max(0,y) - 0.5`, `A = 0`. The final boundary has vertical, diagonal and horizontal pieces. Tests check exact ties at `(0.5,-0.5)`, `(0.25,0.25)` and `(-0.5,0.5)`, and the six labeled examples.
- Bias-increase questions are computed for the actual point and outgoing weight, including zero activation, negative connections and unchanged scores. They are not labeled as a universal training direction.
- Equal top scores remain unresolved: no automatic credit for class index zero. Tied backgrounds are neutral. Probe coordinates without a labeled example have no invented ground truth.
- Correct count measures this workspace's examples, not unseen-data accuracy or a global optimum. Completion invites further testing. Manual editing is distinguished from automatic gradient-based training in the experiment notes.
- Display rounding does not alter forward inference. Sliders and canvas moves deliberately use small discrete steps for accessible arithmetic.

## State and regression safety

The experiment clones data and owns separate models and undo histories. Opening it stops ongoing automatic training but does not reset or overwrite learned weights, collected data, selected features or exports. Closing and reopening preserves experiments unless the source examples, classes or features changed. An empty source starts at a calculation-only coordinate rather than inventing a labeled point.

Native slider elements remain mounted during live updates so dragging and keyboard focus are not interrupted. Pointer gestures are grouped into one undo entry. Small-screen controls and the graph are stacked; desktop retains the simplified network alongside the graph. Reduced-motion preference disables arithmetic entrance animations.

## Verification

- Unit tests cover forward calculations, three-piece boundary ties, real score changes, disconnected-neuron invariance, disabling/re-enabling a neuron, reversible gestures, empty data, class/data isolation and neuron limits.
- DOM tests cover continuous slider updates, focus, wrong/correct quizzes, forecast-before-edit, output calculation, class colors, session persistence and neuron controls. A filtered network output retains the probability normalized across **all** classes.
- Browser checks at 1280×720 and 390×844: line dragging changed the first task from 3/6 to 6/6; one undo restored it. Adding the second neuron preserved 4/6; connecting it produced 6/6 and a visibly bent boundary. Output calculation at `(0.5,0.5)` produced `0.5`. Checked wrong-answer feedback, predicted score change, actual custom-data class/feature reuse, and return to an unchanged 10-epoch automatic model.
- Checked basic two-neuron controls and quiz feedback fit without internal overflow at those sizes. Expanded notes, extra neurons, long custom labels and smaller viewports can require control-panel scrolling. No claim of universal zero-scroll layout.
- Browser console had no errors in the tested local session. Type check, complete unit suite and production build are release gates.

This validates implementation and mathematical consistency, not classroom learning effectiveness. Student usability testing remains necessary.
