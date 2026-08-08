/** Minimal key event shape shared by React synthetic events and unit tests. */
type ActivateKeyEvent = {
  key: string;
  preventDefault(): void;
};

/** Enter/Space activate once; other keys are ignored. */
export function onActivateKeyDown(activate: () => void): (event: ActivateKeyEvent) => void {
  return (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activate();
    }
  };
}
