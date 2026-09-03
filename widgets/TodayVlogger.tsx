import { Circle, HStack, Image, Rectangle, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  aspectRatio,
  background,
  clipShape,
  containerBackground,
  cornerRadius,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
  offset,
  padding,
  resizable,
  strokeBorder,
  widgetAccentedRenderingMode,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

const TodayVloggerWidget = (props: any, env: WidgetEnvironment) => {
  'widget';

  const accent = '#E07C30';
  const card = '#171716';
  const surface = '#0E0E0ECC';
  const elevated = '#242321';
  const muted = '#A6A3A0';
  const border = '#FFFFFF12';
  const name = props.vloggerName || 'Today’s vlogger';

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
            <Image systemName="camera.aperture" modifiers={[font({ size: 21, weight: 'semibold' }), foregroundStyle(accent)]} />
          </ZStack>
          <Text modifiers={[font({ size: 14, weight: 'bold', design: 'rounded' }), foregroundStyle('white')]}>Welcome to MyTurn</Text>
          <Text modifiers={[font({ size: 9, weight: 'medium', design: 'rounded' }), foregroundStyle(muted)]}>Sign in to see today’s story</Text>
        </VStack>
      ) : !props.hasActiveGroup ? (
        <VStack alignment="center" spacing={7} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'center' })]}>
          <Image systemName="person.2.fill" modifiers={[font({ size: 27, weight: 'semibold' }), foregroundStyle(accent)]} />
          <Text modifiers={[font({ size: 14, weight: 'bold', design: 'rounded' }), foregroundStyle('white')]}>Start your circle</Text>
          <Text modifiers={[font({ size: 9, design: 'rounded' }), foregroundStyle(muted)]}>Create or join a group</Text>
        </VStack>
      ) : !props.hasTodayAssignment ? (
        <VStack alignment="center" spacing={7} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'center' })]}>
          <Image systemName="sun.horizon.fill" modifiers={[font({ size: 27 }), foregroundStyle(accent)]} />
          <Text modifiers={[font({ size: 14, weight: 'bold', design: 'rounded' }), foregroundStyle('white')]}>Turn pending</Text>
          <Text modifiers={[font({ size: 9, design: 'rounded' }), foregroundStyle(muted)]}>Today’s vlogger will appear here</Text>
        </VStack>
      ) : (
        <VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
          <HStack spacing={5}>
            <Image systemName="camera.aperture" modifiers={[font({ size: 10, weight: 'semibold' }), foregroundStyle('#D0CECB')]} />
            <Text modifiers={[font({ size: 11, weight: 'medium', design: 'rounded' }), foregroundStyle(muted)]}>MyTurn</Text>
          </HStack>

          <Spacer />

          <HStack spacing={10} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
            <ZStack>
              <Circle modifiers={[frame({ width: 48, height: 48 }), foregroundStyle(accent)]} />
              <Circle modifiers={[frame({ width: 44, height: 44 }), foregroundStyle(elevated)]} />
              {props.vloggerAvatarLocal ? (
                <Image uiImage={props.vloggerAvatarLocal} modifiers={[
                  resizable(),
                  aspectRatio({ contentMode: 'fill' }),
                  frame({ width: 42, height: 42 }),
                  clipShape('circle'),
                  widgetAccentedRenderingMode('fullColor'),
                ]} />
              ) : (
                <Text modifiers={[font({ size: 18, weight: 'bold', design: 'rounded' }), foregroundStyle('white')]}>{name[0]}</Text>
              )}
              <Circle modifiers={[frame({ width: 15, height: 15 }), foregroundStyle(card), offset({ x: 16, y: 16 })]} />
              <Circle modifiers={[frame({ width: 11, height: 11 }), foregroundStyle(accent), offset({ x: 16, y: 16 })]} />
            </ZStack>
            <VStack alignment="leading" spacing={3} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
              <Text modifiers={[font({ size: 16, weight: 'bold', design: 'rounded' }), foregroundStyle('white'), lineLimit(1), minimumScaleFactor(0.7)]}>{name}</Text>
              <HStack spacing={4}>
                <Circle modifiers={[frame({ width: 4, height: 4 }), foregroundStyle(accent)]} />
                <Text modifiers={[font({ size: 9, weight: 'semibold', design: 'rounded' }), foregroundStyle(accent)]}>Recording today</Text>
              </HStack>
            </VStack>
          </HStack>

          <Spacer />

          <HStack spacing={7} modifiers={[frame({ maxWidth: Infinity })]}>
            <HStack spacing={5} modifiers={[frame({ maxWidth: Infinity, height: 27, alignment: 'center' }), background(surface), cornerRadius(10)]}>
              <Image systemName="video.fill" modifiers={[font({ size: 10 }), foregroundStyle('#ECEAE7')]} />
              <Text modifiers={[font({ size: 11, weight: 'bold', design: 'rounded' }), foregroundStyle('white')]}>{props.clipsRecorded || 0}</Text>
            </HStack>
            <HStack spacing={5} modifiers={[frame({ maxWidth: Infinity, height: 27, alignment: 'center' }), background(surface), cornerRadius(10)]}>
              <Image systemName="photo.fill" modifiers={[font({ size: 10 }), foregroundStyle('#ECEAE7')]} />
              <Text modifiers={[font({ size: 11, weight: 'bold', design: 'rounded' }), foregroundStyle('white')]}>{props.photosRecorded || 0}</Text>
            </HStack>
          </HStack>

          <HStack spacing={6} modifiers={[frame({ maxWidth: Infinity, height: 30, alignment: 'center' }), background(surface), cornerRadius(15), padding({ top: 6 })]}>
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

export default createWidget('TodayVlogger', TodayVloggerWidget);
