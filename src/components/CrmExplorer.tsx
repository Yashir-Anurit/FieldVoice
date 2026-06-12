import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Modal, ActivityIndicator, Alert } from 'react-native';
import {
  Search as LucideSearch,
  RefreshCw as LucideRefreshCw,
  Plus as LucidePlus,
  Edit2 as LucideEdit2,
  Trash2 as LucideTrash2,
  Briefcase as LucideBriefcase,
  DollarSign as LucideDollarSign,
  Calendar as LucideCalendar,
  X as LucideX,
  Save as LucideSave
} from 'lucide-react-native';
import theme from '../theme';
import { Opportunity } from '../types';
import { salesforceService } from '../services/salesforceService';

// Cast icons to bypass React 19 Lucide types check conflict
const Search = LucideSearch as any;
const RefreshCw = LucideRefreshCw as any;
const Plus = LucidePlus as any;
const Edit2 = LucideEdit2 as any;
const Trash2 = LucideTrash2 as any;
const Briefcase = LucideBriefcase as any;
const DollarSign = LucideDollarSign as any;
const Calendar = LucideCalendar as any;
const X = LucideX as any;
const Save = LucideSave as any;

const STAGES = [
  'Prospecting',
  'Qualification',
  'Needs Analysis',
  'Value Proposition',
  'Id. Decision Makers',
  'Perception Analysis',
  'Proposal/Price Quote',
  'Negotiation/Review',
  'Closed Won',
  'Closed Lost'
];

