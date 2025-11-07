import fs from 'fs-extra';
import path from 'path';
import postcss from 'postcss';

const PROPS = new Set(['display', 'grid-template-columns', 'grid-template-rows', 'flex', 'flex-direction', 'position']);

/**
 * Extract a minimal CSS property map from inline <style> blocks.
 * Why: We only record a small set of layout-affecting props to inform
 * downstream heuristics (e.g., component signatures) without depending
 * on full CSS asset parsing at this stage.
 */
export async function extractCssMap(inputPath, pages) {
  const cssMap = {};
  // Inline <style> tags only for MVP; external assets are copied by adapter
  for (const p of pages) {
    const styles = [];
    const inlineRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let m;
    while ((m = inlineRe.exec(p.html))) {
      styles.push(m[1]);
    }
    const perPage = {};
    for (const css of styles) {
      try {
        const root = postcss.parse(css);
        root.walkRules(rule => {
          const rec = {};
          rule.walkDecls(decl => {
            if (PROPS.has(decl.prop)) rec[decl.prop] = decl.value;
          });
          if (Object.keys(rec).length) perPage[rule.selector] = { ...(perPage[rule.selector] || {}), ...rec };
        });
      } catch (e) { void e; }
    }
    cssMap[p.rel] = perPage;
  }
  return cssMap;
}
