import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, ActivityIndicator, ScrollView } from 'react-native';
import { Mic as LucideMic, Square as LucideSquare, Volume2 as LucideVolume2, Info as LucideInfo } from 'lucide-react-native';
import theme from '../theme';
import { RepProfile, DemoScenario } from '../types';
import WaveformVisualizer from './WaveformVisualizer';
import { transcriptionService } from '../services/transcriptionService';
import { demoScenarios } from '../services/mockData';

// Cast icons to bypass React 19 Lucide types check conflict
const Mic = LucideMic as any;
const Square = LucideSquare as any;
const Volume2 = LucideVolume2 as any;
const Info = LucideInfo as any;

interface VoiceRecorderProps {
  activeProfile: RepProfile;
  onTranscriptionComplete: (text: string, durationSec: number) => void;
  isOnline: boolean;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  activeProfile,
  onTranscriptionComplete,
  isOnline,
}) => {
  const [selectedScenario, setSelectedScenario] = useState<DemoScenario | null>(demoScenarios[0]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const audioUriRef = useRef<string | null>(null);

  // Pulse animation for recording button
  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (isRecording) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => animation?.stop();
  }, [isRecording]);

  // Clean timers on unmount
  useEffect(() => {
    return () => {
      stopLocalTimer();
      stopTypingSimulation();
    };
  }, []);

  const startLocalTimer = () => {
    setSeconds(0);
    timerRef.current = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
  };

  const stopLocalTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Simulates real-time text output based on the scenario
  const startTypingSimulation = (fullText: string) => {
    setLiveTranscript('');
    let index = 0;
    const words = fullText.split(' ');
    
    const typeWord = () => {
      if (index < words.length) {
        setLiveTranscript((prev) => (prev ? prev + ' ' + words[index] : words[index]));
        index++;
        
        // Dynamic reading speed between 200ms and 400ms per word
        const nextDelay = 180 + Math.random() * 200;
        typingTimerRef.current = setTimeout(typeWord, nextDelay);
      }
    };
    
    // Start after a brief pause
    typingTimerRef.current = setTimeout(typeWord, 1000);
  };

  const stopTypingSimulation = () => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
  };

  const handleStartRecording = async () => {
    try {
      setLiveTranscript('');
      setIsRecording(true);
      startLocalTimer();

      // Start actual device hardware recording (FR-1.1)
      await transcriptionService.startRecording();

      // Start simulated speech display if scenario is selected
      if (selectedScenario) {
        startTypingSimulation(selectedScenario.transcript);
      } else {
        setLiveTranscript('Listening... Speak now.');
        await transcriptionService.startLiveRecognition({
          onSpeechStart: () => {
            setLiveTranscript('Listening... Speak now.');
          },
          onSpeechPartialResults: (text) => {
            setLiveTranscript(text);
          },
          onSpeechResults: (text) => {
            setLiveTranscript(text);
          },
          onSpeechError: (err) => {
            if (err === 'SPEECH_NOT_SUPPORTED') {
              setLiveTranscript('Voice recognition is not supported in this client environment. Using simulated real use-case note on stop.');
            } else {
              console.warn('Speech Recognition error:', err);
            }
          }
        });
      }
    } catch (err) {
      setIsRecording(false);
      stopLocalTimer();
      alert('Could not start voice recording. Please verify microphone permissions.');
    }
  };

  const handleStopRecording = async () => {
    setIsRecording(false);
    stopLocalTimer();
    stopTypingSimulation();

    if (!selectedScenario) {
      await transcriptionService.stopLiveRecognition();
    }

    setIsProcessing(true);

    try {
      // Stop hardware recording and get file info
      const { uri, durationMs } = await transcriptionService.stopRecording();
      audioUriRef.current = uri;
      const durationSec = Math.max(Math.round(durationMs / 1000), seconds);

      // Perform translation/extraction (demo vs live)
      let finalTranscript = liveTranscript;
      
      if (selectedScenario) {
        // In scenario mode, use the verified correct text
        finalTranscript = selectedScenario.transcript;
      } else {
        // Simple native speech to text for only custom/real microphone
        if (
          !liveTranscript ||
          liveTranscript === 'Listening... Speak now.' ||
          liveTranscript.startsWith('Listening... Speak') ||
          liveTranscript.startsWith('Voice recognition is not supported')
        ) {
          finalTranscript = '';
        }
      }

      // Add a small artificial wait for AI extraction feel
      setTimeout(() => {
        setIsProcessing(false);
        onTranscriptionComplete(finalTranscript, durationSec);
      }, 2000);

    } catch (error) {
      console.error(error);
      setIsProcessing(false);
      onTranscriptionComplete("Failed to transcribe note due to API or file error.", seconds);
    }
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      {/* Scenario Selector */}
      <View style={styles.scenarioCard}>
        <Text style={styles.scenarioCardTitle}>Active Demo Scenario Selector</Text>
        <Text style={styles.scenarioCardDesc}>Select a pre-built customer visit scenario to simulate speech transcription.</Text>
        
        <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} style={styles.scenariosScroll}>
          <TouchableOpacity
            style={[styles.scenarioChip, selectedScenario === null && styles.scenarioChipActive]}
            onPress={() => setSelectedScenario(null)}
          >
            <Text style={[styles.scenarioChipText, selectedScenario === null && styles.scenarioChipTextActive]}>
              Custom / Real Microphone
            </Text>
          </TouchableOpacity>

          {demoScenarios.map((scen) => {
            const isSelected = selectedScenario?.id === scen.id;
            return (
              <TouchableOpacity
                key={scen.id}
                style={[styles.scenarioChip, isSelected && styles.scenarioChipActive]}
                onPress={() => setSelectedScenario(scen)}
              >
                <Text style={[styles.scenarioChipText, isSelected && styles.scenarioChipTextActive]}>
                  {scen.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {selectedScenario && (
          <View style={styles.scenarioHintBox}>
            <Text style={styles.scenarioHintTitle}>Scenario Description:</Text>
            <Text style={styles.scenarioHintText}>{selectedScenario.description}</Text>
          </View>
        )}
      </View>

      {/* Recording Display */}
      <View style={styles.recorderPanel}>
        <View style={styles.headerRow}>
          <View style={styles.badge}>
            <Volume2 size={12} color={theme.colors.primaryLight} style={styles.badgeIcon} />
            <Text style={styles.badgeText}>{activeProfile.territory}</Text>
          </View>
          <Text style={styles.timerText}>{formatTime(seconds)}</Text>
        </View>

        {/* Waveform / Visualizer */}
        <View style={styles.waveformContainer}>
          <WaveformVisualizer isRecording={isRecording} />
          {(!isRecording && !isProcessing && liveTranscript === '') && (
            <Text style={styles.instructionText}>Press the Mic to start recording visit notes</Text>
          )}
          {isProcessing && (
            <View style={styles.processingRow}>
              <ActivityIndicator size="small" color={theme.colors.accent} style={{ marginRight: 8 }} />
              <Text style={styles.processingText}>AI extracting structured CRM fields...</Text>
            </View>
          )}
        </View>

        {/* Live Transcript Display Box */}
        {(isRecording || liveTranscript !== '') && (
          <View style={styles.transcriptBox}>
            <Text style={styles.transcriptLabel}>Real-time AI Transcription</Text>
            <Text style={styles.transcriptText}>
              {liveTranscript || 'Listening for speech...'}
            </Text>
          </View>
        )}

        {/* Custom Vocabulary Hints */}
        <View style={styles.vocabPanel}>
          <View style={styles.vocabHeader}>
            <Info size={12} color={theme.colors.textMuted} style={{ marginRight: 4 }} />
            <Text style={styles.vocabHeaderText}>Active Spoken Vocabulary Hints</Text>
          </View>
          <View style={styles.vocabChips}>
            {activeProfile.customVocabulary.slice(0, 5).map((vocab, index) => (
              <View key={index} style={styles.chip}>
                <Text style={styles.chipText}>{vocab}</Text>
              </View>
            ))}
            {activeProfile.customVocabulary.length > 5 && (
              <View style={[styles.chip, styles.chipMore]}>
                <Text style={styles.chipText}>+{activeProfile.customVocabulary.length - 5} more</Text>
              </View>
            )}
          </View>
        </View>

        {/* Record Buttons */}
        <View style={styles.controlsRow}>
          {isRecording ? (
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                style={[styles.button, styles.buttonStop]}
                onPress={handleStopRecording}
                activeOpacity={0.8}
              >
                <Square size={28} color="#FFFFFF" fill="#FFFFFF" />
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <TouchableOpacity
              style={[styles.button, styles.buttonRecord, isProcessing && styles.buttonDisabled]}
              onPress={handleStartRecording}
              disabled={isProcessing}
              activeOpacity={0.8}
            >
              <Mic size={32} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  scenarioCard: {
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  scenarioCardTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  scenarioCardDesc: {
    color: theme.colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
    marginBottom: theme.spacing.sm,
  },
  scenariosScroll: {
    flexDirection: 'row',
    marginBottom: theme.spacing.sm,
  },
  scenarioChip: {
    backgroundColor: '#0F1626',
    borderWidth: 1,
    borderColor: '#1D283E',
    borderRadius: theme.borderRadius.sm,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  scenarioChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  scenarioChipText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  scenarioChipTextActive: {
    color: '#FFFFFF',
  },
  scenarioHintBox: {
    backgroundColor: '#0F1522',
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: '#182235',
  },
  scenarioHintTitle: {
    color: theme.colors.primaryLight,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  scenarioHintText: {
    color: theme.colors.text,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  recorderPanel: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    padding: theme.spacing.lg,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: theme.borderRadius.sm,
  },
  badgeIcon: {
    marginRight: 4,
  },
  badgeText: {
    color: theme.colors.primaryLight,
    fontSize: 12,
    fontWeight: '600',
  },
  timerText: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  waveformContainer: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  instructionText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  processingText: {
    color: theme.colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  transcriptBox: {
    backgroundColor: '#0F1522',
    borderWidth: 1,
    borderColor: '#1D283E',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    height: 120,
    marginBottom: theme.spacing.md,
  },
  transcriptLabel: {
    color: theme.colors.primaryLight,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  transcriptText: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  vocabPanel: {
    marginBottom: theme.spacing.lg,
  },
  vocabHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  vocabHeaderText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  vocabChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    backgroundColor: '#1E293B',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: theme.borderRadius.sm,
    marginRight: 6,
    marginBottom: 6,
  },
  chipMore: {
    backgroundColor: '#2A3649',
  },
  chipText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  controlsRow: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 80,
  },
  button: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  buttonRecord: {
    backgroundColor: theme.colors.primary,
  },
  buttonStop: {
    backgroundColor: theme.colors.danger,
  },
  buttonDisabled: {
    backgroundColor: theme.colors.textMuted,
    opacity: 0.5,
  },
});

export default VoiceRecorder;
