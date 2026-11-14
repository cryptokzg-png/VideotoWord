import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import type { Chapter } from '../types';

type Props = {
  chapters: Chapter[];
  width: number;
  textStyle: TextStyle;
  heading: (index: number, chapter: Chapter) => ReactNode;
  onDone: (lines: string[][], headHeights: number[]) => void;
};

/**
 * Invisible: lays every chapter out with the real font and width and reports the exact
 * lines and heading heights, so pages can be cut to fit the screen with no scrolling.
 * Remount it (change its key) whenever width, font or size changes.
 */
export function Measurer({ chapters, width, textStyle, heading, onDone }: Props) {
  const lines = useRef<(string[] | undefined)[]>([]);
  const heads = useRef<(number | undefined)[]>([]);
  const done = useRef(false);

  const check = () => {
    if (done.current) return;
    for (let i = 0; i < chapters.length; i++) if (!lines.current[i] || heads.current[i] === undefined) return;
    done.current = true;
    onDone(lines.current as string[][], heads.current as number[]);
  };

  useEffect(() => {
    if (chapters.length === 0) onDone([], []);
  }, [chapters.length, onDone]);

  return (
    <View pointerEvents="none" style={[s.hidden, { width }]}>
      {chapters.map((ch, i) => (
        <View key={i}>
          <View
            onLayout={(e) => {
              heads.current[i] = e.nativeEvent.layout.height;
              check();
            }}
          >
            {heading(i, ch)}
          </View>
          <Text
            allowFontScaling={false}
            textBreakStrategy="simple"
            android_hyphenationFrequency="none"
            style={textStyle}
            onTextLayout={(e) => {
              lines.current[i] = e.nativeEvent.lines.map((l) => l.text);
              check();
            }}
          >
            {ch.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({ hidden: { position: 'absolute', top: 0, left: 0, opacity: 0 } });
