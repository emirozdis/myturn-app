// ./src/components/today/VideoActionBar.tsx
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Heart, MessageCircle, Camera } from 'lucide-react-native';
import { mediumTap, lightTap } from '../../lib/haptics';
import { Text } from '../ui/Text';

interface VideoActionBarProps {
  liked: boolean;
  likeCount: number;
  commentCount: number;
  photoCount: number;
  onLike: () => void;
  onOpenComments: () => void;
  onPhotoResponseClick: () => void;
  onPhotoResponseLongPress?: () => void;
}

export function VideoActionBar({
  liked,
  likeCount,
  commentCount,
  photoCount,
  onLike,
  onOpenComments,
  onPhotoResponseClick,
  onPhotoResponseLongPress,
}: VideoActionBarProps) {

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => { mediumTap(); onLike(); }} style={styles.actionBtn} activeOpacity={0.75}>
         <Heart 
           size={28} 
           color={liked ? "#ff6b6b" : "#fff"} 
           fill={liked ? "#ff6b6b" : "rgba(255, 255, 255, 0.25)"} 
         />
         <Text weight="bold" style={styles.actionText}>{likeCount}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => { lightTap(); onOpenComments(); }} style={styles.actionBtn} activeOpacity={0.75}>
         <MessageCircle 
           size={28} 
           color="#fff" 
           fill="#fff" 
         />
         <Text weight="bold" style={styles.actionText}>{commentCount}</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        onPress={() => { lightTap(); onPhotoResponseClick(); }} 
        onLongPress={() => { mediumTap(); onPhotoResponseLongPress?.(); }}
        delayLongPress={300} // comfortable hold gesture timing threshold
        style={styles.actionBtn} 
        activeOpacity={0.75}
      >
         <Camera 
           size={28} 
           color="#fff" 
           fill="#fff" 
         />
         <Text weight="bold" style={styles.actionText}>{photoCount}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 18,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.65,
    shadowRadius: 4,
    elevation: 5,
  },
  actionText: {
    fontSize: 12,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginTop: 2,
  }
});