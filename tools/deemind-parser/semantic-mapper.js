// Minimal semantic mapping for MVP
// - Replace {{PRODUCT_NAME}} with Twig variable
// - Wrap <title> with trans tags

export async function mapSemantics(parsed) {
  const pages = parsed.pages.map(p => {
    let html = p.html;
    html = html.replace(/\{\{\s*PRODUCT_NAME\s*\}\}/g, '{{ product.name }}');
    html = html.replace(/<title>(.*?)<\/title>/is, (_m, p1) => `<title>{% trans %}${p1}{% endtrans %}</title>`);
    return { ...p, html };
  });
  return { ...parsed, pages };
}
