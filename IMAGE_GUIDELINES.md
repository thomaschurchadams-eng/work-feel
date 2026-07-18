# CreditUnionAI News Image Guidelines

## Purpose
Create credible, executive-facing editorial imagery with enough visual range that the publication never looks machine-generated or templated.

## Production standard
- Preferred social/hero size: 1200×630
- Repository format: optimized JPG, PNG, or WebP as appropriate
- Descriptive lowercase kebab-case filename
- Accurate alt text and social metadata
- No text, logos, trademarks, watermarks, confidential data, or recognizable public figures
- No distorted hands or faces and no misleading depiction of a real product or institution

## Required concept-selection workflow
1. Read `automation/image-taxonomy.json` and `automation/image-ledger.json`.
2. Review at least the 20 most recent production images.
3. Generate three concepts with different mediums and subjects.
4. Score all three using `scripts/score-image-concepts.mjs`.
5. Reject concepts that repeat a recent medium, overused palette, boardroom scene, exact visual tuple, or prohibited cliché.
6. Generate the highest-scoring valid concept.
7. Inspect the result for quality and factual/editorial fit.
8. Save the image and append its dimensions to `automation/image-ledger.json` in the same production commit.

## Variation dimensions
Rotate medium, subject, composition, perspective, palette, lighting, texture, scene, and central metaphor. A recolor does not count as a new concept.

Use the full taxonomy, including photography, paper-cut, 3D, isometric, collage, ink/linocut, abstract data, macro still life, cinematic conceptual art, and soft editorial illustration. Blue is one palette—not the publication's automatic answer.

## Avoid
Generic glowing brains, robot handshakes, holographic bank buildings, repetitive boardrooms, fake dashboards, decorative circuitry without meaning, and repeated navy/purple scenes.

## Prompt construction
Describe the specific editorial idea, chosen taxonomy dimensions, subject, visual metaphor, and why it fits the article. End with: no readable text, logos, trademarks, watermarks, or recognizable real people; 1200×630 landscape.
