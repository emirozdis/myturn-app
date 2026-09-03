// ./widgets/Shared.tsx
import { HStack, Text, ZStack, Image, Rectangle, Circle } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding, background, cornerRadius, frame } from '@expo/ui/swift-ui/modifiers';

export const Theme = {
  accent: '#E07C30',
  bgDark: '#111111',
  bgLight: '#1C1C1C',
  border: '#2D2D2D',
  textMuted: '#999999',
};

export const WidgetHeader = () => {
  return (
    <HStack spacing={6} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
      <ZStack>
        <Rectangle modifiers={[frame({ width: 12, height: 12 }), cornerRadius(3.5), foregroundStyle('white')]} />
        <Rectangle modifiers={[frame({ width: 9, height: 9 }), cornerRadius(2), foregroundStyle(Theme.bgDark)]} />
        <Circle modifiers={[frame({ width: 4, height: 4 }), foregroundStyle('white')]} />
      </ZStack>
      <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(Theme.textMuted)]}>MyTurn</Text>
    </HStack>
  );
};

export const StatBox = ({ icon, value }: { icon: string, value: string }) => {
  return (
    <HStack spacing={4} modifiers={[
      padding({ horizontal: 8, vertical: 6 }),
      frame({ maxWidth: Infinity }),
      background(Theme.bgLight),
      cornerRadius(8)
    ]}>
      <Image systemName={icon as any} modifiers={[font({ size: 9 }), foregroundStyle('#CCCCCC')]} />
      <Text modifiers={[font({ size: 10, weight: 'bold' }), foregroundStyle('white')]}>{value}</Text>
    </HStack>
  );
};

export const CountdownPill = ({ value }: { value: string }) => {
  return (
    <HStack spacing={4} modifiers={[
      frame({ maxWidth: Infinity, alignment: 'center' }),
      padding({ vertical: 8 }),
      background(Theme.bgLight),
      cornerRadius(14)
    ]}>
      <Image systemName="clock" modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(Theme.accent)]} />
      <Text modifiers={[font({ size: 11, weight: 'bold', design: 'monospaced' }), foregroundStyle(Theme.accent)]}>{value}</Text>
      <Text modifiers={[font({ size: 11 }), foregroundStyle(Theme.textMuted)]}>left</Text>
    </HStack>
  );
};
