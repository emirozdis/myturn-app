// ./src/components/today/SleepModeView.tsx

import React from "react";
import { View, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Dimensions, Platform, useWindowDimensions } from "react-native";
import { HeartHandshake, Play } from "lucide-react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../ui/Text";

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const serifFont = Platform.OS === 'ios' ? 'Georgia' : 'serif';

type SleepModeViewProps = {
  hasVolunteeredForTomorrow: boolean;
  canVolunteer: boolean;
  volunteerEligibilityReason: string;
  isVolunteering: boolean;
  volunteerError: string;
  onToggleVolunteer: () => void;
  onWatchLastVlog: () => void;
};

export function SleepModeView({
  hasVolunteeredForTomorrow,
  canVolunteer,
  volunteerEligibilityReason,
  isVolunteering,
  volunteerError,
  onToggleVolunteer,
  onWatchLastVlog,
}: SleepModeViewProps) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  // Dynamically calculate height to make the image responsive across different screen sizes
  const illustrationHeight = Math.min(400, Math.max(250, screenHeight * 0.45));
  const dynamicMarginBottom = screenHeight < 700 ? 16 : 24;

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) + 24 }]}>
      <Animated.View entering={FadeInUp.duration(600).springify().damping(24)} style={styles.content}>
        
        {/* Full-width Image Area without horizontal padding */}
        <View style={[styles.illustrationWrapper, { height: illustrationHeight, marginBottom: dynamicMarginBottom }]}>
          <Image
            source={require("../../../assets/images/today/resting.png")}
            style={styles.illustration}
            resizeMode="contain"
          />
        </View>

        {/* Text and Actions Area with horizontal padding restored */}
        <View style={styles.textAndActionContainer}>
          <Text style={[styles.title, { fontFamily: serifFont }]}>Resting Hours</Text>
          <Text style={styles.description}>
            Today's vlog has ended. Relax for now, watch today's memories, or volunteer for tomorrow.
          </Text>

          <View style={styles.actionContainer}>
            <TouchableOpacity
              onPress={onWatchLastVlog}
              activeOpacity={0.85}
              style={styles.primaryButton}
            >
              <Play size={16} color="#000" fill="#000" style={{ marginRight: 6 }} />
              <Text weight="bold" style={styles.primaryButtonText}>Watch Today's Vlog</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onToggleVolunteer}
              disabled={isVolunteering || (!canVolunteer && !hasVolunteeredForTomorrow)}
              activeOpacity={0.85}
              style={[
                styles.secondaryButton,
                hasVolunteeredForTomorrow && styles.secondaryButtonActive,
                (!canVolunteer && !hasVolunteeredForTomorrow) && { opacity: 0.5 }
              ]}
            >
              {isVolunteering ? (
                <ActivityIndicator size="small" color={hasVolunteeredForTomorrow ? "#000" : "#fff"} />
              ) : hasVolunteeredForTomorrow ? (
                <>
                  <HeartHandshake size={16} color="#000" style={{ marginRight: 8 }} />
                  <Text weight="bold" style={[styles.secondaryButtonText, { color: '#000' }]}>Volunteered</Text>
                </>
              ) : (
                <>
                  <HeartHandshake size={16} color="#fff" style={{ marginRight: 8 }} />
                  <Text weight="bold" style={styles.secondaryButtonText}>Volunteer for Tomorrow</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    alignItems: 'center',
  },
  illustrationWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustration: {
    width: '100%',
    height: '100%',
  },
  textAndActionContainer: {
    width: '100%',
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    color: '#FAF9F6',
    textAlign: 'center',
    lineHeight: 34,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
    fontFamily: 'Satoshi-Medium',
  },
  actionContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  primaryButtonText: {
    color: '#000000',
    fontSize: 15,
    fontFamily: 'Satoshi-Bold',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: 28,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  secondaryButtonActive: {
    backgroundColor: '#ffffff',
    borderColor: 'transparent',
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'Satoshi-Bold',
  }
});
