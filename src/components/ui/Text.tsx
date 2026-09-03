// ./src/components/ui/Text.tsx
import React, { forwardRef } from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet } from 'react-native';
import { useLanguageStore } from '../../store/useLanguageStore';
import { translateLegacy } from '../../lib/i18n';

interface TextProps extends RNTextProps {
  weight?: 'regular' | 'medium' | 'bold';
  className?: string;
}

export const Text = forwardRef<RNText, TextProps>(
  ({ weight = 'regular', className = '', style, children, ...props }, ref) => {
    const locale = useLanguageStore((state) => state.locale);
    let fontFamily = 'Satoshi-Regular';
    
    if (weight === 'medium') fontFamily = 'Satoshi-Medium';
    if (weight === 'bold') fontFamily = 'Satoshi-Bold';

    return (
      <RNText 
        ref={ref}
        className={`text-white ${className}`} 
        style={[styles.base, { fontFamily }, style]} 
        {...props}
      >
        {React.Children.map(children, (child) => typeof child === 'string' ? translateLegacy(locale, child) : child)}
      </RNText>
    );
  }
);

Text.displayName = 'Text';

const styles = StyleSheet.create({
  base: {
    // Prevents text cutoff on Android with custom fonts
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