export const CrmExplorer: React.FC = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Edit states
  const [editOpp, setEditOpp] = useState<Opportunity | null>(null);
  const [editName, setEditName] = useState('');
  const [editStage, setEditStage] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCloseDate, setEditCloseDate] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Create states
  const [showCreate, setShowCreate] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newOppName, setNewOppName] = useState('');
  const [newStage, setNewStage] = useState('Prospecting');
  const [newAmount, setNewAmount] = useState('');
  const [newCloseDate, setNewCloseDate] = useState(new Date().toISOString().split('T')[0]);
  const [createSaving, setCreateSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const opps = await salesforceService.getOpportunities();
      setOpportunities(opps || []);
    } catch (err) {
      console.warn('Failed to load opportunities from Salesforce:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleEditPress = (opp: Opportunity) => {
    setEditOpp(opp);
    setEditName(opp.name);
    setEditStage(opp.stage);
    setEditAmount(opp.amount);
    setEditCloseDate(opp.closeDate);
  };

  const handleSaveEdit = async () => {
    if (!editOpp) return;
    if (!editName.trim() || !editStage.trim() || !editCloseDate.trim()) {
      Alert.alert('Required Fields', 'Name, Stage, and Close Date are required.');
      return;
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(editCloseDate)) {
      Alert.alert('Invalid Date Format', 'Close Date must be in YYYY-MM-DD format.');
      return;
    }

    setEditSaving(true);
    try {
      const res = await salesforceService.updateOpportunity(editOpp.id, {
        name: editName.trim(),
        stage: editStage,
        amount: editAmount.trim(),
        closeDate: editCloseDate.trim()
      });

      if (res.success) {
        Alert.alert('Success', 'Opportunity details updated successfully!');
        setEditOpp(null);
        await loadData();
      } else {
        Alert.alert('Update Failed', res.error || 'Check validation logs.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An error occurred during updating.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeletePress = (opp: Opportunity) => {
    Alert.alert(
      'Confirm Deletion',
      `Are you sure you want to delete opportunity "${opp.name}" from Salesforce?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const res = await salesforceService.deleteOpportunity(opp.id);
              if (res.success) {
                Alert.alert('Deleted', 'Opportunity deleted successfully.');
                await loadData();
              } else {
                Alert.alert('Delete Failed', res.error || 'Salesforce refused deletion.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'An error occurred during deletion.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleCreateOpportunity = async () => {
    if (!newAccName.trim() || !newOppName.trim() || !newStage.trim() || !newCloseDate.trim()) {
      Alert.alert('Required Fields', 'Account Name, Opportunity Name, Stage, and Close Date are required.');
      return;
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(newCloseDate)) {
      Alert.alert('Invalid Date Format', 'Close Date must be in YYYY-MM-DD format.');
      return;
    }

    setCreateSaving(true);
    try {
      const res = await salesforceService.createOpportunity({
        accountName: newAccName.trim(),
        opportunityName: newOppName.trim(),
        stage: newStage,
        amount: newAmount.trim(),
        closeDate: newCloseDate.trim()
      });

      if (res.success) {
        Alert.alert('Success', 'Opportunity manually created in Salesforce!');
        setShowCreate(false);
        setNewAccName('');
        setNewOppName('');
        setNewAmount('');
        setNewStage('Prospecting');
        await loadData();
      } else {
        Alert.alert('Creation Failed', res.error || 'Check validation logs.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An error occurred during creation.');
    } finally {
      setCreateSaving(false);
    }
  };

  const getStageColor = (stage: string) => {
    if (stage.includes('Closed Won') || stage.includes('Won')) return theme.colors.success;
    if (stage.includes('Closed Lost') || stage.includes('Lost')) return theme.colors.danger;
    if (stage.includes('Proposal') || stage.includes('Negotiation')) return theme.colors.accent;
    return theme.colors.warning;
  };

  const filteredOpps = opportunities.filter((opp) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      opp.name.toLowerCase().includes(query) ||
      (opp.accountName && opp.accountName.toLowerCase().includes(query)) ||
      opp.stage.toLowerCase().includes(query)
    );
  });

  return (
    <View style={styles.container}>
      {/* Header controls */}
      <View style={styles.controlsRow}>
        <View style={styles.searchContainer}>
          <Search size={16} color={theme.colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search Salesforce items..."
            placeholderTextColor="#64748B"
          />
        </View>

        <TouchableOpacity style={styles.refreshBtn} onPress={loadData} disabled={loading}>
          <RefreshCw size={14} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
          <Plus size={14} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Main List */}
      {loading && opportunities.length === 0 ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loaderText}>Fetching Live CRM Records...</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
          {filteredOpps.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Briefcase size={28} color={theme.colors.textMuted} style={{ marginBottom: 8 }} />
              <Text style={styles.emptyText}>No matched Salesforce records found.</Text>
            </View>
          ) : (
            filteredOpps.map((opp) => {
              const stageColor = getStageColor(opp.stage);
              return (
                <View key={opp.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.oppName}>{opp.name}</Text>
                      <View style={styles.accountRow}>
                        <Briefcase size={12} color={theme.colors.textMuted} style={{ marginRight: 4 }} />
                        <Text style={styles.accountText}>{opp.accountName || 'No Linked Account'}</Text>
                      </View>
                    </View>
                    
                    {/* Stage Pill */}
                    <View style={[styles.stageBadge, { borderColor: stageColor, backgroundColor: stageColor + '15' }]}>
                      <Text style={[styles.stageBadgeText, { color: stageColor }]}>{opp.stage}</Text>
                    </View>
                  </View>

                  {/* Details */}
                  <View style={styles.detailsRow}>
                    <View style={styles.detailItem}>
                      <DollarSign size={12} color={theme.colors.textMuted} style={{ marginRight: 2 }} />
                      <Text style={styles.detailText}>
                        {opp.amount ? `$${parseFloat(opp.amount).toLocaleString()}` : '$0'}
                      </Text>
                    </View>

                    <View style={styles.detailItem}>
                      <Calendar size={12} color={theme.colors.textMuted} style={{ marginRight: 2 }} />
                      <Text style={styles.detailText}>{opp.closeDate || 'No Close Date'}</Text>
                    </View>
                  </View>

                  {/* Actions footer */}
                  <View style={styles.cardActions}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleEditPress(opp)}>
                      <LucideEdit2 size={13} color={theme.colors.primaryLight} style={{ marginRight: 4 }} />
                      <Text style={styles.actionText}>Edit Record</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleDeletePress(opp)}>
                      <LucideTrash2 size={13} color={theme.colors.dangerLight} style={{ marginRight: 4 }} />
                      <Text style={styles.actionTextDanger}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* 1. EDIT MODAL */}
      <Modal transparent={true} visible={editOpp !== null} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modify Opportunity Details</Text>
              <TouchableOpacity onPress={() => setEditOpp(null)}>
                <X size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Opportunity Name</Text>
                <TextInput
                  style={styles.input}
                  value={editName}
                  onChangeText={setEditName}
                  placeholderTextColor="#64748B"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Pipeline Stage</Text>
                <View style={styles.stagesContainer}>
                  {STAGES.map((st) => {
                    const isSelected = editStage === st;
                    return (
                      <TouchableOpacity
                        key={st}
                        style={[styles.stageChip, isSelected && styles.stageChipActive]}
                        onPress={() => setEditStage(st)}
                      >
                        <Text style={[styles.stageChipText, isSelected && styles.stageChipTextActive]}>{st}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Deal Amount ($)</Text>
                <TextInput
                  style={styles.input}
                  value={editAmount}
                  onChangeText={setEditAmount}
                  keyboardType="numeric"
                  placeholder="e.g. 85000"
                  placeholderTextColor="#64748B"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Estimated Close Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  value={editCloseDate}
                  onChangeText={setEditCloseDate}
                  placeholder="2026-12-31"
                  placeholderTextColor="#64748B"
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveEdit}
                disabled={editSaving}
              >
                {editSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Save size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.saveBtnText}>Save Salesforce Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 2. CREATE MODAL */}
      <Modal transparent={true} visible={showCreate} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manual CRM Opportunity Entry</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <X size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Account Name (Salesforce Client)</Text>
                <TextInput
                  style={styles.input}
                  value={newAccName}
                  onChangeText={setNewAccName}
                  placeholder="e.g. Ceres Grain Corp"
                  placeholderTextColor="#64748B"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Opportunity Name</Text>
                <TextInput
                  style={styles.input}
                  value={newOppName}
                  onChangeText={setNewOppName}
                  placeholder="e.g. 50 Tons Seed Expansion"
                  placeholderTextColor="#64748B"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Pipeline Stage</Text>
                <View style={styles.stagesContainer}>
                  {STAGES.map((st) => {
                    const isSelected = newStage === st;
                    return (
                      <TouchableOpacity
                        key={st}
                        style={[styles.stageChip, isSelected && styles.stageChipActive]}
                        onPress={() => setNewStage(st)}
                      >
                        <Text style={[styles.stageChipText, isSelected && styles.stageChipTextActive]}>{st}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Deal Amount ($)</Text>
                <TextInput
                  style={styles.input}
                  value={newAmount}
                  onChangeText={setNewAmount}
                  keyboardType="numeric"
                  placeholder="e.g. 45000"
                  placeholderTextColor="#64748B"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Estimated Close Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  value={newCloseDate}
                  onChangeText={setNewCloseDate}
                  placeholder="2026-12-31"
                  placeholderTextColor="#64748B"
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleCreateOpportunity}
                disabled={createSaving}
              >
                {createSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Save size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.saveBtnText}>Post to Salesforce</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 10,
    height: 40,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
  },
  refreshBtn: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
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
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  loaderText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    marginTop: theme.spacing.md,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  card: {
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  oppName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  accountText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  stageBadge: {
    borderWidth: 1,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: theme.borderRadius.sm,
  },
  stageBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  detailsRow: {
    flexDirection: 'row',
    marginTop: 6,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    paddingBottom: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  detailText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  actionText: {
    color: theme.colors.primaryLight,
    fontSize: 12,
    fontWeight: '600',
  },
  actionTextDanger: {
    color: theme.colors.dangerLight,
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 16, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContainer: {
    backgroundColor: '#0B1120',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    width: '100%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    paddingBottom: 10,
    marginBottom: theme.spacing.md,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  modalBody: {
    marginBottom: theme.spacing.md,
  },
  formGroup: {
    marginBottom: theme.spacing.md,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
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
  stagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  stageChip: {
    backgroundColor: '#1E293B',
    borderRadius: theme.borderRadius.sm,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  stageChipActive: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    borderColor: theme.colors.primary,
  },
  stageChipText: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  stageChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalFooter: {
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingTop: 10,
    alignItems: 'stretch',
  },
  saveBtn: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: theme.borderRadius.sm,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});

export default CrmExplorer;
