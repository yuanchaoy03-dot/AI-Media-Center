# Pointer feedback

> Read only for this domain. Project scope and design values follow the [skill entry](../SKILL.md); examples are domain references, not implementation requirements.

## Response — kill latency

The moment lag appears, the feeling of directness "falls off a cliff." Response is the foundation everything else is built on.

- **Respond on pointer-down, not on release.** Highlight a button the instant it's pressed. Keep action commitment on a valid native click; early visual feedback must not execute the action on pointer-down.
- **Be vigilant about every latency.** Check only delays on the interaction being changed: debounces, artificial timers and transition waits. Anything on the input path that isn't essential is a regression.
- **Feedback must be continuous *during* the interaction, not just at the end.** For a drag, slider, or drawer, update the UI 1:1 with the pointer the whole way through — never animate only when the gesture completes.

```css
/* Feedback lives on the press, and it's instant */
.button:active {
  background-color: var(--color-pressed); /* project token; preserve prototype state */
}
```


## Spatial consistency — symmetric paths, anchored origins

> "If something disappears one way, we expect it to emerge from where it came."

- **Enter and exit along the same path.** A panel that slides in from the right must dismiss to the right. In-from-right / out-the-bottom feels disconnected and confusing.
- **Anchor interactions to their source.** A menu, popover, or sheet should originate from the element that triggered it — set `transform-origin` to the trigger, so the spatial relationship between button and content is obvious. (This is the same origin-awareness point as popovers scaling from their trigger, not their center.)
- **Keep reversible transitions spatially consistent.** Use project enter/exit easing; mirroring curves is optional and must not replace established tokens.
