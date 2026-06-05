import { Color, BackgroundColor, Theme } from '@adobe/leonardo-contrast-colors';

// ── BRAND (green) ramp ──
// Warmer, more vivid green. Hue pushed toward 148-152° LCH.
// Multiple key colors to steer saturation in the mid-dark range.
const brandColor = new Color({
  name: 'brand',
  colorKeys: ['#15A85C', '#1DB967', '#0E7A3F'],
  colorSpace: 'LCH',
  // brand/500 = output[5] = ratio[5]. Anchor #1DB967 has ~7.1:1 contrast vs dark bg.
  // Cap top ratio at 18 to avoid hitting pure white at brand/25.
  ratios: [1.05, 1.2, 1.6, 2.8, 4.5, 7.1, 9.5, 11.5, 13.5, 15.5, 17, 18],
});

// ── GRAY (green-tinted neutral) ramp ──
// Visible green undertone at every step.
// Key: dark end has much wider lightness separation (950~L5, 900~L12, 800~L20, 700~L28)
const grayBg = new BackgroundColor({
  name: 'gray',
  // Pushed key colors greener/more saturated for visible green undertone
  colorKeys: ['#0D2215', '#2E4A38', '#578268', '#7DA593', '#B0D4C0', '#E8F5EC'],
  colorSpace: 'LCH',
  ratios: [1.05, 1.22, 1.55, 2.1, 2.85, 3.85, 5.2, 7.0, 9.0, 11.5, 14.5, 18],
});

const theme = new Theme({
  colors: [brandColor, grayBg],
  backgroundColor: grayBg,
  lightness: 4,
  contrast: 1,
});

// contrastColorValues returns a flat array: first 12 = brand, next 12 = gray
const allValues = theme.contrastColorValues;
const brandHexes = allValues.slice(0, 12);
const grayHexes = allValues.slice(12, 24);

// Map Leonardo output (dark→light, 12 values) to 25→950 scale (light→dark)
const scale = ['25', '50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

function formatRamp(values) {
  const reversed = [...values].reverse();
  const result = {};
  for (let i = 0; i < scale.length; i++) {
    result[scale[i]] = reversed[i];
  }
  return result;
}

const brandRamp = formatRamp(brandHexes);
const grayRamp = formatRamp(grayHexes);

console.log('=== BRAND RAMP ===');
for (const [step, hex] of Object.entries(brandRamp)) {
  console.log(`  brand/${step}: ${hex}`);
}

console.log('\n=== GRAY RAMP ===');
for (const [step, hex] of Object.entries(grayRamp)) {
  console.log(`  gray/${step}: ${hex}`);
}

// Export as JSON for the proof HTML
const output = { brand: brandRamp, gray: grayRamp };
console.log('\n=== JSON ===');
console.log(JSON.stringify(output, null, 2));
