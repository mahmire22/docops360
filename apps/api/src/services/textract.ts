export interface TextractPreparationResult {
  enabled: boolean;
  provider: "textract";
  message: string;
}

export const prepareTextractExtraction = (): TextractPreparationResult => ({
  enabled: false,
  provider: "textract",
  message: "Textract integration is disabled for Phase 2."
});
