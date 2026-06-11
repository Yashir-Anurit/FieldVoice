import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import {
  Clock as LucideClock,
  CheckCircle2 as LucideCheckCircle2,
  AlertCircle as LucideAlertCircle,
  RefreshCw as LucideRefreshCw,
  ChevronRight as LucideChevronRight
} from 'lucide-react-native';
import theme from '../theme';
import { OfflineNote } from '../types';

// Cast icons to bypass React 19 Lucide types check conflict
const Clock = LucideClock as any;
const CheckCircle2 = LucideCheckCircle2 as any;
const AlertCircle = LucideAlertCircle as any;
const RefreshCw = LucideRefreshCw as any;
const ChevronRight = LucideChevronRight as any;

interface HistoryQueueProps {
  notes: OfflineNote[];
  onReviewNote: (note: OfflineNote) => void;
  onDeleteNote: (noteId: string) => void;
  onRetrySync: () => void;
}

export const HistoryQueue: React.FC<HistoryQueueProps> = ({
  notes,
  onReviewNote,
  onDeleteNote,
  onRetrySync,
}) => {
  const getStatusStyle = (status: OfflineNote['syncStatus']) => {
    switch (status) {
      case 'synced':
        return {
          bg: 'rgba(16, 185, 129, 0.1)',
          border: 'rgba(16, 185, 129, 0.25)',
          color: theme.colors.success,
          icon: <CheckCircle2 size={14} color={theme.colors.success} />,
          text: 'Synced to Salesforce',
        };
      case 'syncing':
        return {
          bg: 'rgba(99, 102, 241, 0.1)',
          border: 'rgba(99, 102, 241, 0.25)',
          color: theme.colors.primaryLight,
          icon: <RefreshCw size={14} color={theme.colors.primaryLight} />,
          text: 'AI Processing...',
        };
      case 'failed':
        return {
          bg: 'rgba(239, 68, 68, 0.1)',
          border: 'rgba(239, 68, 68, 0.25)',
          color: theme.colors.danger,
          icon: <AlertCircle size={14} color={theme.colors.danger} />,
          text: 'Sync Failed',
        };
      case 'pending':
      default:
        return {
          bg: 'rgba(245, 158, 11, 0.1)',
          border: 'rgba(245, 158, 11, 0.25)',
          color: theme.colors.warning,
          icon: <Clock size={14} color={theme.colors.warning} />,
          text: 'Offline - Queued',
        };
    }
  };

  const formatTimestamp = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (notes.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Clock size={36} color={theme.colors.textMuted} style={{ marginBottom: 12 }} />
        <Text style={styles.emptyTitle}>No Recorded Notes Yet</Text>
        <Text style={styles.emptyDesc}>Recorded visits and sync logs will appear in this history queue.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.queueHeaderTitle}>Recent Visit Log History</Text>
      {notes.map((note) => {
        const style = getStatusStyle(note.syncStatus);
        const isReadyForReview = note.syncStatus === 'synced' && note.extractedData !== null;

        return (
          <View
            key={note.id}
            style={[
              styles.noteCard,
              { borderColor: style.border },
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.accountName}>
                  {note.extractedData?.accountName || 'Syncing Account...'}
                </Text>
                <Text style={styles.timestamp}>{formatTimestamp(note.timestamp)} ({note.duration}s)</Text>
              </View>

              {/* Status Badge */}
              <View style={[styles.badge, { backgroundColor: style.bg, borderColor: style.border }]}>
                {style.icon}
                <Text style={[styles.badgeText, { color: style.color }]}>{style.text}</Text>
              </View>
            </View>

            {/* Snippet */}
            <Text style={styles.snippet} numberOfLines={2}>
              {note.transcript}
            </Text>

            {/* Error Message if failed */}
            {note.syncStatus === 'failed' && note.errorMessage && (
              <Text style={styles.errorText}>Error: {note.errorMessage}</Text>
            )}

            {/* Action footer */}
            <View style={styles.cardFooter}>
              {isReadyForReview ? (
                <TouchableOpacity
                  style={styles.reviewBtn}
                  onPress={() => onReviewNote(note)}
                >
                  <Text style={styles.reviewBtnText}>Review & Submit AI Fields</Text>
                  <ChevronRight size={14} color={theme.colors.primaryLight} />
                </TouchableOpacity>
              ) : note.syncStatus === 'failed' ? (
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={onRetrySync}
                >
                  <Text style={styles.retryBtnText}>Retry Sync</Text>
                </TouchableOpacity>
              ) : (
                <View />
              )}

              <TouchableOpacity
                onPress={() => onDeleteNote(note.id)}
                style={styles.deleteBtn}
              >
                <Text style={styles.deleteBtnText}>Remove Log</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  queueHeaderTitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: theme.spacing.sm,
    paddingLeft: 4,
  },
  noteCard: {
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  accountName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  timestamp: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: theme.borderRadius.sm,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  snippet: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginVertical: 4,
  },
  errorText: {
    color: theme.colors.dangerLight,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    backgroundColor: 'rgba(239,68,68,0.08)',
    padding: 6,
    borderRadius: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    paddingTop: 8,
  },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  reviewBtnText: {
    color: theme.colors.primaryLight,
    fontSize: 12,
    fontWeight: '700',
    marginRight: 2,
  },
  retryBtn: {
    paddingVertical: 4,
  },
  retryBtnText: {
    color: theme.colors.warning,
    fontSize: 12,
    fontWeight: '700',
  },
  deleteBtn: {
    paddingVertical: 4,
  },
  deleteBtnText: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
    opacity: 0.8,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyDesc: {
    color: theme.colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: theme.spacing.xl,
  },
});

export default HistoryQueue;
