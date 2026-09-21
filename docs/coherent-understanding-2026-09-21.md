# Coherent understanding journey

This replaces the mounted explain/explore toggle and the different penalty curriculum. The entry points in `main.ts` and `imageWorkspace.ts` now use **one UnderstandingJourney**. Digits, OMR, webcam and penalty share its lessons, computations, checks and navigation. Custom projects still skip understanding, as previously requested.

## One example, four connected activities

1. A fixed 2×2 image: select two cells, add their darkness and divide by two. Calculate both top and bottom row averages before continuing. Animation selects the same cells; it does not answer the quiz.
2. Follow that same image among seven labelled examples. Total-average features collapse five images (including both classes) into the same coordinate. Top/bottom averages separate their positions. Each selected image shows the actual sum/divisor/coordinate. This is evidence for this dataset, not a promise of generalisation.
3. Keep the dataset and coordinates. A ReLU neuron calculates top − bottom + bias. Predict, then move only bias from −0.50 to 0.00; the selected point, neuron value, prediction, coloured reference line and final boundary share one forward pass. Compute at the currently selected coordinate.
4. Add the opposite-direction neuron with zero output weight: predictions do not change. Connect it, compare with it disabled and enabled, then add the two current neuron outputs and check that output count is determined by classes, not hidden units. An alternative direction lets learners see that boundary shape depends on the actual calculations; adding neurons does not always bend a boundary.

Each activity finishes with a short checked summary. Future lessons are gated by the preceding checks. Revisiting earlier activities preserves the experiment; changing an upstream feature or unfinished bias prevents bypassing the corresponding check. The two former independent lesson views are not mounted.

## Numerical and conceptual contract

- Seven labels are fixed, not derived from model predictions. Ties are explicitly unresolved.
- A score 0.25 is a chosen reference in this teaching example, explicitly labelled as such. B is the sum of connected ReLU outputs. These are **scores**, not percentages.
- The purple/pink lines are where individual pre-activation sums equal zero. The black boundary is where the top output scores tie. Neither is decorated independently of the model.
- Manual edits demonstrate a dependency, not gradient descent and not a claim that a bias should always increase. Actual practice training remains unchanged.
- The tiny common images are teaching examples, not compressed versions of collected images or claims about penalty outcomes. Context text explicitly bridges to each activity's real inputs. Full-pixel webcam training is retained.
- Display values use two decimals. Full-precision model values are not rounded for training, inference, class decisions or export. Counts and labels remain integers.

## Practice simplification

The default network uses response intensity, actual probability bars and update highlights. Clicking a node reveals only its response and one outgoing multiplier on the network. The verbose calculation table and second visible wiring diagram have been removed. Legacy SVG targets are kept hidden for existing rendering compatibility, not offered as another learner view. Metrics, neuron-count control and selected-input context now live beside the graph, on the left. Custom image feature creation remains available in the actual practice workspace.

## Verification

New mathematical tests prove feature/coordinate identity, tie behaviour, no effect from disconnected neurons, the 5/7 to 7/7 improvement after connection, fixed class count and alternative-direction accuracy. New interaction tests traverse all four stages, check wrong-answer gating, preserve slider DOM during updates, revisit earlier stages, preserve state, reset, and use the same contents in all four task contexts. Production entry-point tests verify digits, OMR, webcam and penalty mount the common journey. Existing training and export tests remain in the suite.

Desktop browser checks traversed the complete penalty and digits journeys into practice. The slider kept the understanding plot's exact bounding box. The practice view showed only one network; selecting a neuron revealed its response and one outgoing multiplier. Creating a feature added it to the actual axis selector. At 1280×720 the image practice graph remains at least 180 CSS pixels high and the learning chart stays inside its panel. The underlying 2D surface canvas now matches its rendered box, so points and text no longer flatten when height changes. Two-decimal formatting is display-only.

The suite passed 221 tests across 44 files, including existing training and Scratch export checks; TypeScript and the production build passed. A 390-pixel-wide viewport had no document overflow, but the activity pane uses internal scrolling at that size; this is not a claim that all lesson content fits simultaneously on a phone. The viewport override was reset after the check.
