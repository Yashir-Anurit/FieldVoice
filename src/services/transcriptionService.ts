import { Audio } from 'expo-av';
import { NativeModules, Platform } from 'react-native';
import { ExpoWebSpeechRecognition } from 'expo-speech-recognition';
import { demoScenarios } from './mockData';

const AZURE_OPENAI_ENDPOINT =
  'https://audio-to-text-model-resource.cognitiveservices.azure.com/openai/deployments/gpt-4o-mini-transcribe/audio/transcriptions?api-version=2025-03-01-preview';

const AZURE_MODEL =
  'gpt-4o-mini-transcribe';

const AZURE_API_KEY =
  '2gk1IOjseIIjOyLMqBalGeIkx98v26L3T9bxfETmBl8DNkoKhtPXJQQJ99CFACHYHv6XJ3w3AAAAACOGk9DF';

// Dynamically load ExpoSpeechRecognition to prevent crash in Expo Go
let ExpoSpeechRecognitionModule: any = null;
try {
  if (Platform.OS !== 'web') {
    const speechModule = require('expo-speech-recognition');
    ExpoSpeechRecognitionModule = speechModule.ExpoSpeechRecognitionModule;
  }
} catch (e) {
  console.warn("ExpoSpeechRecognition native module not available (this is expected in Expo Go).");
}

