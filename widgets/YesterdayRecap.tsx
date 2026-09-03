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
  offset,
  padding,
  resizable,
  strokeBorder,
  widgetAccentedRenderingMode,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

const YesterdayRecapWidget = (props: any, env: WidgetEnvironment) => {
  'widget';

  const accent = '#E07C30';
  const card = '#171716';
  const surface = '#0E0E0EDD';
  const elevated = '#242321';
  const muted = '#A6A3A0';
  const border = '#FFFFFF12';
  const name = props.yesterdayVloggerName || 'Your circle';

  return (
    <ZStack modifiers={[
      frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }),
      background(card),
      strokeBorder({ color: border, style: { lineWidth: 1 }, shape: 'containerRelativeShape' }),
      containerBackground(card, 'widget'),
      widgetURL('myturn://streaks'),
    ]}>
      <Rectangle modifiers={[
        frame({ maxWidth: Infinity, maxHeight: Infinity }),
        foregroundStyle({ type: 'linearGradient', colors: ['#24211E', card, '#101010'], startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } }),
      ]} />
      <VStack alignment="leading" spacing={0} modifiers={[padding({ all: 17 }), frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' })]}>
      {!props.isAuthenticated ? (
        <VStack alignment="center" spacing={10} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'center' })]}>
          <ZStack>
            <Circle modifiers={[frame({ width: 58, height: 58 }), foregroundStyle(elevated)]} />
            <Image systemName="play.rectangle.fill" modifiers={[font({ size: 27 }), foregroundStyle(accent)]} />
          </ZStack>
          <Text modifiers={[font({ size: 20, weight: 'bold', design: 'rounded' }), foregroundStyle('white')]}>Your stories live here</Text>
          <Text modifiers={[font({ size: 12, design: 'rounded' }), foregroundStyle(muted)]}>Sign in to revisit moments from your circle</Text>
        </VStack>
      ) : !props.hasActiveGroup ? (
        <VStack alignment="center" spacing={10} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'center' })]}>
          <Image systemName="person.2.crop.square.stack.fill" modifiers={[font({ size: 38 }), foregroundStyle(accent)]} />
          <Text modifiers={[font({ size: 20, weight: 'bold', design: 'rounded' }), foregroundStyle('white')]}>No circle yet</Text>
          <Text modifiers={[font({ size: 12, design: 'rounded' }), foregroundStyle(muted)]}>Create or join a group to build your archive</Text>
        </VStack>
      ) : !props.hasYesterdayStory ? (
        <VStack alignment="center" spacing={9} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'center' })]}>
          <Image systemName="sparkles.rectangle.stack" modifiers={[font({ size: 37 }), foregroundStyle(accent)]} />
          <Text modifiers={[font({ size: 20, weight: 'bold', design: 'rounded' }), foregroundStyle('white')]}>No recap yet</Text>
          <Text modifiers={[font({ size: 12, design: 'rounded' }), foregroundStyle(muted)]}>Yesterday’s finished story will appear here</Text>
        </VStack>
      ) : (
        <VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
          <HStack spacing={5}>
            <Image systemName="camera.aperture" modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle('#D0CECB')]} />
            <Text modifiers={[font({ size: 12, weight: 'medium', design: 'rounded' }), foregroundStyle(muted)]}>MyTurn</Text>
          </HStack>

          <VStack alignment="leading" spacing={2} modifiers={[padding({ top: 9, bottom: 9 })]}>
            <Text modifiers={[font({ size: 19, weight: 'bold', design: 'rounded' }), foregroundStyle('white')]}>Yesterday’s Recap</Text>
            <Text modifiers={[font({ size: 12, weight: 'medium', design: 'rounded' }), foregroundStyle(muted)]}>{props.yesterdayDateText || 'Previous story'}</Text>
          </VStack>

          <ZStack alignment="bottomLeading" modifiers={[
            frame({ maxWidth: Infinity, height: 185 }),
            background(elevated),
            cornerRadius(15),
          ]}>
            {props.yesterdayThumbnailLocal ? (
              <Image uiImage={props.yesterdayThumbnailLocal} modifiers={[
                resizable(),
                aspectRatio({ contentMode: 'fill' }),
                frame({ maxWidth: Infinity, height: 185 }),
                clipShape('roundedRectangle', 15),
                widgetAccentedRenderingMode('fullColor'),
              ]} />
            ) : (
              <VStack alignment="center" spacing={7} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'center' })]}>
                <Image systemName="photo.on.rectangle.angled" modifiers={[font({ size: 32 }), foregroundStyle('#5A5753')]} />
                <Text modifiers={[font({ size: 11, design: 'rounded' }), foregroundStyle(muted)]}>{props.yesterdayClipsCount || 0} moments</Text>
              </VStack>
            )}
            <HStack spacing={5} modifiers={[padding({ horizontal: 9, vertical: 6 }), background(surface), cornerRadius(12), offset({ x: 10, y: -10 })]}>
              <Image systemName="play.fill" modifiers={[font({ size: 9, weight: 'bold' }), foregroundStyle('white')]} />
              <Text modifiers={[font({ size: 10, weight: 'bold', design: 'monospaced' }), foregroundStyle('white')]}>{props.yesterdayDuration || `${props.yesterdayClipsCount || 0} clips`}</Text>
            </HStack>
          </ZStack>

          <Spacer />

          <HStack spacing={8} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
            <ZStack>
              <Circle modifiers={[frame({ width: 27, height: 27 }), foregroundStyle(elevated)]} />
              {props.yesterdayVloggerAvatarLocal ? (
                <Image uiImage={props.yesterdayVloggerAvatarLocal} modifiers={[resizable(), aspectRatio({ contentMode: 'fill' }), frame({ width: 25, height: 25 }), clipShape('circle'), widgetAccentedRenderingMode('fullColor')]} />
              ) : (
                <Text modifiers={[font({ size: 10, weight: 'bold', design: 'rounded' }), foregroundStyle('white')]}>{name[0]}</Text>
              )}
            </ZStack>
            <Text modifiers={[font({ size: 13, weight: 'bold', design: 'rounded' }), foregroundStyle('white'), lineLimit(1), minimumScaleFactor(0.7)]}>{name}</Text>
            <Spacer />
            <Text modifiers={[font({ size: 12, weight: 'medium', design: 'rounded' }), foregroundStyle(muted)]}>Tap to watch</Text>
            <Image systemName="chevron.right" modifiers={[font({ size: 10, weight: 'semibold' }), foregroundStyle(muted)]} />
          </HStack>
        </VStack>
      )}
      </VStack>
    </ZStack>
  );
};

export default createWidget('YesterdayRecap', YesterdayRecapWidget);
