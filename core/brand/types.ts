export type BrandPreset = {
  slug: string;
  name: string;
  colors: Record<string, string>;
  fonts: string[];
  source?: {
    html?: string;
    extractedAt?: string;
  };
};

export type BrandPresetSummary = BrandPreset & {
  createdAt?: string;
};
