import { forwardRef, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, PanResponder, StyleSheet, View } from 'react-native';

export type FlipHandle = { next: () => void; prev: () => void };

type Props = {
  count: number;
  index: number;
  width: number;
  height: number;
  bg: string;
  renderPage: (i: number) => ReactNode;
  onIndexChange: (i: number) => void;
  /** two-finger pinch: +1 = spread (bigger text), -1 = pinch (smaller text) */
  onPinch: (dir: 1 | -1) => void;
};

type Dir = 'next' | 'prev';

/**
 * Book-style page turn: the page lifts and rotates around its left edge.
 * Swipe, tap the left/right third of the page, or call next()/prev().
 */
export const PageFlipper = forwardRef<FlipHandle, Props>(function PageFlipper(props, ref) {
  const { count, index, width, height, bg, renderPage } = props;
  const progress = useRef(new Animated.Value(0)).current;
  const [dir, setDir] = useState<Dir | null>(null);

  // latest props for the (created-once) responder callbacks
  const live = useRef({ ...props, dir: null as Dir | null, busy: false, mode: 'swipe' as 'swipe' | 'pinch', pinch0: 0, ratio: 1 });
  Object.assign(live.current, props);

  const start = (d: Dir) => {
    live.current.dir = d;
    setDir(d);
  };

  const finish = (d: Dir, commit: boolean) => {
    live.current.busy = true;
    Animated.timing(progress, {
      toValue: commit ? 1 : 0,
      duration: commit ? 230 : 170,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      const idx = live.current.index;
      live.current.dir = null;
      setDir(null);
      if (commit) live.current.onIndexChange(d === 'next' ? idx + 1 : idx - 1);
      requestAnimationFrame(() => {
        progress.setValue(0);
        live.current.busy = false;
      });
    });
  };

  const canGo = (d: Dir) => (d === 'next' ? live.current.index < live.current.count - 1 : live.current.index > 0);

  const programmatic = (d: Dir) => {
    if (live.current.busy || !canGo(d)) return;
    progress.setValue(0);
    start(d);
    finish(d, true);
  };

  useImperativeHandle(ref, () => ({ next: () => programmatic('next'), prev: () => programmatic('prev') }));

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      // only steal the touch from a child button once the finger really moves (or a second finger lands)
      onMoveShouldSetPanResponder: (e, g) =>
        e.nativeEvent.touches.length >= 2 || Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8,
      onPanResponderGrant: (e) => {
        const l = live.current;
        l.mode = e.nativeEvent.touches.length >= 2 ? 'pinch' : 'swipe';
        l.pinch0 = 0;
        l.ratio = 1;
      },
      onPanResponderMove: (e, g) => {
        const l = live.current;
        if (l.busy) return;
        const t = e.nativeEvent.touches;
        if (t.length >= 2 && l.mode === 'swipe' && !l.dir) l.mode = 'pinch';
        if (l.mode === 'pinch') {
          if (t.length >= 2) {
            const d = Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
            if (!l.pinch0) l.pinch0 = d;
            l.ratio = d / l.pinch0;
          }
          return;
        }
        if (Math.abs(g.dx) < 8 || Math.abs(g.dx) < Math.abs(g.dy)) return;
        const d: Dir = g.dx < 0 ? 'next' : 'prev';
        if (!canGo(d)) return;
        if (l.dir !== d) {
          progress.setValue(0);
          start(d);
        }
        progress.setValue(Math.min(1, Math.abs(g.dx) / (l.width * 0.75)));
      },
      onPanResponderRelease: (e, g) => {
        const l = live.current;
        if (l.busy) return;
        if (l.mode === 'pinch') {
          if (l.ratio > 1.25) l.onPinch(1);
          else if (l.ratio < 0.8) l.onPinch(-1);
          return;
        }
        if (l.dir) {
          const p = Math.abs(g.dx) / (l.width * 0.75);
          const fast = Math.abs(g.vx) > 0.5 && (g.vx < 0) === (l.dir === 'next');
          finish(l.dir, p > 0.3 || fast);
          return;
        }
        // a tap: left third = back, right third = forward
        if (Math.abs(g.dx) < 10 && Math.abs(g.dy) < 10) {
          const x = g.x0 / l.width;
          if (x < 0.3) programmatic('prev');
          else if (x > 0.7) programmatic('next');
        }
      },
      onPanResponderTerminate: () => {
        const l = live.current;
        if (l.dir && !l.busy) finish(l.dir, false);
      },
    }),
  ).current;

  const base = dir === 'next' ? index + 1 : index; // page underneath
  const flip = dir === 'next' ? index : index - 1; // page that turns

  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: dir === 'prev' ? ['-105deg', '0deg'] : ['0deg', '-105deg'],
  });
  const castShadow = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.28, 0] });
  const shade = progress.interpolate({
    inputRange: [0, 1],
    outputRange: dir === 'prev' ? [0.35, 0] : [0, 0.35],
  });

  return (
    <View style={{ width, height, backgroundColor: bg, overflow: 'hidden' }} {...pan.panHandlers}>
      <View style={StyleSheet.absoluteFill}>{count > 0 ? renderPage(Math.min(base, count - 1)) : null}</View>
      {dir && (
        <>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: castShadow }]} />
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: bg,
                backfaceVisibility: 'hidden',
                transformOrigin: 'left center',
                transform: [{ perspective: 1400 }, { rotateY: rotate }],
              },
            ]}
          >
            {renderPage(Math.max(0, flip))}
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: shade }]} />
          </Animated.View>
        </>
      )}
    </View>
  );
});
