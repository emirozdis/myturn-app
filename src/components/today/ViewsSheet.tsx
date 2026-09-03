// ./src/components/today/ViewsSheet.tsx
import React from 'react';
import { View, StyleSheet, FlatList, Platform } from 'react-native';
import { Heart, Eye } from 'lucide-react-native';
import * as Crypto from 'expo-crypto';
import { Avatar } from '../ui/Avatar';
import { Text } from '../ui/Text';
import { BottomSheet } from '../ui/BottomSheet';
import { GlassView } from '../ui/GlassView';

type ViewsSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  views?: any[];
  likes?: any[];
  groupMembers?: any[];
  highlightedUserId?: string | null;
};

export function ViewsSheet({ isOpen, onClose, views = [], likes = [], groupMembers = [], highlightedUserId = null }: ViewsSheetProps) {
  
  // Merge likes and views cleanly, keeping unique users and tracking who liked
  const mergedList = React.useMemo(() => {
    const userMap = new Map<string, { id: string; user: any; hasLiked: boolean }>();

    // Add all viewers first
    views.forEach((v) => {
      let targetUser = v.user;
      
      // Fallback: Resolve missing user profile object from the group directory
      if (!targetUser && v.userId) {
        const matchedMember = (groupMembers || []).find((m: any) => m.id === v.userId);
        if (matchedMember) {
          targetUser = matchedMember;
        }
      }

      if (targetUser && targetUser.id) {
        userMap.set(targetUser.id, {
          id: v.id || Crypto.randomUUID(),
          user: targetUser,
          hasLiked: false,
        });
      }
    });

    // Mark as liked / add likers if they aren't already in the list
    likes.forEach((l) => {
      let targetUser = l.user;
      if (targetUser && targetUser.id) {
        const existing = userMap.get(targetUser.id);
        if (existing) {
          existing.hasLiked = true;
        } else {
          userMap.set(targetUser.id, {
            id: l.id || Crypto.randomUUID(),
            user: targetUser,
            hasLiked: true,
          });
        }
      }
    });

    return Array.from(userMap.values());
  }, [views, likes, groupMembers]);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} heightPercent={0.48}>
      <View style={styles.sheetContent}>
        
        {/* Custom Header */}
        <View style={styles.sheetHeader}>
          <Eye size={16} color="rgba(255,255,255,0.7)" style={{ marginRight: 6 }} />
          <Text weight="bold" className="text-white text-base">İzleyenler ({mergedList.length})</Text>
        </View>

        {/* High performance unified list with glass cells */}
        {mergedList && mergedList.length > 0 ? (
          <FlatList
            data={mergedList}
            keyExtractor={(item) => item.id}
            style={styles.list}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <GlassView
                preset="liquid"
                interactive={true}
                style={[styles.rowGlass, item.user?.id === highlightedUserId && styles.highlightedRow]}
              >
                <View className="flex-row items-center gap-3">
                  <Avatar src={item.user?.image} name={item.user?.name} size={34} />
                  <View>
                    <Text weight="bold" className="text-white text-xs">@{item.user?.handle || "user"}</Text>
                    <Text className="text-[10px] text-white/40 mt-0.5">Bugün izledi</Text>
                  </View>
                </View>

                {/* Inline Glowing Like Status Badge */}
                {item.hasLiked && (
                  <View style={styles.heartRowBadge}>
                    <Heart size={10} color="#ff6b6b" fill="#ff6b6b" />
                    <Text weight="bold" style={styles.heartRowText}>Beğendi</Text>
                  </View>
                )}
              </GlassView>
            )}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Eye size={24} color="rgba(255,255,255,0.2)" style={{ marginBottom: 8 }} />
            <Text className="text-white/40 text-xs font-semibold">Henüz izleyen yok.</Text>
          </View>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  highlightedRow: {
    borderColor: "#FFD60A",
    borderWidth: 1,
    backgroundColor: "rgba(255,214,10,0.08)",
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  list: {
    flex: 1,
    overflow: 'visible',
  },
  listContainer: {
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  rowGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 18,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'visible',
  },
  heartRowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 107, 107, 0.22)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  heartRowText: {
    fontSize: 9,
    color: '#ff6b6b',
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  }
});
