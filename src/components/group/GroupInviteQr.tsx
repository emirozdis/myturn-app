import React from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { buildGroupInviteQrValue } from '../../lib/groupInvite';

interface GroupInviteQrProps {
  inviteCode: string;
  size?: number;
}

export function GroupInviteQr({ inviteCode, size = 132 }: GroupInviteQrProps) {
  return (
    <View style={styles.frame}>
      <QRCode
        value={buildGroupInviteQrValue(inviteCode)}
        size={size}
        color="#090909"
        backgroundColor="#ffffff"
        quietZone={8}
        ecl="M"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
});
