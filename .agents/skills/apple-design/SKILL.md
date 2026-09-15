---
name: apple-design
description: Refine or review Apple-style pointer feedback, motion, springs, gestures, translucent materials, or typography. Not for ordinary frontend logic or bug fixes.
---

# Apple Design

Translate Apple-style interaction craft to the web: immediate feedback, continuous motion, clear spatial relationships and restrained materials. Use this skill when those qualities are the task, not simply because a file is Vue or CSS.

## Scope and priority

- Ordinary Vue business logic, API wiring, routing, Mock data, copy edits and TypeScript fixes do not need this skill. A basic hover fix can use source and project tokens directly; use this skill for interaction refinement or review.
- The user's explicit task takes precedence over generic skill advice. [AGENTS.md](../../../AGENTS.md) owns project boundaries and the current frontend stage; references do not enable deferred capabilities.
- [DESIGN.md](../../../DESIGN.md) owns project tokens and motion/material rules; the corresponding HTML prototype owns existing layout and visual states. This skill does not authorize redesign, navigation changes, new dependencies or additional features.
- Keep native semantic controls and browser behavior. Prefer the simplest implementation that gives immediate, interruptible feedback; use springs only when physical continuity is needed.

## Read only the relevant reference

| Task | Reference |
|---|---|
| Press/hover timing, pointer feedback, anchored menus | [interaction.md](references/interaction.md) |
| Transition reversal, spring tuning, frame smoothness | [motion.md](references/motion.md) |
| Actual dragging, velocity handoff, momentum or requested touch design | [gestures.md](references/gestures.md) |
| Blur, translucency, layering and material legibility | [materials.md](references/materials.md) |
| Optical sizing, tracking, leading and type hierarchy | [typography.md](references/typography.md) |
| Reduced motion/transparency, contrast and fallback behavior | [accessibility.md](references/accessibility.md) |
| Explicit Apple-style UI review or design rationale | [review.md](references/review.md) |

Read another reference only when the task crosses into that domain. A menu feedback refinement needs interaction plus the relevant DESIGN section, not the gesture or review guides. For motion/material changes, apply DESIGN's reduction/fallback rules; open accessibility details only if needed.

## Provenance and maintenance

Project-maintained adaptation of `emilkowalski/skills`, originally installed from `skills/apple-design/SKILL.md`; inherited knowledge primarily references WWDC fluid-interface and typography talks. Examples are not verified current library APIs or project defaults.

[skills-lock.json](../../../skills-lock.json) retains the upstream installation record; its `computedHash` is not claimed as a checksum of this locally adapted version. Updates from upstream must be reviewed against these local changes rather than overwriting the skill automatically.
