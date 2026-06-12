import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, SafeAreaView, TouchableOpacity, ScrollView, Alert, StatusBar, ActivityIndicator, Modal, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Mic as LucideMic,
  History as LucideHistory,
  Settings as LucideSettings,
  FileAudio as LucideFileAudio,
  CheckCircle2 as LucideCheckCircle2,
  FileText as LucideFileText,
  Brain as LucideBrain,
  Check as LucideCheck,
  Database as LucideDatabase
} from 'lucide-react-native';

import theme from './src/theme';
import { RepProfile, OfflineNote, ExtractedData } from './src/types';

import { mockProfiles } from './src/services/mockData';
import { salesforceService } from './src/services/salesforceService';
import { offlineManager } from './src/services/offlineManager';
import { llmService } from './src/services/llmService';
import { transcriptionService } from './src/services/transcriptionService';

import VoiceRecorder from './src/components/VoiceRecorder';
import ReviewCard from './src/components/ReviewCard';
import SyncStatusBanner from './src/components/SyncStatusBanner';
import RepProfileSelector from './src/components/RepProfileSelector';
import HistoryQueue from './src/components/HistoryQueue';
import CrmExplorer from './src/components/CrmExplorer';

// Cast icons to bypass React 19 Lucide types check conflict
const Mic = LucideMic as any;
const History = LucideHistory as any;
const Settings = LucideSettings as any;
const FileAudio = LucideFileAudio as any;
const CheckCircle2 = LucideCheckCircle2 as any;
const FileText = LucideFileText as any;
const Brain = LucideBrain as any;
const Check = LucideCheck as any;
const Database = LucideDatabase as any;

