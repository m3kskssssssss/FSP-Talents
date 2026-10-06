/**
 * Colours and states for toggle chips: filters, grade pickers, tabs, segmented
 * choices. Add your own size/padding next to it:
 *
 *   className={cn("rounded-full border px-3 py-1 text-sm", chipState(selected))}
 *
 * Always pair with aria-pressed / aria-selected / aria-current on the element.
 */
export function chipState(selected: boolean | undefined) {
  return selected
    ? "border-primary bg-primary text-on-primary"
    : "border-line text-fg transition-colors hover:border-accent/50 hover:text-accent";
}
