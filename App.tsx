import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, SafeAreaView, TouchableOpacity, ScrollView, Alert, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Mic as LucideMic,
  History as LucideHistory,
  Settings as LucideSettings,
  FileAudio as LucideFileAudio,
  CheckCircle2 as LucideCheckCircle2
} from 'lucide-react-native';

import theme from './src/theme';
import { RepProfile, OfflineNote, ExtractedData } from './src/types';

import { mockProfiles } from './src/services/mockData';
import { salesforceService } from './src/services/salesforceService';
import { offlineManager } from './src/services/offlineManager';

import VoiceRecorder from './src/components/VoiceRecorder';
import ReviewCard from './src/components/ReviewCard';
import SyncStatusBanner from './src/components/SyncStatusBanner';
import RepProfileSelector from './src/components/RepProfileSelector';
import HistoryQueue from './src/components/HistoryQueue';

// Cast icons to bypass React 19 Lucide types check conflict
const Mic = LucideMic as any;
const History = LucideHistory as any;
const Settings = LucideSettings as any;
const FileAudio = LucideFileAudio as any;
const CheckCircle2 = LucideCheckCircle2 as any;

export default function App() {
  const [activeTab, setActiveTab] = useState<'record' | 'history' | 'settings'>('record');
  const [activeProfile, setActiveProfile] = useState<RepProfile>(mockProfiles[0]);
  
  const [isOnline, setIsOnline] = useState(true);
  const [simulatedOffline, setSimulatedOffline] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState<OfflineNote[]>([]);
  
  const [activeReviewNote, setActiveReviewNote] = useState<OfflineNote | null>(null);
  const [showReviewScreen, setShowReviewScreen] = useState(false);
  const [reviewData, setReviewData] = useState<ExtractedData | null>(null);

  const [showSyncSuccess, setShowSyncSuccess] = useState(false);
  const [syncedAccountName, setSyncedAccountName] = useState('');

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

  const handleTranscriptionComplete = async (transcript: string, durationSec: number) => {
    const newNoteId = `note-${Date.now()}`;
    
    const noteData: Omit<OfflineNote, 'syncStatus'> = {
      id: newNoteId,
      timestamp: new Date().toISOString(),
      duration: durationSec,
      transcript,
      extractedData: null,
      repProfileId: activeProfile.id,
    };

    // If Offline: Save to queue and keep as pending review once sync completes
    if (!isOnline) {
      await offlineManager.addToQueue(noteData);
      Alert.alert(
        'Note Queued Offline',
        'Your recording is stored securely on the device. It will automatically transcribe and process when connection is restored.',
        [{ text: 'OK', onPress: () => setActiveTab('history') }]
      );
      return;
    }

    // If Online: Add to queue, process sync immediately, and open Review Card modal
    const addedNote = await offlineManager.addToQueue(noteData);
    
    // Poll for the background extraction sync status to complete
    let attempts = 0;
    const maxAttempts = 20; // 10 seconds max
    
    const checkStatus = setInterval(async () => {
      attempts++;
      const refreshedQueue = await offlineManager.getQueue();
      const currentNote = refreshedQueue.find((n) => n.id === addedNote.id);
      
      if (currentNote) {
        if (currentNote.syncStatus === 'synced' && currentNote.extractedData) {
          clearInterval(checkStatus);
          setActiveReviewNote(currentNote);
          setReviewData(currentNote.extractedData);
          setShowReviewScreen(true);
        } else if (currentNote.syncStatus === 'failed') {
          clearInterval(checkStatus);
          Alert.alert(
            'Sync / Extraction Failed',
            currentNote.errorMessage || 'AI extraction failed. You can edit it manually from the Sync Queue.'
          );
          setActiveTab('history');
        }
      }
      
      if (attempts >= maxAttempts) {
        clearInterval(checkStatus);
        Alert.alert(
          'Processing Note',
          'The AI is taking longer than usual. You can find and review this note in the Sync Queue once complete.'
        );
        setActiveTab('history');
      }
    }, 500);
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
    await offlineManager.checkAndSyncQueue();
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
            style={[styles.navItem, activeTab === 'settings' && styles.navItemActive]}
            onPress={() => setActiveTab('settings')}
            activeOpacity={0.8}
          >
            <Settings size={20} color={activeTab === 'settings' ? '#FFFFFF' : theme.colors.textMuted} />
            <Text style={[styles.navText, activeTab === 'settings' && styles.navTextActive]}>Rep Config</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
});
