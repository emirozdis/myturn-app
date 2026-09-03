// ./src/components/today/CommentsSheet.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, FlatList, TextInput, TouchableOpacity, Platform, ScrollView, Text as RNText } from "react-native";
import { Heart, Send, Trash2 } from "lucide-react-native";
import { Avatar } from "../ui/Avatar";
import { Text } from "../ui/Text";
import { ACCENT } from "../../lib/theme";
import { BottomSheet } from "../ui/BottomSheet";
import { lightTap, selectionTick } from '../../lib/haptics';
import { ActionProgress } from '../ui/ActionProgress';

type CommentsSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  commentList: any[];
  groupMembers: any[];
  onAddComment: (text: string, parentId?: string) => Promise<void>;
  onToggleCommentLike?: (id: string) => Promise<void>;
  onDeleteComment: (id: string) => void;
  currentUserId?: string;
  readOnly?: boolean;
  highlightedCommentId?: string | null;
};

type GroupMember = {
  id: string;
  name?: string | null;
  handle?: string | null;
  image?: string | null;
};

type ActiveMention = {
  start: number;
  end: number;
  query: string;
};

type ThreadReply = {
  comment: any;
  depth: number;
};

const TRAILING_MENTION_PUNCTUATION = /[.,!?;:)\]}]$/u;

