import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Switch } from 'react-native';
import {
  User as LucideUser,
  Shield as LucideShield,
  WifiOff as LucideWifiOff,
  Key as LucideKey,
  Plus as LucidePlus,
  Trash2 as LucideTrash2,
  CheckCircle2 as LucideCheckCircle2
} from 'lucide-react-native';
import theme from '../theme';
import { RepProfile, ApiCredentials } from '../types';
import { mockProfiles } from '../services/mockData';
import { offlineManager } from '../services/offlineManager';
import { salesforceService } from '../services/salesforceService';

// Cast icons to bypass React 19 Lucide types check conflict
const User = LucideUser as any;
const Shield = LucideShield as any;
const WifiOff = LucideWifiOff as any;
const Key = LucideKey as any;
const Plus = LucidePlus as any;
const Trash2 = LucideTrash2 as any;
const CheckCircle2 = LucideCheckCircle2 as any;

interface RepProfileSelectorProps {
  activeProfile: RepProfile;
  onProfileChange: (profile: RepProfile) => void;
  onProfileUpdate: (updatedProfile: RepProfile) => void;
  isSimulatedOffline: boolean;
  onToggleSimulatedOffline: (val: boolean) => void;
}

export const RepProfileSelector: React.FC<RepProfileSelectorProps> = ({
  activeProfile,
  onProfileChange,
  onProfileUpdate,
  isSimulatedOffline,
  onToggleSimulatedOffline,
}) => {
  const [profiles, setProfiles] = useState<RepProfile[]>(mockProfiles);
  const [newVocab, setNewVocab] = useState('');
  
  // Credentials panel
  const [keys, setKeys] = useState<ApiCredentials>({ openrouter: '', openrouterModel: '' });
  const [sfConfig, setSfConfig] = useState({ instanceUrl: '', accessToken: '', isLive: false });
  const [credentialsSaved, setCredentialsSaved] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      const activeKeys = await offlineManager.getKeys();
      setKeys(activeKeys);

      const sfActiveConfig = await salesforceService.getConfig();
      setSfConfig(sfActiveConfig);
    };
    loadConfig();
  }, []);

  const handleSaveCredentials = async () => {
    await offlineManager.saveKeys(keys);
    await salesforceService.saveConfig(sfConfig);
    setCredentialsSaved(true);
    setTimeout(() => {
      setCredentialsSaved(false);
    }, 2500);
  };

  const handleAddVocab = () => {
    const term = newVocab.trim();
    if (term && !activeProfile.customVocabulary.includes(term)) {
      const updatedProfile: RepProfile = {
        ...activeProfile,
        customVocabulary: [...activeProfile.customVocabulary, term],
      };
      onProfileUpdate(updatedProfile);
      setNewVocab('');
    }
  };

  const handleRemoveVocab = (term: string) => {
    const updatedProfile: RepProfile = {
      ...activeProfile,
      customVocabulary: activeProfile.customVocabulary.filter((v) => v !== term),
    };
    onProfileUpdate(updatedProfile);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* 1. PROFILE SELECTION */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <User size={16} color={theme.colors.primaryLight} style={styles.sectionIcon} />
          <Text style={styles.sectionTitle}>Select Active Rep Profile</Text>
        </View>

        <View style={styles.profilesContainer}>
          {profiles.map((p) => {
            const isActive = p.id === activeProfile.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.profileCard, isActive && styles.profileCardActive]}
                onPress={() => onProfileChange(p)}
                activeOpacity={0.8}
              >
                <Text style={[styles.profileName, isActive && styles.profileNameActive]}>{p.name}</Text>
                <Text style={styles.profileTitle}>{p.title}</Text>
                <Text style={styles.profileTerritory}>Territory: {p.territory}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 2. LIVE INTEGRATIONS & CREDENTIALS */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Shield size={16} color={theme.colors.primaryLight} style={styles.sectionIcon} />
          <Text style={styles.sectionTitle}>Live Salesforce & AI Credentials</Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>OpenRouter API Key (Optional)</Text>
          <TextInput
            style={styles.input}
            value={keys.openrouter}
            onChangeText={(val) => setKeys((prev) => ({ ...prev, openrouter: val }))}
            placeholder="sk-or-..."
            placeholderTextColor="#64748B"
            secureTextEntry={true}
          />
          <Text style={styles.hint}>If empty, the app uses simulated fallback transcription extraction.</Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>OpenRouter Model Choice</Text>
          <TextInput
            style={styles.input}
            value={keys.openrouterModel}
            onChangeText={(val) => setKeys((prev) => ({ ...prev, openrouterModel: val }))}
            placeholder="openai/gpt-oss-120b"
            placeholderTextColor="#64748B"
          />
        </View>

        <View style={styles.formGroup}>
          <View style={styles.offlineToggleRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Enable Live Salesforce Sync</Text>
              <Text style={styles.hint}>If disabled, CRM writes and queries are simulated locally.</Text>
            </View>
            <Switch
              value={sfConfig.isLive}
              onValueChange={(val) => setSfConfig((prev) => ({ ...prev, isLive: val }))}
              trackColor={{ false: '#1E293B', true: theme.colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {sfConfig.isLive && (
          <>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Salesforce Instance URL</Text>
              <TextInput
                style={styles.input}
                value={sfConfig.instanceUrl}
                onChangeText={(val) => setSfConfig((prev) => ({ ...prev, instanceUrl: val }))}
                placeholder="https://yourdomain.my.salesforce.com"
                placeholderTextColor="#64748B"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Salesforce Access Token</Text>
              <TextInput
                style={styles.input}
                value={sfConfig.accessToken}
                onChangeText={(val) => setSfConfig((prev) => ({ ...prev, accessToken: val }))}
                placeholder="OAuth Access Token or Session ID"
                placeholderTextColor="#64748B"
                secureTextEntry={true}
              />
            </View>
          </>
        )}

        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveCredentials}>
          {credentialsSaved ? (
            <>
              <CheckCircle2 size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.saveBtnText}>API Credentials Saved!</Text>
            </>
          ) : (
            <>
              <Key size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.saveBtnText}>Save API Credentials</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* 3. SIMULATE OFFLINE CONNECTIVITY */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <WifiOff size={16} color={theme.colors.primaryLight} style={styles.sectionIcon} />
          <Text style={styles.sectionTitle}>Simulate Offline Connectivity</Text>
        </View>

        <View style={styles.offlineToggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>Force Simulated Offline Mode</Text>
            <Text style={styles.toggleDesc}>Disconnects Salesforce API. Voice notes are saved to device queue.</Text>
          </View>
          <Switch
            value={isSimulatedOffline}
            onValueChange={onToggleSimulatedOffline}
            trackColor={{ false: '#1E293B', true: theme.colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      {/* 4. CUSTOM SPOKEN VOCABULARY */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <User size={16} color={theme.colors.primaryLight} style={styles.sectionIcon} />
          <Text style={styles.sectionTitle}>Spoken Vocabulary Spelling Bias</Text>
        </View>
        <Text style={styles.descText}>
          Add industry products, slang, or competitor names. This vocabulary is fed to Whisper and LLM prompts.
        </Text>

        <View style={styles.vocabInputRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            value={newVocab}
            onChangeText={setNewVocab}
            placeholder="Add product or spelling term"
            placeholderTextColor="#64748B"
          />
          <TouchableOpacity style={styles.addBtn} onPress={handleAddVocab}>
            <Plus size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.vocabChipsContainer}>
          {activeProfile.customVocabulary.map((vocab) => (
            <View key={vocab} style={styles.vocabChip}>
              <Text style={styles.vocabChipText}>{vocab}</Text>
              <TouchableOpacity onPress={() => handleRemoveVocab(vocab)}>
                <Trash2 size={12} color={theme.colors.dangerLight} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  section: {
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    paddingBottom: 8,
  },
  sectionIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  profilesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  profileCard: {
    flex: 1,
    backgroundColor: '#0F1626',
    borderWidth: 1,
    borderColor: '#1D283E',
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
    marginHorizontal: 4,
  },
  profileCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(168, 85, 247, 0.05)',
  },
  profileName: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  profileNameActive: {
    color: theme.colors.primaryLight,
  },
  profileTitle: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  profileTerritory: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
  },
  formGroup: {
    marginBottom: theme.spacing.sm,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#0F1522',
    borderWidth: 1,
    borderColor: '#1D283E',
    borderRadius: theme.borderRadius.sm,
    color: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  hint: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  saveBtn: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm,
    marginTop: theme.spacing.sm,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  offlineToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  toggleDesc: {
    color: theme.colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },
  descText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginBottom: theme.spacing.sm,
  },
  vocabInputRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.sm,
  },
  addBtn: {
    backgroundColor: theme.colors.primary,
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  vocabChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  vocabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: theme.borderRadius.sm,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: 6,
    marginBottom: 6,
  },
  vocabChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '500',
  },
});

export default RepProfileSelector;
