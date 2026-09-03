import React from 'react';
import { View, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { RefreshCw, Check } from 'lucide-react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { Text } from '../ui/Text';
import { ACCENT } from '../../lib/theme';
import { selectionTick } from '../../lib/haptics';

interface PromptSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activePrompt: string;
  skipsLeft: number;
  isSkipping: boolean;
  onSkip: () => void;
  onAccept: (prompt: string) => void;
}

export function PromptSheet({ isOpen, onClose, activePrompt, skipsLeft, isSkipping, onSkip, onAccept }: PromptSheetProps) {
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} heightPercent={0.4}>
      <View style={{ padding: 24, alignItems: 'center' }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
          <Image source={require('../../../assets/icons/star.png')} style={{ width: 32, height: 32 }} />
        </View>
        <Text weight="bold" style={{ fontSize: 24, color: '#fff', textAlign: 'center', marginBottom: 8, letterSpacing: -0.5 }}>Günün Görevi</Text>
        <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 32, minHeight: 48, lineHeight: 22 }}>
          "{activePrompt}"
        </Text>
        <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
          <TouchableOpacity 
            onPress={onSkip} 
            disabled={skipsLeft === 0 || isSkipping}
            activeOpacity={0.7} 
            style={{ flex: 1, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: skipsLeft === 0 ? 0.4 : 1 }}
          >
            {isSkipping ? <ActivityIndicator size="small" color="#fff" /> : (
              <>
                <RefreshCw size={14} color="#fff" />
                <Text weight="bold" style={{ color: '#fff', fontSize: 13 }}>Değiştir ({skipsLeft})</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { selectionTick(); onAccept(activePrompt); onClose(); }}
            activeOpacity={0.8}
            style={{ flex: 1.5, backgroundColor: ACCENT, borderRadius: 16, height: 52, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, shadowColor: ACCENT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
          >
            <Check size={16} color="#000" strokeWidth={3} />
            <Text weight="bold" style={{ color: '#000', fontSize: 14 }}>Kabul Et</Text>
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheet>
  );
}