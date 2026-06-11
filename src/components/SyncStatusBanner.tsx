import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Wifi as LucideWifi, WifiOff as LucideWifiOff, RefreshCw as LucideRefreshCw } from 'lucide-react-native';
import theme from '../theme';

// Cast icons to bypass React 19 Lucide types check conflict
const Wifi = LucideWifi as any;
const WifiOff = LucideWifiOff as any;
const RefreshCw = LucideRefreshCw as any;

interface SyncStatusBannerProps {
  isOnline: boolean;
  pendingCount: number;
  onManualSyncTrigger?: () => void;
}

export const SyncStatusBanner: React.FC<SyncStatusBannerProps> = ({
  isOnline,
  pendingCount,
  onManualSyncTrigger,
}) => {
  return (
    <View style={[styles.container, !isOnline && styles.containerOffline]}>
      <View style={styles.statusRow}>
        <View style={styles.indicatorContainer}>
          <View style={[styles.dot, isOnline ? styles.dotOnline : styles.dotOffline]} />
          <Text style={[styles.statusText, isOnline ? styles.textOnline : styles.textOffline]}>
            {isOnline ? 'Salesforce Connected' : 'Working Offline'}
          </Text>
        </View>

        {isOnline ? (
          <Wifi size={16} color={theme.colors.success} />
        ) : (
          <WifiOff size={16} color={theme.colors.warning} />
        )}
      </View>

      {pendingCount > 0 && (
        <View style={styles.queueAlert}>
          <Text style={styles.queueAlertText}>
            {pendingCount} voice note{pendingCount > 1 ? 's' : ''} queued offline.
          </Text>
          
          {isOnline ? (
            <TouchableOpacity 
              style={styles.syncBtn} 
              onPress={onManualSyncTrigger}
              activeOpacity={0.8}
            >
              <RefreshCw size={12} color="#FFFFFF" style={styles.syncBtnIcon} />
              <Text style={styles.syncBtnText}>Sync Now</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.queueSubtext}>Will sync when online</Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F1626',
    borderWidth: 1,
    borderColor: '#1D283E',
    borderRadius: theme.borderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
    width: '100%',
    marginBottom: theme.spacing.md,
  },
  containerOffline: {
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  indicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  dotOnline: {
    backgroundColor: theme.colors.success,
    shadowColor: theme.colors.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  dotOffline: {
    backgroundColor: theme.colors.warning,
    shadowColor: theme.colors.warning,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  textOnline: {
    color: theme.colors.success,
  },
  textOffline: {
    color: theme.colors.warning,
  },
  queueAlert: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  queueAlertText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '500',
  },
  queueSubtext: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontStyle: 'italic',
  },
  syncBtn: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: theme.borderRadius.sm,
  },
  syncBtnIcon: {
    marginRight: 4,
  },
  syncBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});

export default SyncStatusBanner;
