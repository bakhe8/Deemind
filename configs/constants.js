/**
 * @domain DeemindTools
 * Central constants shared across tools. Keep business-agnostic.
 */
export const I18N_TAGS = [
  'title','h1','h2','h3','h4','h5','h6','p','span','li','button','label','a','small','strong','em','option'
];
export const I18N_ATTRS = [
  'title',
  'aria-label',
  'placeholder',
  'alt',
  'aria-description',
  'aria-labelledby',
  'aria-describedby'
];

export const DEFAULT_THEME_META = Object.freeze({
  categories: ['general'],
  icon: 'assets/icon.png',
  fonts: ['Inter', 'Tajawal'],
  settings: { primaryColor: '#0046FF' }
});
