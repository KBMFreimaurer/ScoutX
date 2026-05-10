import { useCallback, useRef } from "react";

const DEFAULT_SCROLL_TAP_THRESHOLD_PX = 10;

export function useScrollTapGuard(thresholdPx = DEFAULT_SCROLL_TAP_THRESHOLD_PX) {
  const touchRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
  });

  const reset = useCallback(() => {
    touchRef.current.active = false;
    touchRef.current.moved = false;
    touchRef.current.startX = 0;
    touchRef.current.startY = 0;
  }, []);

  const onTouchStart = useCallback(
    (event) => {
      const touch = event.touches?.[0];
      if (!touch) {
        reset();
        return;
      }

      touchRef.current.active = true;
      touchRef.current.moved = false;
      touchRef.current.startX = touch.clientX;
      touchRef.current.startY = touch.clientY;
    },
    [reset],
  );

  const onTouchMove = useCallback(
    (event) => {
      if (!touchRef.current.active) {
        return;
      }
      const touch = event.touches?.[0];
      if (!touch) {
        return;
      }

      const deltaX = Math.abs(touch.clientX - touchRef.current.startX);
      const deltaY = Math.abs(touch.clientY - touchRef.current.startY);
      if (deltaX > thresholdPx || deltaY > thresholdPx) {
        touchRef.current.moved = true;
      }
    },
    [thresholdPx],
  );

  const shouldAllowTap = useCallback(() => {
    const allowTap = !touchRef.current.moved;
    reset();
    return allowTap;
  }, [reset]);

  const wrapOnClick = useCallback(
    (handler) => (event) => {
      if (!shouldAllowTap()) {
        event.preventDefault();
        return;
      }
      handler?.(event);
    },
    [shouldAllowTap],
  );

  return {
    touchProps: {
      onTouchStart,
      onTouchMove,
      onTouchEnd: reset,
      onTouchCancel: reset,
    },
    wrapOnClick,
  };
}

