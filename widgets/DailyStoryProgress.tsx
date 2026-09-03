import { Circle, Gauge, HStack, Image, Rectangle, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  background,
  containerBackground,
  cornerRadius,
  font,
  foregroundStyle,
  frame,
  gaugeStyle,
  monospacedDigit,
  padding,
  strokeBorder,
  tint,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

const DailyStoryProgressWidget = (props: any, env: WidgetEnvironment) => {
  'widget';

  const accent = '#E07C30';
  const card = '#171716';
  const surface = '#0E0E0ECC';
  const elevated = '#242321';
  const muted = '#A6A3A0';
  const border = '#FFFFFF12';
  const progress = props.storyProgressPercent || 0;

  return (
    <ZStack modifiers={[
      frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }),
      background(card),
      strokeBorder({ color: border, style: { lineWidth: 1 }, shape: 'containerRelativeShape' }),
      containerBackground(card, 'widget'),
      widgetURL('myturn://today'),
    ]}>
      <Rectangle modifiers={[
        frame({ maxWidth: Infinity, maxHeight: Infinity }),
        foregroundStyle({ type: 'linearGradient', colors: ['#24211E', card, '#101010'], startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } }),
      ]} />
      <VStack alignment="leading" spacing={0} modifiers={[padding({ all: 13 }), frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' })]}>
      {!props.isAuthenticated ? (
        <VStack alignment="center" spacing={7} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'center' })]}>
          <ZStack>
            <Circle modifiers={[frame({ width: 42, height: 42 }), foregroundStyle(elevated)]} />
            <Image systemName="chart.pie.fill" modifiers={[font({ size: 22 }), foregroundStyle(accent)]} />
          </ZStack>
          <Text modifiers={[font({ size: 14, weight: 'bold', design: 'rounded' }), foregroundStyle('white')]}>Today at a glance</Text>
          <Text modifiers={[font({ size: 9, design: 'rounded' }), foregroundStyle(muted)]}>Sign in to follow your story</Text>
        </VStack>
      ) : !props.hasActiveGroup ? (
        <VStack alignment="center" spacing={7} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'center' })]}>
          <Image systemName="person.2.fill" modifiers={[font({ size: 27 }), foregroundStyle(accent)]} />
          <Text modifiers={[font({ size: 14, weight: 'bold', design: 'rounded' }), foregroundStyle('white')]}>Build a story</Text>
          <Text modifiers={[font({ size: 9, design: 'rounded' }), foregroundStyle(muted)]}>Create or join a group first</Text>
        </VStack>
      ) : !props.hasTodayAssignment ? (
        <VStack alignment="center" spacing={7} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'center' })]}>
          <Image systemName="moon.stars.fill" modifiers={[font({ size: 27 }), foregroundStyle(accent)]} />
          <Text modifiers={[font({ size: 14, weight: 'bold', design: 'rounded' }), foregroundStyle('white')]}>Story not started</Text>
          <Text modifiers={[font({ size: 9, design: 'rounded' }), foregroundStyle(muted)]}>Today’s progress will appear here</Text>
        </VStack>
      ) : (
        <VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
          <HStack spacing={5}>
            <Image systemName="camera.aperture" modifiers={[font({ size: 10, weight: 'semibold' }), foregroundStyle('#D0CECB')]} />
            <Text modifiers={[font({ size: 11, weight: 'medium', design: 'rounded' }), foregroundStyle(muted)]}>MyTurn</Text>
          </HStack>

          <Spacer />

          <Text modifiers={[font({ size: 15, weight: 'bold', design: 'rounded' }), foregroundStyle('white'), frame({ maxWidth: Infinity, alignment: 'center' })]}>Today’s Story</Text>

          <ZStack modifiers={[frame({ maxWidth: Infinity, alignment: 'center' })]}>
            <Gauge
              value={progress}
              min={0}
              max={100}
              modifiers={[
                gaugeStyle('circularCapacity'),
                tint(accent),
                frame({ width: 67, height: 67 }),
              ]}
            />
            <VStack spacing={0}>
              <Text modifiers={[font({ size: 16, weight: 'bold', design: 'rounded' }), foregroundStyle('white')]}>{`${progress}%`}</Text>
              <Text modifiers={[font({ size: 7, weight: 'medium', design: 'rounded' }), foregroundStyle(muted)]}>complete</Text>
            </VStack>
          </ZStack>

          <Spacer />

          <HStack spacing={7} modifiers={[frame({ maxWidth: Infinity })]}>
            <HStack spacing={5} modifiers={[frame({ maxWidth: Infinity, height: 26, alignment: 'center' }), background(surface), cornerRadius(10)]}>
              <Image systemName="video.fill" modifiers={[font({ size: 9 }), foregroundStyle('#ECEAE7')]} />
              <Text modifiers={[font({ size: 10, weight: 'bold', design: 'rounded' }), foregroundStyle('white')]}>{props.clipsRecorded || 0}</Text>
            </HStack>
            <HStack spacing={5} modifiers={[frame({ maxWidth: Infinity, height: 26, alignment: 'center' }), background(surface), cornerRadius(10)]}>
              <Image systemName="photo.fill" modifiers={[font({ size: 9 }), foregroundStyle('#ECEAE7')]} />
              <Text modifiers={[font({ size: 10, weight: 'bold', design: 'rounded' }), foregroundStyle('white')]}>{props.photosRecorded || 0}</Text>
            </HStack>
          </HStack>

          <HStack spacing={6} modifiers={[frame({ maxWidth: Infinity, height: 29, alignment: 'center' }), background(surface), cornerRadius(15), padding({ top: 6 })]}>
            <Image systemName="clock" modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(accent)]} />
            {props.countdownEndAt ? (
              <Text
                timerInterval={{ lower: env.date, upper: new Date(props.countdownEndAt) }}
                countsDown
                modifiers={[font({ size: 11, weight: 'bold', design: 'monospaced' }), monospacedDigit(), foregroundStyle(accent)]}
              />
            ) : (
              <Text modifiers={[font({ size: 11, weight: 'bold', design: 'monospaced' }), foregroundStyle(accent)]}>--:--</Text>
            )}
            <Text modifiers={[font({ size: 9, design: 'rounded' }), foregroundStyle(muted)]}>left</Text>
          </HStack>
        </VStack>
      )}
      </VStack>
    </ZStack>
  );
};

export default createWidget('DailyStoryProgress', DailyStoryProgressWidget);
