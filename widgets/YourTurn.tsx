import { Circle, HStack, Image, ProgressView, Rectangle, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  background,
  containerBackground,
  cornerRadius,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  minimumScaleFactor,
  padding,
  progressViewStyle,
  strokeBorder,
  tint,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

const YourTurnWidget = (props: any, env: WidgetEnvironment) => {
  'widget';

  const accent = '#E07C30';
  const card = '#171716';
  const surface = '#0E0E0ECC';
  const muted = '#A6A3A0';
  const border = '#FFFFFF12';
  const clipsRecorded = props.clipsRecorded || 0;
  const clipsGoal = props.clipsGoal || 12;

  return (
    <ZStack modifiers={[
      frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }),
      background(card),
      strokeBorder({ color: border, style: { lineWidth: 1 }, shape: 'containerRelativeShape' }),
      containerBackground(card, 'widget'),
      widgetURL('myturn://record'),
    ]}>
      <Rectangle modifiers={[
        frame({ maxWidth: Infinity, maxHeight: Infinity }),
        foregroundStyle({ type: 'linearGradient', colors: ['#24211E', card, '#101010'], startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } }),
      ]} />
      <VStack alignment="leading" spacing={0} modifiers={[padding({ all: 13 }), frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' })]}>
      {!props.isAuthenticated ? (
        <VStack alignment="center" spacing={7} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'center' })]}>
          <ZStack>
            <Circle modifiers={[frame({ width: 42, height: 42 }), foregroundStyle('#242321')]} />
            <Image systemName="person.crop.circle.badge.checkmark" modifiers={[font({ size: 22 }), foregroundStyle(accent)]} />
          </ZStack>
          <Text modifiers={[font({ size: 14, weight: 'bold', design: 'rounded' }), foregroundStyle('white')]}>Your turn awaits</Text>
          <Text modifiers={[font({ size: 9, design: 'rounded' }), foregroundStyle(muted)]}>Sign in to join your circle</Text>
        </VStack>
      ) : !props.hasActiveGroup ? (
        <VStack alignment="center" spacing={7} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'center' })]}>
          <Image systemName="person.3.fill" modifiers={[font({ size: 27 }), foregroundStyle(accent)]} />
          <Text modifiers={[font({ size: 14, weight: 'bold', design: 'rounded' }), foregroundStyle('white')]}>Find your people</Text>
          <Text modifiers={[font({ size: 9, design: 'rounded' }), foregroundStyle(muted)]}>Join a group to take a turn</Text>
        </VStack>
      ) : !props.hasTodayAssignment ? (
        <VStack alignment="center" spacing={7} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'center' })]}>
          <Image systemName="hourglass" modifiers={[font({ size: 25 }), foregroundStyle(accent)]} />
          <Text modifiers={[font({ size: 14, weight: 'bold', design: 'rounded' }), foregroundStyle('white')]}>Next turn soon</Text>
          <Text modifiers={[font({ size: 9, design: 'rounded' }), foregroundStyle(muted)]}>We’ll show it here when ready</Text>
        </VStack>
      ) : (
        <VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
          <HStack spacing={5}>
            <Image systemName="camera.aperture" modifiers={[font({ size: 10, weight: 'semibold' }), foregroundStyle('#D0CECB')]} />
            <Text modifiers={[font({ size: 11, weight: 'medium', design: 'rounded' }), foregroundStyle(muted)]}>MyTurn</Text>
          </HStack>

          <Spacer />

          <VStack alignment="center" spacing={2} modifiers={[frame({ maxWidth: Infinity })]}>
            <Text modifiers={[font({ size: props.isCurrentUserVlogger ? 17 : 14, weight: 'bold', design: 'rounded' }), foregroundStyle('white'), lineLimit(1), minimumScaleFactor(0.68)]}>
              {props.isCurrentUserVlogger ? "It’s Your Turn" : `${props.vloggerName || 'A friend'} is vlogging`}
            </Text>
            <Text modifiers={[font({ size: 19, weight: 'bold', design: 'rounded' }), foregroundStyle(accent)]}>
              {props.isCurrentUserVlogger ? 'Today!' : 'Join the story'}
            </Text>
          </VStack>

          <Spacer />

          <VStack alignment="leading" spacing={6} modifiers={[frame({ maxWidth: Infinity })]}>
            <HStack spacing={3}>
              <Text modifiers={[font({ size: 10, weight: 'bold', design: 'rounded' }), foregroundStyle(accent)]}>{clipsRecorded} / {clipsGoal}</Text>
              <Text modifiers={[font({ size: 9, weight: 'medium', design: 'rounded' }), foregroundStyle(muted)]}>clips recorded</Text>
            </HStack>
            <ProgressView
              value={(props.storyProgressPercent || 0) / 100}
              modifiers={[progressViewStyle('linear'), tint(accent), frame({ maxWidth: Infinity })]}
            />
          </VStack>

          <HStack modifiers={[
            frame({ maxWidth: Infinity, height: 34, alignment: 'center' }),
            background(props.isCurrentUserVlogger ? '#E07C3024' : surface),
            strokeBorder({ color: props.isCurrentUserVlogger ? '#E07C3055' : border, style: { lineWidth: 1 }, shape: 'capsule' }),
            cornerRadius(17),
            padding({ top: 9 }),
          ]}>
            <Image systemName={props.isCurrentUserVlogger ? 'camera.fill' : 'photo.badge.plus'} modifiers={[font({ size: 16, weight: 'semibold' }), foregroundStyle(accent)]} />
          </HStack>
        </VStack>
      )}
      </VStack>
    </ZStack>
  );
};

export default createWidget('YourTurn', YourTurnWidget);
