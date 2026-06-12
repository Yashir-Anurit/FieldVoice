import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Switch } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  
  // Edit active profile states
  const [editName, setEditName] = useState(activeProfile.name);
  const [editTitle, setEditTitle] = useState(activeProfile.title);
  const [editTerritory, setEditTerritory] = useState(activeProfile.territory);

  // Add new profile states
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newTerritory, setNewTerritory] = useState('');

  // Shortname mapping states
  const [newShort, setNewShort] = useState('');
  const [newFull, setNewFull] = useState('');

  // Credentials panel
  const [keys, setKeys] = useState<ApiCredentials>({ geminiKey: '' });
  const [sfConfig, setSfConfig] = useState({ instanceUrl: '', accessToken: '', isLive: false });
  const [credentialsSaved, setCredentialsSaved] = useState(false);

  // Sync edit states when active profile changes
  useEffect(() => {
    setEditName(activeProfile.name);
    setEditTitle(activeProfile.title);
    setEditTerritory(activeProfile.territory);
  }, [activeProfile]);

  useEffect(() => {
    const loadConfig = async () => {
      const activeKeys = await offlineManager.getKeys();
      setKeys(activeKeys);

      const sfActiveConfig = await salesforceService.getConfig();
      setSfConfig(sfActiveConfig);

      const storedProfiles = await AsyncStorage.getItem('fv_rep_profiles');
      if (storedProfiles) {
        setProfiles(JSON.parse(storedProfiles));
      }
    };
    loadConfig();
  }, [activeProfile]);

  const handleSaveProfileDetails = () => {
    if (!editName.trim() || !editTerritory.trim()) {
      alert('Name and Territory are required fields.');
      return;
    }
    const updatedProfile: RepProfile = {
      ...activeProfile,
      name: editName.trim(),
      title: editTitle.trim(),
      territory: editTerritory.trim(),
    };
    onProfileUpdate(updatedProfile);
    alert('Representative Profile Details updated successfully!');
  };

  const handleAddProfile = async () => {
    if (!newName.trim() || !newTerritory.trim()) {
      alert('Name and Territory are required fields for creating a new profile.');
      return;
    }

    const newProfile: RepProfile = {
      id: `rep-${Date.now()}`,
      name: newName.trim(),
      title: newTitle.trim(),
      territory: newTerritory.trim(),
      customVocabulary: [],
      contactShortnames: [],
    };

    const storedProfiles = await AsyncStorage.getItem('fv_rep_profiles');
    let currentProfiles: RepProfile[] = storedProfiles ? JSON.parse(storedProfiles) : mockProfiles;
    
    currentProfiles.push(newProfile);
    await AsyncStorage.setItem('fv_rep_profiles', JSON.stringify(currentProfiles));
    setProfiles(currentProfiles);
    onProfileChange(newProfile);

    setNewName('');
    setNewTitle('');
    setNewTerritory('');
    setShowAddProfile(false);

    alert(`Profile for ${newProfile.name} created and set as active.`);
  };

  const handleAddShortname = () => {
    const short = newShort.trim();
    const full = newFull.trim();
    if (!short || !full) {
      alert('Both spoken shortname and full Salesforce name are required.');
      return;
    }

    const shortnames = activeProfile.contactShortnames || [];
    const exists = shortnames.some((c) => c.short.toLowerCase() === short.toLowerCase());
    if (exists) {
      alert(`Short name "${short}" is already mapped.`);
      return;
    }

    const updatedProfile: RepProfile = {
      ...activeProfile,
      contactShortnames: [...shortnames, { short, full }],
    };
    onProfileUpdate(updatedProfile);
    setNewShort('');
    setNewFull('');
  };

  const handleRemoveShortname = (shortToRemove: string) => {
    const shortnames = activeProfile.contactShortnames || [];
    const updatedProfile: RepProfile = {
      ...activeProfile,
      contactShortnames: shortnames.filter((c) => c.short !== shortToRemove),
    };
    onProfileUpdate(updatedProfile);
  };

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

        {/* Add New Profile Expander */}
        <TouchableOpacity 
          style={styles.addProfileToggleBtn} 
          onPress={() => setShowAddProfile(!showAddProfile)}
        >
          <Text style={styles.addProfileToggleText}>
            {showAddProfile ? '- Cancel New Profile' : '+ Create New Representative Profile'}
          </Text>
        </TouchableOpacity>

        {showAddProfile && (
          <View style={styles.addProfileForm}>
            <TextInput
              style={styles.formInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Representative Full Name"
              placeholderTextColor="#64748B"
            />
            <TextInput
              style={styles.formInput}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Job Title (e.g. Sales Executive)"
              placeholderTextColor="#64748B"
            />
            <TextInput
              style={styles.formInput}
              value={newTerritory}
              onChangeText={setNewTerritory}
              placeholder="Active Territory (e.g. Mid-West)"
              placeholderTextColor="#64748B"
            />
            <TouchableOpacity style={styles.createBtn} onPress={handleAddProfile}>
              <Text style={styles.createBtnText}>Create & Set Active</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 1B. EDIT ACTIVE PROFILE */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <User size={16} color={theme.colors.primaryLight} style={styles.sectionIcon} />
          <Text style={styles.sectionTitle}>Edit Active Profile Details</Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Rep Name</Text>
          <TextInput
            style={styles.input}
            value={editName}
            onChangeText={setEditName}
            placeholder="Name"
            placeholderTextColor="#64748B"
          />
        </View>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Job Title</Text>
          <TextInput
            style={styles.input}
            value={editTitle}
            onChangeText={setEditTitle}
            placeholder="Title"
            placeholderTextColor="#64748B"
          />
        </View>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Active Territory</Text>
          <TextInput
            style={styles.input}
            value={editTerritory}
            onChangeText={setEditTerritory}
            placeholder="Territory"
            placeholderTextColor="#64748B"
          />
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfileDetails}>
          <Text style={styles.saveBtnText}>Save Profile Info</Text>
        </TouchableOpacity>
      </View>

      {/* 2. LIVE INTEGRATIONS & CREDENTIALS */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Shield size={16} color={theme.colors.primaryLight} style={styles.sectionIcon} />
          <Text style={styles.sectionTitle}>Live Salesforce & AI Credentials</Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Google Gemini API Key (Optional)</Text>
          <TextInput
            style={styles.input}
            value={keys.geminiKey || ''}
            onChangeText={(val) => setKeys((prev) => ({ ...prev, geminiKey: val }))}
            placeholder="AIzaSy..."
            placeholderTextColor="#64748B"
            secureTextEntry={true}
          />
          <Text style={styles.hint}>If empty, the app uses simulated fallback transcription extraction.</Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Azure Speech API Key (Optional)</Text>
          <TextInput
            style={styles.input}
            value={keys.azureSpeechKey || ''}
            onChangeText={(val) => setKeys((prev) => ({ ...prev, azureSpeechKey: val }))}
            placeholder="Azure API Subscription Key"
            placeholderTextColor="#64748B"
            secureTextEntry={true}
          />
          <Text style={styles.hint}>Used to run custom Azure speech-to-text transcription on audio files.</Text>
        </View>

        {(keys.azureSpeechKey || '').trim() !== '' && (
          <>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Azure Speech Region</Text>
              <TextInput
                style={styles.input}
                value={keys.azureSpeechRegion || ''}
                onChangeText={(val) => setKeys((prev) => ({ ...prev, azureSpeechRegion: val }))}
                placeholder="eastus"
                placeholderTextColor="#64748B"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Azure Custom Endpoint URL (Optional)</Text>
              <TextInput
                style={styles.input}
                value={keys.azureSpeechEndpoint || ''}
                onChangeText={(val) => setKeys((prev) => ({ ...prev, azureSpeechEndpoint: val }))}
                placeholder="https://resource.openai.azure.com/..."
                placeholderTextColor="#64748B"
              />
              <Text style={styles.hint}>Used for custom Whisper deployments on Azure. If empty, uses standard Cognitive Speech API.</Text>
            </View>
          </>
        )}

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

      {/* 5. CONTACT SHORTNAME MAPPING */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <User size={16} color={theme.colors.primaryLight} style={styles.sectionIcon} />
          <Text style={styles.sectionTitle}>Contact Name Abbreviation Mapping</Text>
        </View>
        <Text style={styles.descText}>
          Map short spoken names to their full Salesforce contact names so that the AI can resolve them accurately (e.g. "Greg" maps to "Gregory Peck").
        </Text>

        <View style={styles.vocabInputRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginRight: 6, marginBottom: 0 }]}
            value={newShort}
            onChangeText={setNewShort}
            placeholder="Spoken (e.g. Greg)"
            placeholderTextColor="#64748B"
          />
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            value={newFull}
            onChangeText={setNewFull}
            placeholder="Full (e.g. Gregory Peck)"
            placeholderTextColor="#64748B"
          />
          <TouchableOpacity style={styles.addBtn} onPress={handleAddShortname}>
            <Plus size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.mappingsContainer}>
          {(activeProfile.contactShortnames || []).map((mapping, idx) => (
            <View key={idx} style={styles.mappingItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.mappingItemText}>
                  "{mapping.short}" <Text style={{ color: theme.colors.accent }}>➔</Text> "{mapping.full}"
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleRemoveShortname(mapping.short)}>
                <Trash2 size={12} color={theme.colors.dangerLight} />
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
  addProfileToggleBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F1522',
    borderWidth: 1,
    borderColor: '#1D283E',
    borderRadius: theme.borderRadius.sm,
    marginTop: theme.spacing.md,
  },
  addProfileToggleText: {
    color: theme.colors.primaryLight,
    fontSize: 12,
    fontWeight: '700',
  },
  addProfileForm: {
    marginTop: theme.spacing.md,
    backgroundColor: '#0F1522',
    borderWidth: 1,
    borderColor: '#1D283E',
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
  },
  formInput: {
    backgroundColor: '#070A11',
    borderWidth: 1,
    borderColor: '#182235',
    borderRadius: theme.borderRadius.sm,
    color: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    marginBottom: theme.spacing.sm,
  },
  createBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  mappingsContainer: {
    marginTop: theme.spacing.sm,
  },
  mappingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F1626',
    borderWidth: 1,
    borderColor: '#1D283E',
    borderRadius: theme.borderRadius.sm,
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.md,
    marginBottom: 6,
  },
  mappingItemText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default RepProfileSelector;
