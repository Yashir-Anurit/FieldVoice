import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Modal, ActivityIndicator } from 'react-native';
import {
  Check as LucideCheck,
  AlertTriangle as LucideAlertTriangle,
  HelpCircle as LucideHelpCircle,
  Save as LucideSave,
  X as LucideX,
  Calendar as LucideCalendar,
  DollarSign as LucideDollarSign,
  Briefcase as LucideBriefcase,
  FileText as LucideFileText
} from 'lucide-react-native';
import theme from '../theme';
import { ExtractedData, Account, Contact } from '../types';
import { mockAccounts, mockContacts } from '../services/mockData';
import { salesforceService } from '../services/salesforceService';

// Cast icons to bypass React 19 Lucide types check conflict
const Check = LucideCheck as any;
const AlertTriangle = LucideAlertTriangle as any;
const HelpCircle = LucideHelpCircle as any;
const Save = LucideSave as any;
const X = LucideX as any;
const Calendar = LucideCalendar as any;
const DollarSign = LucideDollarSign as any;
const Briefcase = LucideBriefcase as any;
const FileText = LucideFileText as any;

interface ReviewCardProps {
  initialData: ExtractedData;
  onSave: (finalData: ExtractedData) => Promise<void>;
  onCancel: () => void;
}

export const ReviewCard: React.FC<ReviewCardProps> = ({
  initialData,
  onSave,
  onCancel,
}) => {
  const [data, setData] = useState<ExtractedData>(initialData);
  const [accountMatches, setAccountMatches] = useState<Account[]>([]);
  const [showDisambiguation, setShowDisambiguation] = useState(false);
  
  const [associatedContacts, setAssociatedContacts] = useState<Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>(initialData.contactNames);
  const [newContactInput, setNewContactInput] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Initial lookup for matches & contacts
  useEffect(() => {
    const fetchContext = async () => {
      if (initialData.accountName) {
        const matches = await salesforceService.findAccountMatches(initialData.accountName);
        setAccountMatches(matches);
        if (matches.length > 1) {
          setShowDisambiguation(true);
        } else if (matches.length === 1) {
          const associated = await salesforceService.getContactsForAccount(matches[0].id);
          setAssociatedContacts(associated);
        }
      }
    };
    fetchContext();
  }, [initialData]);

  // 2. Watch account name change for manual entries
  const handleAccountChange = async (val: string) => {
    setData((prev) => ({ ...prev, accountName: val }));
    if (val.trim().length > 1) {
      const matches = await salesforceService.findAccountMatches(val);
      setAccountMatches(matches);
    } else {
      setAccountMatches([]);
      setAssociatedContacts([]);
    }
  };

  // Select an account from the disambiguation / matching list
  const handleSelectAccount = async (acc: Account) => {
    setData((prev) => ({ ...prev, accountName: acc.name }));
    setAccountMatches([acc]);
    setShowDisambiguation(false);
    
    // Fetch contacts associated with this specific account
    const associated = await salesforceService.getContactsForAccount(acc.id);
    setAssociatedContacts(associated);

    // Auto-select match if we have matching names
    const preselected = associated.map(c => c.name);
    const intersected = selectedContacts.filter(sc => preselected.includes(sc));
    if (intersected.length === 0 && associated.length > 0) {
      // Prompt/Default to first contact
      setSelectedContacts([associated[0].name]);
    }
  };

  // Toggle contact selection
  const handleToggleContact = (name: string) => {
    if (selectedContacts.includes(name)) {
      setSelectedContacts(selectedContacts.filter((c) => c !== name));
    } else {
      setSelectedContacts([...selectedContacts, name]);
    }
  };

  // Add custom contact name
  const handleAddContact = () => {
    if (newContactInput.trim() && !selectedContacts.includes(newContactInput.trim())) {
      setSelectedContacts([...selectedContacts, newContactInput.trim()]);
      setNewContactInput('');
    }
  };

  const handleValidationAndSave = async () => {
    setErrorMsg('');
    
    // Validations (FR-3.6)
    if (!data.accountName.trim()) {
      setErrorMsg('Account Name is a required field.');
      return;
    }
    if (!data.pipelineStage.trim()) {
      setErrorMsg('Pipeline Stage is required.');
      return;
    }
    if (!data.estimatedCloseDate.trim()) {
      setErrorMsg('Estimated Close Date is required.');
      return;
    }

    // Validate close date regex (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(data.estimatedCloseDate)) {
      setErrorMsg('Estimated Close Date must be in YYYY-MM-DD format.');
      return;
    }

    setIsSubmitting(true);
    try {
      const finalData: ExtractedData = {
        ...data,
        contactNames: selectedContacts,
      };
      await onSave(finalData);
    } catch (err: any) {
      setErrorMsg(err.message || 'Submission failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.cardContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Review CRM Visit Details</Text>
      <Text style={styles.subtitle}>Verify and correct AI-extracted fields before syncing with Salesforce.</Text>

      {errorMsg ? (
        <View style={styles.errorBox}>
          <AlertTriangle size={16} color={theme.colors.danger} style={{ marginRight: 8 }} />
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      ) : null}

      {/* Account Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Briefcase size={16} color={theme.colors.primaryLight} style={styles.sectionIcon} />
          <Text style={styles.sectionTitle}>Account Details (Required)</Text>
        </View>

        <TextInput
          style={styles.input}
          value={data.accountName}
          onChangeText={handleAccountChange}
          placeholder="Account Name"
          placeholderTextColor="#64748B"
        />

        {/* Disambiguation warning banner (FR-3.4) */}
        {accountMatches.length > 1 && (
          <View style={styles.warningBox}>
            <AlertTriangle size={16} color={theme.colors.warning} style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.warningTitle}>Multiple Account Matches Found</Text>
              <Text style={styles.warningDesc}>Select the correct account location to resolve ambiguity:</Text>
              
              <View style={styles.matchesList}>
                {accountMatches.map((acc) => (
                  <TouchableOpacity
                    key={acc.id}
                    style={styles.matchItem}
                    onPress={() => handleSelectAccount(acc)}
                  >
                    <Text style={styles.matchItemText}>{acc.name} ({acc.location})</Text>
                    <Check size={12} color={theme.colors.accent} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Contacts Section (FR-3.5) */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <HelpCircle size={16} color={theme.colors.primaryLight} style={styles.sectionIcon} />
          <Text style={styles.sectionTitle}>Contacts Met</Text>
        </View>

        {/* Associated Contacts Chips */}
        {associatedContacts.length > 0 && (
          <View style={styles.conSelection}>
            <Text style={styles.subLabel}>Quick Select Contacts at {data.accountName}:</Text>
            <View style={styles.chipsRow}>
              {associatedContacts.map((c) => {
                const isSelected = selectedContacts.includes(c.name);
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.conChip, isSelected && styles.conChipActive]}
                    onPress={() => handleToggleContact(c.name)}
                  >
                    <Text style={[styles.conChipText, isSelected && styles.conChipTextActive]}>{c.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <View style={styles.contactInputRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            value={newContactInput}
            onChangeText={setNewContactInput}
            placeholder="Add unregistered contact name"
            placeholderTextColor="#64748B"
          />
          <TouchableOpacity style={styles.addBtn} onPress={handleAddContact}>
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* Selected contacts display */}
        {selectedContacts.length > 0 && (
          <View style={styles.chipsRow}>
            {selectedContacts.map((name) => (
              <View key={name} style={styles.selectedChip}>
                <Text style={styles.selectedChipText}>{name}</Text>
                <TouchableOpacity onPress={() => handleToggleContact(name)}>
                  <X size={12} color="#FFFFFF" style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Deal Size & Close Date */}
      <View style={styles.row}>
        <View style={[styles.section, { flex: 1, marginRight: 8 }]}>
          <View style={styles.sectionHeader}>
            <DollarSign size={16} color={theme.colors.primaryLight} style={styles.sectionIcon} />
            <Text style={styles.sectionTitle}>Deal Size</Text>
          </View>
          <TextInput
            style={styles.input}
            value={data.dollarAmount}
            onChangeText={(val) => setData((prev) => ({ ...prev, dollarAmount: val }))}
            placeholder="Amount ($)"
            keyboardType="numeric"
            placeholderTextColor="#64748B"
          />
        </View>

        <View style={[styles.section, { flex: 1, marginLeft: 8 }]}>
          <View style={styles.sectionHeader}>
            <Calendar size={16} color={theme.colors.primaryLight} style={styles.sectionIcon} />
            <Text style={styles.sectionTitle}>Close Date</Text>
          </View>
          <TextInput
            style={styles.input}
            value={data.estimatedCloseDate}
            onChangeText={(val) => setData((prev) => ({ ...prev, estimatedCloseDate: val }))}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#64748B"
          />
        </View>
      </View>

      {/* Pipeline Stage */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FileText size={16} color={theme.colors.primaryLight} style={styles.sectionIcon} />
          <Text style={styles.sectionTitle}>Pipeline Stage (Required)</Text>
        </View>
        <TextInput
          style={styles.input}
          value={data.pipelineStage}
          onChangeText={(val) => setData((prev) => ({ ...prev, pipelineStage: val }))}
          placeholder="e.g. Prospecting, Qualification, Negotiation/Review"
          placeholderTextColor="#64748B"
        />
      </View>

      {/* Summary Description */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FileText size={16} color={theme.colors.primaryLight} style={styles.sectionIcon} />
          <Text style={styles.sectionTitle}>Visit Note Summary</Text>
        </View>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={data.textSummary}
          onChangeText={(val) => setData((prev) => ({ ...prev, textSummary: val }))}
          multiline={true}
          numberOfLines={3}
          placeholderTextColor="#64748B"
        />
      </View>

      {/* Next Steps */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FileText size={16} color={theme.colors.primaryLight} style={styles.sectionIcon} />
          <Text style={styles.sectionTitle}>Follow-up Actions / Next Steps</Text>
        </View>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={data.nextSteps}
          onChangeText={(val) => setData((prev) => ({ ...prev, nextSteps: val }))}
          multiline={true}
          numberOfLines={2}
          placeholderTextColor="#64748B"
        />
      </View>

      {/* Action Footer Buttons */}
      <View style={styles.footerRow}>
        <TouchableOpacity style={styles.discardBtn} onPress={onCancel} disabled={isSubmitting}>
          <Text style={styles.discardBtnText}>Discard</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.submitBtn} onPress={handleValidationAndSave} disabled={isSubmitting}>
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Save size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.submitBtnText}>Sync to CRM</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    padding: theme.spacing.md,
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
    marginBottom: theme.spacing.md,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    color: theme.colors.dangerLight,
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginBottom: theme.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionIcon: {
    marginRight: 6,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
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
  textArea: {
    height: 60,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
    marginTop: 8,
  },
  warningTitle: {
    color: theme.colors.warning,
    fontSize: 12,
    fontWeight: '700',
  },
  warningDesc: {
    color: '#FFFFFF',
    fontSize: 10,
    marginTop: 2,
    lineHeight: 14,
  },
  matchesList: {
    marginTop: 6,
  },
  matchItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F1626',
    borderWidth: 1,
    borderColor: '#1D283E',
    borderRadius: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginTop: 4,
  },
  matchItemText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  conSelection: {
    marginBottom: theme.spacing.sm,
  },
  subLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginBottom: 4,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  conChip: {
    backgroundColor: '#1E293B',
    borderRadius: theme.borderRadius.sm,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: 6,
    marginBottom: 6,
  },
  conChipActive: {
    backgroundColor: theme.colors.accent,
  },
  conChipText: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  conChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  contactInputRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  addBtn: {
    backgroundColor: '#1E293B',
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 12,
    justifyContent: 'center',
    marginLeft: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    borderRadius: theme.borderRadius.sm,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: 6,
    marginBottom: 6,
  },
  selectedChipText: {
    color: '#FFFFFF',
    fontSize: 11,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.md,
    paddingBottom: 30,
  },
  discardBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  discardBtnText: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  submitBtn: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: theme.borderRadius.sm,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});

export default ReviewCard;