function getActiveMention(value: string, cursor: number): ActiveMention | null {
  const beforeCursor = value.slice(0, cursor);
  const match = beforeCursor.match(/(?:^|[\s([{"'])@([^\s@]*)$/u);
  if (!match) return null;

  const start = beforeCursor.lastIndexOf("@");
  return { start, end: cursor, query: match[1] };
}

function MentionText({ value }: { value: string }) {
  const children: React.ReactNode[] = [];
  const tokenPattern = /@([^\s@]+)/gu;
  let cursor = 0;

  for (const match of value.matchAll(tokenPattern)) {
    const start = match.index;
    const previousCharacter = start > 0 ? value[start - 1] : "";
    if (previousCharacter && /[\p{L}\p{N}_@]/u.test(previousCharacter)) continue;

    const rawToken = match[0];
    let mentionLength = rawToken.length;
    while (mentionLength > 1 && TRAILING_MENTION_PUNCTUATION.test(rawToken.slice(0, mentionLength))) {
      mentionLength -= 1;
    }

    if (start > cursor) children.push(value.slice(cursor, start));
    children.push(
      <RNText key={`mention-${start}`} style={styles.mentionText}>
        {rawToken.slice(0, mentionLength)}
      </RNText>,
    );
    if (mentionLength < rawToken.length) children.push(rawToken.slice(mentionLength));
    cursor = start + rawToken.length;
  }

  if (cursor < value.length) children.push(value.slice(cursor));

  return (
    <Text className="text-white/80 text-xs mt-0.5" style={styles.commentText}>
      {children}
    </Text>
  );
}

export function CommentsSheet({
  isOpen,
  onClose,
  commentList,
  groupMembers,
  onAddComment,
  onToggleCommentLike,
  onDeleteComment,
  currentUserId,
  readOnly = false,
  highlightedCommentId = null,
}: CommentsSheetProps) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [activeMention, setActiveMention] = useState<ActiveMention | null>(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [pendingLikeIds, setPendingLikeIds] = useState<Set<string>>(new Set());

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const topLevel = useMemo(
    () => commentList.filter((comment) => !comment.parentId),
    [commentList],
  );
  const commentsById = useMemo(
    () => new Map(commentList.map((comment) => [comment.id, comment])),
    [commentList],
  );
  const repliesMap = useMemo(() => commentList.reduce((acc, comment) => {
    if (comment.parentId) {
      if (!acc[comment.parentId]) acc[comment.parentId] = [];
      acc[comment.parentId].push(comment);
    }
    return acc;
  }, {} as Record<string, any[]>), [commentList]);

  const threadReplies = useMemo(() => {
    const result: Record<string, ThreadReply[]> = {};

    for (const rootComment of topLevel) {
      const descendants: ThreadReply[] = [];
      const visited = new Set<string>([rootComment.id]);
      const appendDescendants = (parentId: string, depth: number) => {
        for (const reply of repliesMap[parentId] || []) {
          if (visited.has(reply.id)) continue;
          visited.add(reply.id);
          descendants.push({ comment: reply, depth });
          appendDescendants(reply.id, depth + 1);
        }
      };
      appendDescendants(rootComment.id, 1);
      result[rootComment.id] = descendants;
    }

    return result;
  }, [repliesMap, topLevel]);

  const replyTarget = replyToId ? commentsById.get(replyToId) : null;

  useEffect(() => {
    if (!isOpen || !highlightedCommentId) return;
    let highlightedComment = commentsById.get(highlightedCommentId);
    const visited = new Set<string>();
    while (highlightedComment?.parentId && !visited.has(highlightedComment.id)) {
      visited.add(highlightedComment.id);
      highlightedComment = commentsById.get(highlightedComment.parentId) || highlightedComment;
      if (highlightedComment.parentId && !commentsById.has(highlightedComment.parentId)) break;
    }
    const topLevelId = highlightedComment?.id;
    const targetIndex = topLevel.findIndex((comment) => comment.id === topLevelId);
    if (targetIndex < 0) return;

    const timeout = setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index: targetIndex, animated: true, viewPosition: 0.35 });
    }, 350);
    return () => clearTimeout(timeout);
  }, [isOpen, highlightedCommentId, commentsById, topLevel]);

  const mentionableMembers = useMemo(
    () => (groupMembers || []).filter((member: GroupMember) => Boolean(member.handle)),
    [groupMembers],
  );

  const filteredMembers = useMemo(() => {
    if (!activeMention) return [];
    const query = activeMention.query.toLowerCase();
    return mentionableMembers.filter((member: GroupMember) => (
      member.handle?.toLowerCase().includes(query) ||
      member.name?.toLowerCase().includes(query)
    ));
  }, [activeMention, mentionableMembers]);

  const handleInputChange = (val: string) => {
    const replacedLength = selection.end - selection.start;
    const insertedLength = val.length - (text.length - replacedLength);
    const cursor = Math.max(0, Math.min(selection.start + insertedLength, val.length));
    setText(val);
    setSelection({ start: cursor, end: cursor });
    setActiveMention(getActiveMention(val, cursor));
  };

  const insertMention = (handle: string) => {
    if (!activeMention) return;
    const inserted = `@${handle} `;
    const nextText = `${text.slice(0, activeMention.start)}${inserted}${text.slice(activeMention.end)}`;
    const nextCursor = activeMention.start + inserted.length;

    setText(nextText);
    setSelection({ start: nextCursor, end: nextCursor });
    setActiveMention(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleSend = async () => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    try {
      lightTap();
      await onAddComment(text.trim(), replyToId || undefined);
      setText("");
      setReplyToId(null);
      setActiveMention(null);
      setSelection({ start: 0, end: 0 });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleLike = async (commentId: string) => {
    if (readOnly || !onToggleCommentLike || pendingLikeIds.has(commentId)) return;
    lightTap();
    setPendingLikeIds((current) => new Set(current).add(commentId));
    try {
      await onToggleCommentLike(commentId);
    } catch {
      // The store restores the optimistic state when the request fails.
    } finally {
      setPendingLikeIds((current) => {
        const next = new Set(current);
        next.delete(commentId);
        return next;
      });
    }
  };

  const renderActions = (comment: any) => {
    const liked = comment.likedByCurrentUser ?? (comment.likes?.length > 0);
    const likeCount = comment.likeCount ?? comment._count?.likes ?? 0;
    const likePending = pendingLikeIds.has(comment.id);
    const showLike = Boolean(onToggleCommentLike) || likeCount > 0;
    if (readOnly && !showLike) return null;

    return (
      <View style={styles.commentActions}>
        {!readOnly && (
          <TouchableOpacity
            onPress={() => {
              setReplyToId(comment.id);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
          >
            <Text className="text-[10px] text-white/40 font-bold">Yanıtla</Text>
          </TouchableOpacity>
        )}
        {showLike && (
          <TouchableOpacity
            onPress={() => handleToggleLike(comment.id)}
            disabled={readOnly || !onToggleCommentLike || likePending}
            style={[styles.likeButton, likePending && styles.likeButtonPending]}
            accessibilityRole="button"
            accessibilityLabel={liked ? "Yorum beğenisini kaldır" : "Yorumu beğen"}
            accessibilityState={{ selected: liked, disabled: readOnly || !onToggleCommentLike || likePending }}
          >
            <Heart
              size={12}
              color={liked ? ACCENT : "rgba(255,255,255,0.4)"}
              fill={liked ? ACCENT : "transparent"}
              strokeWidth={2.2}
            />
            {likeCount > 0 && (
              <Text style={[styles.likeCount, liked && styles.likeCountActive]}>{likeCount}</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} heightPercent={0.75}>
      <View style={styles.sheetContent}>
        <View style={styles.sheetHeader}>
          <Text weight="bold" className="text-white text-base">Yorumlar ({commentList.length})</Text>
        </View>

        {/* Set flex: 1 to ensure list is constrained and does not push input out of view */}
        <FlatList
          ref={flatListRef}
          data={topLevel}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContainer}
          keyboardShouldPersistTaps="handled"
          onScrollToIndexFailed={({ index }) => {
            flatListRef.current?.scrollToOffset({ offset: Math.max(0, index * 100), animated: true });
          }}
          renderItem={({ item }) => (
            <View style={styles.commentGroup}>
              <View style={[styles.commentBubble, item.id === highlightedCommentId && styles.highlightedComment]}>
                <Avatar src={item.user?.image} name={item.user?.name} size={28} />
                <View style={styles.bubbleContent}>
                  <View style={styles.bubbleHeader}>
                    <Text weight="bold" className="text-white text-[11px]">@{item.user?.handle}</Text>
                    {item.userId === currentUserId && !readOnly && (
                      <TouchableOpacity onPress={() => onDeleteComment(item.id)}>
                        <Trash2 size={11} color="rgba(255,255,255,0.4)" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <MentionText value={item.text} />
                  {renderActions(item)}
                </View>
              </View>

              {/* Nested Replies */}
              {threadReplies[item.id]?.map(({ comment: reply, depth }) => (
                <View
                  key={reply.id}
                  style={[
                    styles.replyBubble,
                    { marginLeft: 32 + Math.min(depth - 1, 3) * 14 },
                    reply.id === highlightedCommentId && styles.highlightedComment,
                  ]}
                >
                  <View style={styles.replyLine} />
                  <Avatar src={reply.user?.image} name={reply.user?.name} size={20} />
                  <View style={styles.bubbleContent}>
                    <View style={styles.bubbleHeader}>
                      <Text weight="bold" className="text-white text-[10px]">@{reply.user?.handle}</Text>
                      {reply.userId === currentUserId && !readOnly && (
                        <TouchableOpacity onPress={() => onDeleteComment(reply.id)}>
                          <Trash2 size={10} color="rgba(255,255,255,0.4)" />
                        </TouchableOpacity>
                      )}
                    </View>
                    <MentionText value={reply.text} />
                    {renderActions(reply)}
                  </View>
                </View>
              ))}
            </View>
          )}
        />

        {/* Autocomplete Mention Area */}
        {activeMention !== null && !readOnly && (
          <View style={styles.mentionBox}>
            <Text weight="bold" style={styles.mentionHeading}>GRUP ÜYELERİ</Text>
            <ScrollView style={styles.mentionList} keyboardShouldPersistTaps="always">
              {filteredMembers.length > 0 ? filteredMembers.map((member: GroupMember) => (
                <TouchableOpacity
                  key={member.id}
                  onPress={() => {
                    selectionTick();
                    insertMention(member.handle!);
                  }}
                  style={styles.mentionRow}
                >
                  <Avatar src={member.image} name={member.name || member.handle} size={30} />
                  <View style={styles.mentionIdentity}>
                    <Text weight="bold" style={styles.mentionName}>{member.name || member.handle}</Text>
                    <Text style={styles.mentionHandle}>@{member.handle}</Text>
                  </View>
                </TouchableOpacity>
              )) : (
                <Text style={styles.noMentionResults}>Eşleşen grup üyesi yok</Text>
              )}
            </ScrollView>
          </View>
        )}

        {/* Reply context line */}
        {replyToId && !readOnly && (
          <View className="flex-row items-center justify-between bg-white/5 px-3 py-1.5 rounded-t-xl border border-white/10 border-b-0">
            <Text className="text-[10px] text-white/50">
              @{replyTarget?.user?.handle || replyTarget?.user?.name || "member"} yanıtlanıyor
            </Text>
            <TouchableOpacity onPress={() => setReplyToId(null)}>
              <Text className="text-[10px] text-white/40 font-bold">İptal</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Comment Input */}
        {!readOnly && (
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={handleInputChange}
              onSelectionChange={({ nativeEvent }) => {
                setSelection(nativeEvent.selection);
                setActiveMention(getActiveMention(text, nativeEvent.selection.start));
              }}
              selection={selection}
              placeholder={replyToId ? "Yanıt ekle..." : "Yorum ekle..."}
              placeholderTextColor="rgba(255,255,255,0.3)"
              style={styles.textInput}
              maxLength={500}
            />
            <TouchableOpacity 
              disabled={!text.trim() || submitting} 
              onPress={handleSend}
              style={[styles.sendBtn, !text.trim() && { opacity: 0.5 }]}
            >
              {submitting ? (
                <ActionProgress label="" compact color="#000" />
              ) : (
                <Send size={14} color="#000" strokeWidth={2.5} />
              )}
            </TouchableOpacity>
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
  sheetHeader: {
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  list: {
    flex: 1, // Constrains the list height so input stays pinned inside container bounds
  },
  listContainer: {
    paddingVertical: 12,
  },
  commentGroup: {
    marginBottom: 14,
  },
  commentBubble: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  highlightedComment: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderRadius: 16,
    padding: 4,
  },
  bubbleContent: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  bubbleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  commentActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 6,
    minHeight: 16,
  },
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  likeButtonPending: {
    opacity: 0.55,
  },
  likeCount: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 10,
  },
  likeCountActive: {
    color: ACCENT,
  },
  replyBubble: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    marginTop: 8,
  },
  replyLine: {
    position: "absolute",
    left: -18,
    top: -4,
    bottom: "50%",
    width: 14,
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: "rgba(255,255,255,0.1)",
    borderBottomLeftRadius: 6,
  },
  mentionBox: {
    backgroundColor: "#161618",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    maxHeight: 244,
    padding: 8,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  mentionHeading: {
    color: "rgba(255,255,255,0.42)",
    fontSize: 10,
    letterSpacing: 0.8,
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 6,
  },
  mentionList: {
    maxHeight: 196,
  },
  mentionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 8,
  },
  mentionIdentity: {
    flex: 1,
  },
  mentionName: {
    color: "#fff",
    fontSize: 12,
  },
  mentionHandle: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 10,
    marginTop: 1,
  },
  noMentionResults: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  commentText: {
    lineHeight: 18,
  },
  mentionText: {
    color: "#d9dcff",
    backgroundColor: "rgba(88,101,242,0.38)",
    fontFamily: "Satoshi-Medium",
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  textInput: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
    height: 40,
    paddingHorizontal: 16,
    color: "#fff",
    fontSize: 12,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
});
