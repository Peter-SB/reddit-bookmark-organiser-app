import { requireOptionalNativeModule } from "expo";

type MediaStoreExportModuleType = {
  // Streams `sourceFileUri` (a file:// uri) into the device's public Downloads
  // folder as `filename`, natively, without loading it into JS memory.
  // Returns a human-readable location, e.g. "Downloads/my.db".
  saveToDownloads(
    sourceFileUri: string,
    filename: string,
    mimeType: string,
  ): Promise<string>;
};

export default requireOptionalNativeModule<MediaStoreExportModuleType>(
  "MediaStoreExport",
);
