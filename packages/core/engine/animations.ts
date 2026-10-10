/**
 * Put every CSS animation and Web Animation in the document on the video
 * clock. Each one is paused and set to the time since its enclosing
 * <Sequence> or shot began (`data-launch-from`), so keyframed CSS in a scene
 * renders the same whichever frame a worker starts from.
 *
 * CSS *transitions* depend on when a style changed, which a worker that
 * starts mid-video never sees. Drive changes with interpolate() instead.
 */
export function syncAnimations(frame: number, fps: number) {
  for (const animation of document.getAnimations()) {
    if (animation.timeline !== document.timeline) continue;
    const effect = animation.effect;
    const target = effect instanceof KeyframeEffect ? effect.target : null;
    const owner = target instanceof Element ? target.closest("[data-launch-from]") : null;
    const from = owner ? Number(owner.getAttribute("data-launch-from")) : 0;
    animation.pause();
    animation.currentTime = Math.max(0, ((frame - from) / fps) * 1000);
  }
}
