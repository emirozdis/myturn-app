import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Check, ChevronDown, Users } from 'lucide-react-native';

import { lightTap } from '../../lib/haptics';
import { useTranslation } from '../../lib/i18n';
import { ACCENT } from '../../lib/theme';
import { useGroupStore } from '../../store/useGroupStore';
import { Avatar } from '../ui/Avatar';
import { BottomSheet } from '../ui/BottomSheet';
import { Text } from '../ui/Text';

type GroupSelectorSheetProps = {
  isOpen: boolean;
  onClose: () => void;
};

type GroupSwitcherPillProps = {
  onPress: () => void;
};

export function GroupSwitcherPill({ onPress }: GroupSwitcherPillProps) {
  const groups = useGroupStore((state) => state.groups);
  const activeGroupId = useGroupStore((state) => state.activeGroupId);
  const { t } = useTranslation();
  const activeGroup = groups.find((group) => group.id === activeGroupId) || groups[0];

  if (groups.length <= 1 || !activeGroup) return null;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${t('groupSelector.open')}: ${activeGroup.name}`}
      activeOpacity={0.8}
      onPress={() => {
        lightTap();
        onPress();
      }}
      style={styles.switcherPill}
    >
      <Avatar src={activeGroup.image} name={activeGroup.name} size={25} />
      <Text weight="bold" style={styles.switcherName} numberOfLines={1}>{activeGroup.name}</Text>
      <ChevronDown size={14} color="rgba(255,255,255,0.58)" />
    </TouchableOpacity>
  );
}

export function GroupSelectorSheet({ isOpen, onClose }: GroupSelectorSheetProps) {
  const groups = useGroupStore((state) => state.groups);
  const activeGroupId = useGroupStore((state) => state.activeGroupId);
  const setActiveGroupId = useGroupStore((state) => state.setActiveGroupId);
  const { t } = useTranslation();

  const selectGroup = (groupId: string) => {
    lightTap();
    if (groupId !== activeGroupId) {
      setActiveGroupId(groupId);
    }
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} heightPercent={0.52}>
      <View style={styles.container}>
        <Text weight="bold" style={styles.title}>{t('groupSelector.title')}</Text>
        <Text style={styles.subtitle}>{t('groupSelector.body')}</Text>

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {groups.map((group) => {
            const isActive = group.id === activeGroupId;

            return (
              <TouchableOpacity
                key={group.id}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={group.name}
                activeOpacity={0.82}
                onPress={() => selectGroup(group.id)}
                style={[styles.groupRow, isActive && styles.groupRowActive]}
              >
                <Avatar src={group.image} name={group.name} size={46} />
                <View style={styles.groupCopy}>
                  <Text weight="bold" style={styles.groupName} numberOfLines={1}>{group.name}</Text>
                  <View style={styles.memberRow}>
                    <Users size={12} color="rgba(255,255,255,0.42)" />
                    <Text style={styles.memberCount}>
                      {t('groupSelector.memberCount', { count: group.memberCount || 0 })}
                    </Text>
                  </View>
                </View>

                <View style={[styles.selection, isActive && styles.selectionActive]}>
                  {isActive ? <Check size={15} color="#111" strokeWidth={3} /> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  switcherPill: {
    alignSelf: 'center',
    height: 38,
    maxWidth: 210,
    marginTop: 10,
    paddingLeft: 6,
    paddingRight: 11,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.055)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switcherName: {
    color: '#fff',
    fontSize: 12,
    maxWidth: 135,
  },
  container: {
    flex: 1,
    paddingHorizontal: 22,
    paddingBottom: 22,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    letterSpacing: -0.4,
    textAlign: 'center',
    marginTop: 6,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 18,
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 10,
    paddingBottom: 12,
  },
  groupRow: {
    minHeight: 70,
    paddingHorizontal: 13,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.035)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupRowActive: {
    borderColor: 'rgba(224,124,48,0.5)',
    backgroundColor: 'rgba(224,124,48,0.09)',
  },
  groupCopy: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
  },
  groupName: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 5,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  memberCount: {
    color: 'rgba(255,255,255,0.44)',
    fontSize: 10.5,
  },
  selection: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionActive: {
    borderColor: ACCENT,
    backgroundColor: ACCENT,
  },
});
