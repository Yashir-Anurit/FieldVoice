import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import theme from '../theme';

interface WaveformVisualizerProps {
  isRecording: boolean;
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({ isRecording }) => {
  const animations = useRef(Array.from({ length: 9 }, () => new Animated.Value(15))).current;
  const loopRefs = useRef<(Animated.CompositeAnimation | null)[]>([]);

  useEffect(() => {
    if (isRecording) {
      animations.forEach((anim, i) => {
        const startAnimation = () => {
          const targetHeight = 15 + Math.random() * 55;
          const duration = 200 + Math.random() * 300;

          const activeAnim = Animated.sequence([
            Animated.timing(anim, {
              toValue: targetHeight,
              duration: duration,
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: 10 + Math.random() * 15,
              duration: duration,
              useNativeDriver: false,
            }),
          ]);

          loopRefs.current[i] = Animated.loop(activeAnim);
          loopRefs.current[i]?.start();
        };

        // Stagger start times slightly
        setTimeout(startAnimation, i * 40);
      });
    } else {
      // Stop and reset
      animations.forEach((anim, i) => {
        loopRefs.current[i]?.stop();
        Animated.timing(anim, {
          toValue: 15,
          duration: 300,
          useNativeDriver: false,
        }).start();
      });
    }

    return () => {
      animations.forEach((_, i) => loopRefs.current[i]?.stop());
    };
  }, [isRecording]);

  return (
    <View style={styles.container}>
      {animations.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            styles.bar,
            {
              height: anim,
              backgroundColor: isRecording ? theme.colors.primary : '#334155',
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 100,
    width: '100%',
  },
  bar: {
    width: 6,
    borderRadius: 3,
    marginHorizontal: 4,
    minHeight: 12,
  },
});

export default WaveformVisualizer;