let isVoiceNativeSupported = false;
if (Platform.OS !== 'web' && !!ExpoSpeechRecognitionModule) {
  try {
    isVoiceNativeSupported =
      typeof ExpoSpeechRecognitionModule.isRecognitionAvailable === 'function' &&
      ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch (e) {
    console.warn("Failed to check if native voice is supported:", e);
  }
}

export interface TranscriptionResult {
  text: string;
  isMock: boolean;
}

export interface SpeechRecognitionHandlers {
  onSpeechStart?: () => void;
  onSpeechResults?: (text: string) => void;
  onSpeechPartialResults?: (text: string) => void;
  onSpeechEnd?: (text: string) => void;
  onSpeechError?: (errorMsg: string) => void;
}

class TranscriptionService {
  private recordingInstance: Audio.Recording | null = null;
  private isRecordingActive = false;
  private speechHandlers: SpeechRecognitionHandlers | null = null;
  private webSpeechRecognition: any = null;
  private nativeSubscriptions: { remove: () => void }[] = [];
  private activeRecognition: any = null;

  async requestPermissions(): Promise<boolean> {
    const { status } = await Audio.requestPermissionsAsync();
    let speechGranted = true;
    if (Platform.OS !== 'web' && !!ExpoSpeechRecognitionModule && typeof ExpoSpeechRecognitionModule.requestPermissionsAsync === 'function') {
      try {
        const speechStatus = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        speechGranted = speechStatus.granted;
      } catch (err) {
        console.warn('Failed to request speech recognition permissions:', err);
        speechGranted = false;
      }
    }
    return status === 'granted' && speechGranted;
  }

  async startRecording(): Promise<void> {
    try {
      const permitted = await this.requestPermissions();
      if (!permitted) {
        throw new Error('Microphone or Speech Recognition permission not granted');
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      this.recordingInstance = recording;
      this.isRecordingActive = true;
    } catch (error) {
      console.error('Failed to start recording', error);
      throw error;
    }
  }

  async stopRecording(): Promise<{ uri: string | null; durationMs: number }> {
    if (!this.recordingInstance || !this.isRecordingActive) {
      return { uri: null, durationMs: 0 };
    }

    try {
      this.isRecordingActive = false;
      await this.recordingInstance.stopAndUnloadAsync();
      const uri = this.recordingInstance.getURI();
      const status = await this.recordingInstance.getStatusAsync();
      const durationMs = status.durationMillis || 0;
      this.recordingInstance = null;
      return { uri, durationMs };
    } catch (error) {
      console.error('Failed to stop recording', error);
      this.recordingInstance = null;
      return { uri: null, durationMs: 0 };
    }
  }

  async transcribeAudio(
    audioUri: string,
    customVocabulary?: string[]
  ): Promise<TranscriptionResult> {
    try {

      console.log('Transcription Started');
      const formData = new FormData();

      const filename =
        audioUri.split('/').pop() || 'recording.m4a';

      const match = /\.(\w+)$/.exec(filename);
      const ext = match ? match[1] : 'm4a';

      formData.append('file', {
        uri: audioUri,
        name: filename,
        type: `audio/${ext}`,
      } as any);

      formData.append('model', AZURE_MODEL);

      if (
        customVocabulary &&
        customVocabulary.length > 0
      ) {
        formData.append(
          'prompt',
          customVocabulary.join(', ')
        );
      }

      const response = await fetch(
        AZURE_OPENAI_ENDPOINT,
        {
          method: 'POST',
          headers: {
            'api-key': AZURE_API_KEY,
          },
          body: formData,
        }
      );

      console.log("Transcription Response: ", response);

      if (!response.ok) {
        const txt = await response.text();
        console.log("Transcription Failed: ", txt);
        throw new Error(
          `Azure transcription failed: ${txt}`
        );
      }

      const data = await response.json();
      console.log("Transcription Data: ", data);
      console.log("Transcription Completed: ", data.text);

      return {
        text: data.text || '',
        isMock: false,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  // async transcribeAudio(
  //   audioUri: string,
  //   openaiApiKey?: string,
  //   customVocabulary?: string[]
  // ): Promise<TranscriptionResult> {
  //   if (!openaiApiKey) {
  //     // Simulate transcription fallback
  //     return new Promise((resolve) => {
  //       setTimeout(() => {
  //         resolve({
  //           text: "Simulated transcription: We met with Ceres Grain Corp and Gregory Peck to buy Alfalfa Seed for forty thousand dollars, closing in December.",
  //           isMock: true,
  //         });
  //       }, 1500);
  //     });
  //   }

  //   try {
  //     // Live transcription via OpenAI Whisper API
  //     const formData = new FormData();

  //     // Construct file object
  //     const filename = audioUri.split('/').pop() || 'recording.m4a';
  //     const match = /\.(\w+)$/.exec(filename);
  //     const ext = match ? match[1] : 'm4a';
  //     const type = `audio/${ext}`;

  //     formData.append('file', {
  //       uri: audioUri,
  //       name: filename,
  //       type,
  //     } as any);
  //     formData.append('model', 'whisper-1');

  //     if (customVocabulary && customVocabulary.length > 0) {
  //       formData.append('prompt', customVocabulary.join(', '));
  //     }

  //     const response = await fetch('https://audio-to-text-model-resource.cognitiveservices.azure.com/openai/deployments/gpt-4o-mini-transcribe/audio/transcriptions?api-version=2025-03-01-preview', {
  //       method: 'POST',
  //       headers: {
  //         Authorization: `Bearer ${openaiApiKey}`,
  //         'Content-Type': 'multipart/form-data',
  //       },
  //       body: formData,
  //     });

  //     if (!response.ok) {
  //       const errText = await response.text();
  //       throw new Error(`Whisper API error: ${response.status} - ${errText}`);
  //     }

  //     const data = await response.json();
  //     return {
  //       text: data.text,
  //       isMock: false,
  //     };
  //   } catch (error) {
  //     console.error('Transcription error, falling back to simulation', error);
  //     throw error;
  //   }
  // }

  getMockTranscriptForScenario(scenarioId: string): string {
    const scenario = demoScenarios.find((s) => s.id === scenarioId);
    return scenario ? scenario.transcript : '';
  }

  private initWebSpeech() {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          if (this.speechHandlers?.onSpeechStart) {
            this.speechHandlers.onSpeechStart();
          }
        };

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }

          const transcript = finalTranscript || interimTranscript;
          if (this.speechHandlers?.onSpeechPartialResults) {
            this.speechHandlers.onSpeechPartialResults(transcript);
          }
        };

        recognition.onerror = (event: any) => {
          if (this.speechHandlers?.onSpeechError) {
            this.speechHandlers.onSpeechError(event.error || 'Web speech error');
          }
        };

        recognition.onend = () => {
          if (this.speechHandlers?.onSpeechEnd) {
            this.speechHandlers.onSpeechEnd('');
          }
        };

        this.webSpeechRecognition = recognition;
      }
    }
  }

  private clearNativeSubscriptions() {
    this.nativeSubscriptions.forEach((sub) => {
      try {
        sub.remove();
      } catch (e) {
        console.error('Failed to remove native subscription:', e);
      }
    });
    this.nativeSubscriptions = [];
  }

  async startLiveRecognition(handlers: SpeechRecognitionHandlers): Promise<void> {
    this.speechHandlers = handlers;

    try {
      if (this.activeRecognition) {
        try {
          this.activeRecognition.stop();
        } catch (e) {}
      }

      const recognition = new ExpoWebSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        if (this.speechHandlers?.onSpeechStart) {
          this.speechHandlers.onSpeechStart();
        }
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = 0; i < event.results.length; ++i) {
          const result = event.results[i];
          const alternative = result[0];
          if (alternative) {
            const text = alternative.transcript || '';
            if (result.isFinal) {
              finalTranscript += text;
            } else {
              interimTranscript += text;
            }
          }
        }

        const fullTranscript = (finalTranscript + interimTranscript).trim();

        if (this.speechHandlers?.onSpeechPartialResults) {
          this.speechHandlers.onSpeechPartialResults(fullTranscript);
        }
        if (this.speechHandlers?.onSpeechResults) {
          this.speechHandlers.onSpeechResults(fullTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error event:', event);
        if (this.speechHandlers?.onSpeechError) {
          this.speechHandlers.onSpeechError(event.error || 'Speech recognition error');
        }
      };

      recognition.onend = () => {
        if (this.speechHandlers?.onSpeechEnd) {
          this.speechHandlers.onSpeechEnd('');
        }
      };

      this.activeRecognition = recognition;
      recognition.start();

    } catch (err: any) {
      console.warn('Speech recognition not available. Falling back to simulator mode:', err.message || err);
      if (this.speechHandlers?.onSpeechError) {
        this.speechHandlers.onSpeechError('SPEECH_NOT_SUPPORTED');
      }
    }
  }

  async stopLiveRecognition(): Promise<void> {
    if (this.activeRecognition) {
      try {
        this.activeRecognition.stop();
      } catch (e) {
        console.error('Error stopping Speech Recognition:', e);
      }
      this.activeRecognition = null;
    }
  }
}

export const transcriptionService = new TranscriptionService();
export default transcriptionService;
