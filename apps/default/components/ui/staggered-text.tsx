import { Fragment } from "react";
import { Platform, Text, TextProps, TextStyle } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { EASE } from "@/lib/design-tokens";
import { useReduceMotion } from "@/hooks/use-reduce-motion";

interface StaggeredTextProps extends Omit<TextProps, "children"> {
  text: string;
  style?: TextStyle | Array<TextStyle | undefined>;
  /** Delay between word entrances. Per docs/design.md: ~24ms/word. */
  perWordDelay?: number;
  /** Duration of each word's entrance. */
  wordDuration?: number;
  /** Cap on animated words so very long texts stay bounded; the tail renders plain. */
  maxWords?: number;
}

/**
 * StaggeredText — words fade/slide in one after another. Replaces the
 * typewriter (docs/design.md: typewriter reads as slow and hides length).
 * On web and for reduced-motion users it renders plain text.
 */
export function StaggeredText({
  text,
  style,
  perWordDelay = 24,
  wordDuration = 260,
  maxWords = 90,
  ...rest
}: StaggeredTextProps) {
  const reduceMotion = useReduceMotion();

  if (reduceMotion || Platform.OS === "web") {
    return (
      <Text style={style} {...rest}>
        {text}
      </Text>
    );
  }

  const words = text.split(/\s+/).filter(Boolean);

  return (
    <Text style={style} {...rest}>
      {words.map((word, index) => (
        <Fragment key={`${index}-${word}`}>
          {index > 0 ? " " : null}
          {index < maxWords ? (
            <Animated.Text
              entering={FadeInDown.duration(wordDuration)
                .easing(EASE.out)
                .delay(Math.min(index * perWordDelay, 800))}
            >
              {word}
            </Animated.Text>
          ) : (
            <Text>{word}</Text>
          )}
        </Fragment>
      ))}
    </Text>
  );
}
