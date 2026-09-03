import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { savePendingGroupInvite } from '../../src/lib/pendingGroupInvite';
import { ACCENT } from '../../src/lib/theme';

export default function GroupInviteRoute() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string | string[] }>();

  useEffect(() => {
    const processInvite = () => {
      const rawCode = Array.isArray(code) ? code[0] : code;
      if (rawCode) savePendingGroupInvite(rawCode);

      // Let the root auth gate verify email and durable profile completion
      // before the invite is allowed to enter protected app screens.
      router.replace('/');
    };

    processInvite();
  }, [code, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={ACCENT} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
});
