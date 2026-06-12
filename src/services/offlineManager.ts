import AsyncStorage from '@react-native-async-storage/async-storage';
import { OfflineNote, ApiCredentials } from '../types';
import { llmService } from './llmService';
import { mockProfiles } from './mockData';

type QueueListener = (queue: OfflineNote[]) => void;
type ConnectionListener = (isOnline: boolean) => void;

class OfflineManager {
  private queue: OfflineNote[] = [];
  private simulateOffline = false;
  private queueListeners: QueueListener[] = [];
  private connectionListeners: ConnectionListener[] = [];
  private autoSyncInterval: NodeJS.Timeout | null = null;

  async init(onQueueUpdate: QueueListener, onConnectionChange: ConnectionListener) {
    this.queueListeners.push(onQueueUpdate);
    this.connectionListeners.push(onConnectionChange);

    // Load queue from cache
    const cachedQueue = await AsyncStorage.getItem('fv_offline_queue');
    if (cachedQueue) {
      this.queue = JSON.parse(cachedQueue);
    }

    // Load simulated connectivity state
    const simOffline = await AsyncStorage.getItem('fv_simulate_offline');
    this.simulateOffline = simOffline === 'true';

    // Broadcast initial state
    onQueueUpdate(this.queue);
    onConnectionChange(!this.simulateOffline);

    // Start auto sync background task (FR-4.4, FR-4.5)
    this.startBackgroundSync();
  }

  // Gets queue
  async getQueue(): Promise<OfflineNote[]> {
    const cached = await AsyncStorage.getItem('fv_offline_queue');
    if (cached) {
      this.queue = JSON.parse(cached);
    }
    return this.queue;
  }

  // Saves queue
  private async saveQueue() {
    await AsyncStorage.setItem('fv_offline_queue', JSON.stringify(this.queue));
    this.queueListeners.forEach((listener) => listener([...this.queue]));
  }

  // Add a new note to queue
  async addToQueue(note: Omit<OfflineNote, 'syncStatus'>): Promise<OfflineNote> {
    const newNote: OfflineNote = {
      ...note,
      syncStatus: 'pending',
    };
    this.queue.unshift(newNote);
    await this.saveQueue();

    // Trigger immediate check if online
    if (!this.simulateOffline) {
      this.checkAndSyncQueue();
    }

    return newNote;
  }

  // Add a pre-processed/synced note directly to the queue
  async addSyncedNote(note: OfflineNote): Promise<OfflineNote> {
    this.queue.unshift(note);
    await this.saveQueue();
    return note;
  }

  // Update a note in the queue
  async updateNote(id: string, updates: Partial<OfflineNote>) {
    const index = this.queue.findIndex((n) => n.id === id);
    if (index !== -1) {
      this.queue[index] = {
        ...this.queue[index],
        ...updates,
      };
      await this.saveQueue();
    }
  }

  // Remove note from queue
  async removeNote(id: string) {
    this.queue = this.queue.filter((n) => n.id !== id);
    await this.saveQueue();
  }

  // Save API Credentials
  async saveKeys(keys: ApiCredentials) {
    await AsyncStorage.setItem('fv_keys_gemini_key', keys.geminiKey || '');
    await AsyncStorage.setItem('fv_keys_azure_speech_key', keys.azureSpeechKey || '');
    await AsyncStorage.setItem('fv_keys_azure_speech_region', keys.azureSpeechRegion || '');
    await AsyncStorage.setItem('fv_keys_azure_speech_endpoint', keys.azureSpeechEndpoint || '');
  }

  // Get API Credentials
  async getKeys(): Promise<ApiCredentials> {
    const geminiKey = (await AsyncStorage.getItem('fv_keys_gemini_key')) || '';
    const azureSpeechKey = (await AsyncStorage.getItem('fv_keys_azure_speech_key')) || '';
    const azureSpeechRegion = (await AsyncStorage.getItem('fv_keys_azure_speech_region')) || 'eastus';
    const azureSpeechEndpoint = (await AsyncStorage.getItem('fv_keys_azure_speech_endpoint')) || '';
    return { 
      geminiKey,
      azureSpeechKey,
      azureSpeechRegion,
      azureSpeechEndpoint
    };
  }

  // Get simulate offline status
  async getSimulateOffline(): Promise<boolean> {
    return this.simulateOffline;
  }

  // Toggle simulate offline
  async setSimulateOffline(val: boolean) {
    this.simulateOffline = val;
    await AsyncStorage.setItem('fv_simulate_offline', String(val));
    this.connectionListeners.forEach((listener) => listener(!val));

    if (!val) {
      // Trigger background sync on reconnection (FR-4.4)
      this.checkAndSyncQueue();
    }
  }

  // Run background sync on pending items (FR-4.4, FR-4.5)
  async checkAndSyncQueue(forceAll: boolean = false) {
    if (this.simulateOffline) return;

    const pendingNotes = this.queue.filter((n) => 
      n.syncStatus === 'pending' || (forceAll && n.syncStatus === 'failed')
    );
    if (pendingNotes.length === 0) return;

    const keys = await this.getKeys();
    const profilesStr = await AsyncStorage.getItem('fv_rep_profiles');
    const profiles = profilesStr ? JSON.parse(profilesStr) : mockProfiles;

    for (const note of pendingNotes) {
      // Mark note as syncing
      await this.updateNote(note.id, { syncStatus: 'syncing' });

      try {
        const profile = profiles.find((p: any) => p.id === note.repProfileId) || mockProfiles[0];
        
        let extractedData;
        if (keys.geminiKey) {
          // Live extraction via Gemini
          extractedData = await llmService.queryGemini(
            note.transcript,
            profile,
            keys.geminiKey
          );
        } else {
          // Fallback to simulated extraction
          extractedData = llmService.simulateExtraction(note.transcript, profile);
        }

        // Keep as pending submit (FR-4.5: processed results are queued for rep review, not auto-submitted)
        await this.updateNote(note.id, {
          syncStatus: 'synced',
          extractedData: extractedData,
        });

      } catch (error: any) {
        console.error(`Failed to sync note ${note.id}:`, error);
        await this.updateNote(note.id, {
          syncStatus: 'failed',
          errorMessage: error.message || 'AI extraction request failed.',
        });
      }
    }
  }

  private startBackgroundSync() {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
    }
    // Poll every 10 seconds to process queues if online
    this.autoSyncInterval = setInterval(() => {
      this.checkAndSyncQueue();
    }, 10000);
  }
}

export const offlineManager = new OfflineManager();
export default offlineManager;
