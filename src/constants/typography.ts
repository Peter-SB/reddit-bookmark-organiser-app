export const baseFontSizes = { 
  title: 18, 
  body: 14, 
  small: 12,
  xsmall: 10,
  xxsmall: 8,
  large: 20,
  xlarge: 24 
};

export const fontSizes = baseFontSizes;

export function scaledFontSizes(scale: number) {
  return {
    title: baseFontSizes.title * scale,
    body: baseFontSizes.body * scale,
    small: baseFontSizes.small * scale,
    xsmall: baseFontSizes.xsmall * scale,
    xxsmall: baseFontSizes.xxsmall * scale,
    large: baseFontSizes.large * scale,
    xlarge: baseFontSizes.xlarge * scale,
  };
}

export const fontWeights = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const fontColours = {
  foreground: '#000',
  muted: '#666',
  accent: '#007AFF',
  background: '#FFF',
};