export default function App() {
  const [activeTab, setActiveTab] = useState<'record' | 'history' | 'explorer' | 'settings'>('record');
  const [activeProfile, setActiveProfile] = useState<RepProfile>(mockProfiles[0]);
  
  const [isOnline, setIsOnline] = useState(true);
  const [simulatedOffline, setSimulatedOffline] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState<OfflineNote[]>([]);
  
  const [activeReviewNote, setActiveReviewNote] = useState<OfflineNote | null>(null);
  const [showReviewScreen, setShowReviewScreen] = useState(false);
  const [reviewData, setReviewData] = useState<ExtractedData | null>(null);

  const [showSyncSuccess, setShowSyncSuccess] = useState(false);
  const [syncedAccountName, setSyncedAccountName] = useState('');
  const [processingState, setProcessingState] = useState<'idle' | 'transcribing' | 'extracting'>('idle');

  useEffect(() => {
    const startup = async () => {
      // Seed databases initially
      await salesforceService.initializeDb();

      // Load rep profiles
      const storedProfiles = await AsyncStorage.getItem('fv_rep_profiles');
      if (!storedProfiles) {
        await AsyncStorage.setItem('fv_rep_profiles', JSON.stringify(mockProfiles));
      } else {
        const parsed = JSON.parse(storedProfiles);
        const activeId = await AsyncStorage.getItem('fv_active_profile_id');
        const found = parsed.find((p: RepProfile) => p.id === activeId);
        if (found) setActiveProfile(found);
      }

      // Initialize offline manager
      await offlineManager.init(
        (updatedQueue) => {
          setOfflineQueue(updatedQueue);
        },
        (onlineState) => {
          setIsOnline(onlineState);
        }
      );

      const simOfflineVal = await offlineManager.getSimulateOffline();
      setSimulatedOffline(simOfflineVal);

      const initialQueue = await offlineManager.getQueue();
      setOfflineQueue(initialQueue);
    };

    startup();
  }, []);

  const handleProfileChange = async (profile: RepProfile) => {
    setActiveProfile(profile);
    await AsyncStorage.setItem('fv_active_profile_id', profile.id);
  };

  const handleProfileUpdate = async (updatedProfile: RepProfile) => {
    setActiveProfile(updatedProfile);
    const storedProfiles = await AsyncStorage.getItem('fv_rep_profiles');
    if (storedProfiles) {
      const profiles: RepProfile[] = JSON.parse(storedProfiles);
      const index = profiles.findIndex((p) => p.id === updatedProfile.id);
      if (index !== -1) {
        profiles[index] = updatedProfile;
        await AsyncStorage.setItem('fv_rep_profiles', JSON.stringify(profiles));
      }
    }
  };

  const handleToggleSimulatedOffline = async (val: boolean) => {
    setSimulatedOffline(val);
    await offlineManager.setSimulateOffline(val);
  };

  const handleTranscriptionComplete = async (
    audioUri: string | null,
    nativeTranscript: string,
    durationSec: number
  ) => {
    // If Offline: Save to queue as pending so that it processes later
    if (!isOnline) {
      const newNoteId = `note-${Date.now()}`;
      const noteData: Omit<OfflineNote, 'syncStatus'> = {
        id: newNoteId,
        timestamp: new Date().toISOString(),
        duration: durationSec,
        transcript: nativeTranscript || 'Offline voice note audio capture',
        extractedData: null,
        repProfileId: activeProfile.id,
      };

      await offlineManager.addToQueue(noteData);
      Alert.alert(
        'Note Queued Offline',
        'Your recording is stored securely on the device. It will automatically transcribe and process when connection is restored.',
        [{ text: 'OK', onPress: () => setActiveTab('history') }]
      );
      return;
    }

    // If Online: Start foreground sequential processing
    const newNoteId = `note-${Date.now()}`;
    let finalTranscript = nativeTranscript;

    try {
      if (audioUri) {
        setProcessingState('transcribing');
        try {
          const result = await transcriptionService.transcribeAudio(
            audioUri,
            activeProfile.customVocabulary
          );
          if (result && result.text) {
            finalTranscript = result.text;
          }
        } catch (err) {
          console.warn('Azure audio file transcription failed, using native speech fallback:', err);
        }
      }

      setProcessingState('extracting');
      const keys = await offlineManager.getKeys();
      let extractedData: ExtractedData;

      if (keys.geminiKey) {
        extractedData = await llmService.queryGemini(
          finalTranscript || 'No transcription text captured.',
          activeProfile,
          keys.geminiKey
        );
      } else {
        extractedData = llmService.simulateExtraction(
          finalTranscript || 'No transcription text captured.',
          activeProfile
        );
      }

      setProcessingState('idle');

      const completedNote: OfflineNote = {
        id: newNoteId,
        timestamp: new Date().toISOString(),
        duration: durationSec,
        transcript: finalTranscript || 'No transcription text captured.',
        extractedData,
        repProfileId: activeProfile.id,
        syncStatus: 'synced',
      };

      const addedNote = await offlineManager.addSyncedNote(completedNote);
      
      setActiveReviewNote(addedNote);
      setReviewData(extractedData);
      setShowReviewScreen(true);

    } catch (err) {
      console.error('Foreground processing failed:', err);
      setProcessingState('idle');
      Alert.alert('Processing Error', 'An error occurred while processing your voice note.');
    }
  };

  const handleSyncSubmit = async (finalData: ExtractedData) => {
    const result = await salesforceService.submitSalesforceRecord(finalData);

    if (result.success) {
      // Update note status to Synced in log history
      if (activeReviewNote) {
        await offlineManager.updateNote(activeReviewNote.id, {
          extractedData: finalData,
          syncStatus: 'synced',
        });
      }

      // Close modal screen
      setShowReviewScreen(false);
      setReviewData(null);
      setActiveReviewNote(null);

      // Trigger success slide/banner
      setSyncedAccountName(finalData.accountName);
      setShowSyncSuccess(true);
      
      // Auto close success alert after 3.5 seconds
      setTimeout(() => {
        setShowSyncSuccess(false);
        setActiveTab('history');
      }, 3500);
    } else {
      Alert.alert('Salesforce Sync Refused', result.error || 'Check validation guidelines.');
    }
  };

  const handleDiscardReview = async () => {
    if (activeReviewNote) {
      await offlineManager.updateNote(activeReviewNote.id, {
        syncStatus: 'failed',
        errorMessage: 'User discarded review card before CRM sync.',
      });
    }
    setShowReviewScreen(false);
    setReviewData(null);
    setActiveReviewNote(null);
    setActiveTab('history');
  };

  const handleManualSyncTrigger = async () => {
    await offlineManager.checkAndSyncQueue(true);
  };

  const handleDeleteNote = async (id: string) => {
    await offlineManager.removeNote(id);
  };

  const handleReviewFromHistory = (note: OfflineNote) => {
    if (note.extractedData) {
      setActiveReviewNote(note);
      setReviewData(note.extractedData);
      setShowReviewScreen(true);
    } else {
      Alert.alert(
        'Note Processing',
        'This note is not processed yet. Wait for sync to complete or tap Retry Sync.'
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      
      <View style={styles.appHeader}>
        <View style={styles.brandContainer}>
          <View style={styles.brandIconContainer}>
            <FileAudio size={20} color="#FFFFFF" />
          </View>
          <Text style={styles.brandText}>FieldVoice</Text>
        </View>
        <Text style={styles.brandTag}>CRM Voice-Sync</Text>
      </View>

      <View style={styles.bannerSpacing}>
        <SyncStatusBanner
          isOnline={isOnline}
          pendingCount={offlineQueue.filter(n => n.syncStatus === 'pending' || n.syncStatus === 'failed').length}
          onManualSyncTrigger={handleManualSyncTrigger}
        />
      </View>

      {showSyncSuccess && (
        <View style={styles.successNotification}>
          <CheckCircle2 size={22} color={theme.colors.success} style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.successTitle}>Salesforce Record Synced</Text>
            <Text style={styles.successMessage}>Successfully synced meeting records for: {syncedAccountName}</Text>
          </View>
        </View>
      )}

      {showReviewScreen && reviewData ? (
        <View style={styles.tabContent}>
          <ReviewCard
            initialData={reviewData}
            onSave={handleSyncSubmit}
            onCancel={handleDiscardReview}
          />
        </View>
      ) : (
        <View style={styles.tabContent}>
          {activeTab === 'record' && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <View style={styles.infoBox}>
                <Text style={styles.infoTitle}>Voice-to-CRM Auto Extraction</Text>
                <Text style={styles.infoText}>
                  Describe the customer visit details. The AI will automatically extract account, contact, products, amounts, and tasks to sync directly to Salesforce.
                </Text>
              </View>

              <VoiceRecorder
                activeProfile={activeProfile}
                onTranscriptionComplete={handleTranscriptionComplete}
                isOnline={isOnline}
              />
            </ScrollView>
          )}

          {activeTab === 'history' && (
            <HistoryQueue
              notes={offlineQueue}
              onReviewNote={handleReviewFromHistory}
              onDeleteNote={handleDeleteNote}
              onRetrySync={handleManualSyncTrigger}
            />
          )}

          {activeTab === 'settings' && (
            <RepProfileSelector
              activeProfile={activeProfile}
              onProfileChange={handleProfileChange}
              onProfileUpdate={handleProfileUpdate}
              isSimulatedOffline={simulatedOffline}
              onToggleSimulatedOffline={handleToggleSimulatedOffline}
            />
          )}

          {activeTab === 'explorer' && (
            <CrmExplorer />
          )}
        </View>
      )}

      {!showReviewScreen && (
        <View style={styles.navigationBar}>
          <TouchableOpacity
            style={[styles.navItem, activeTab === 'record' && styles.navItemActive]}
            onPress={() => setActiveTab('record')}
            activeOpacity={0.8}
          >
            <Mic size={20} color={activeTab === 'record' ? '#FFFFFF' : theme.colors.textMuted} />
            <Text style={[styles.navText, activeTab === 'record' && styles.navTextActive]}>Record Visit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, activeTab === 'history' && styles.navItemActive]}
            onPress={() => setActiveTab('history')}
            activeOpacity={0.8}
          >
            <View style={styles.historyBadgeRow}>
              <History size={20} color={activeTab === 'history' ? '#FFFFFF' : theme.colors.textMuted} />
              {offlineQueue.filter(n => n.syncStatus === 'pending').length > 0 && (
                <View style={styles.historyDot} />
              )}
            </View>
            <Text style={[styles.navText, activeTab === 'history' && styles.navTextActive]}>Sync Queue</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, activeTab === 'explorer' && styles.navItemActive]}
            onPress={() => setActiveTab('explorer')}
            activeOpacity={0.8}
          >
            <Database size={20} color={activeTab === 'explorer' ? '#FFFFFF' : theme.colors.textMuted} />
            <Text style={[styles.navText, activeTab === 'explorer' && styles.navTextActive]}>CRM Explorer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, activeTab === 'settings' && styles.navItemActive]}
            onPress={() => setActiveTab('settings')}
            activeOpacity={0.8}
          >
            <Settings size={20} color={activeTab === 'settings' ? '#FFFFFF' : theme.colors.textMuted} />
            <Text style={[styles.navText, activeTab === 'settings' && styles.navTextActive]}>Rep Config</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 2-Stage Glassmorphic Processing Loading Overlay */}
      <Modal
        transparent={true}
        visible={processingState !== 'idle'}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingHeader}>Processing Visit Notes</Text>
            <Text style={styles.loadingSubtitle}>Converting speech and mapping CRM fields</Text>

            {/* Step 1: Transcription Process */}
            <View style={[
              styles.stepRow,
              processingState === 'transcribing' && styles.stepRowActive,
              processingState === 'extracting' && styles.stepRowCompleted
            ]}>
              <View style={[
                styles.stepIconContainer,
                processingState === 'transcribing' && styles.stepIconActive,
                processingState === 'extracting' && styles.stepIconCompleted
              ]}>
                <FileText size={20} color={
                  processingState === 'extracting' ? '#10B981' : 
                  processingState === 'transcribing' ? theme.colors.primaryLight : '#475569'
                } />
              </View>
              <View style={styles.stepContent}>
                <Text style={[
                  styles.stepTitle,
                  processingState === 'transcribing' && styles.stepTitleActive,
                  processingState === 'extracting' && styles.stepTitleCompleted
                ]}>Step 1: Audio Transcription</Text>
                <Text style={styles.stepDescription}>
                  {processingState === 'transcribing'
                    ? 'Converting audio files via Azure Cognitive STT...'
                    : processingState === 'extracting'
                    ? 'Audio transcription successfully completed.'
                    : 'Awaiting recording completion...'}
                </Text>
              </View>
              <View style={styles.stepStatus}>
                {processingState === 'transcribing' ? (
                  <ActivityIndicator size="small" color={theme.colors.primaryLight} />
                ) : processingState === 'extracting' ? (
                  <Check size={18} color="#10B981" />
                ) : null}
              </View>
            </View>

            {/* Divider */}
            <View style={styles.stepDivider} />

            {/* Step 2: AI Mapping the CRM Fields */}
            <View style={[
              styles.stepRow,
              processingState === 'extracting' && styles.stepRowActive
            ]}>
              <View style={[
                styles.stepIconContainer,
                processingState === 'extracting' && styles.stepIconActive
              ]}>
                <Brain size={20} color={
                  processingState === 'extracting' ? theme.colors.accent : '#475569'
                } />
              </View>
              <View style={styles.stepContent}>
                <Text style={[
                  styles.stepTitle,
                  processingState === 'extracting' && styles.stepTitleActive
                ]}>Step 2: AI Salesforce Mapping</Text>
                <Text style={styles.stepDescription}>
                  {processingState === 'extracting'
                    ? 'Extracting structured details via Google Gemini...'
                    : 'Awaiting audio transcription...'}
                </Text>
              </View>
              <View style={styles.stepStatus}>
                {processingState === 'extracting' ? (
                  <ActivityIndicator size="small" color={theme.colors.accent} />
                ) : null}
              </View>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  appHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: '#070A11',
    borderBottomWidth: 1,
    borderBottomColor: '#121927',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandIconContainer: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.sm,
    padding: 6,
    marginRight: 8,
  },
  brandText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  brandTag: {
    color: theme.colors.accent,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: theme.borderRadius.sm,
  },
  bannerSpacing: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },
  successNotification: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  successTitle: {
    color: theme.colors.success,
    fontSize: 14,
    fontWeight: '700',
  },
  successMessage: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },
  navigationBar: {
    flexDirection: 'row',
    height: 60,
    backgroundColor: '#070A11',
    borderTopWidth: 1,
    borderTopColor: '#121927',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    flex: 1,
  },
  navItemActive: {
    opacity: 1,
  },
  navText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
  navTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  historyBadgeRow: {
    position: 'relative',
  },
  historyDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.warning,
  },
  infoBox: {
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  infoTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  infoText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 16, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  loadingContainer: {
    backgroundColor: '#0B1120',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  loadingHeader: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  loadingSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: theme.spacing.lg,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    opacity: 0.5,
  },
  stepRowActive: {
    opacity: 1,
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(168, 85, 247, 0.05)',
  },
  stepRowCompleted: {
    opacity: 0.9,
    borderColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  stepIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  stepIconActive: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
  },
  stepIconCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
  stepTitleActive: {
    color: '#FFFFFF',
  },
  stepTitleCompleted: {
    color: '#10B981',
  },
  stepDescription: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginTop: 2,
    lineHeight: 14,
  },
  stepStatus: {
    width: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDivider: {
    height: 20,
    width: 2,
    backgroundColor: '#1E293B',
    marginLeft: 35,
  },
});
