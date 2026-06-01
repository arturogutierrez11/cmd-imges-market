import { SalesChannel } from "./dto/process-images.dto";

export interface ProcessedImage {
  sourceUrl: string;
  fileName: string;
  key: string;
  path: string;
  publicUrl: string;
  width: number;
  height: number;
  format: "jpeg";
}

export interface ProcessImagesResponse {
  sku: string;
  channel: SalesChannel;
  count: number;
  images: ProcessedImage[];
}

export interface OnCityHostedImage {
  sourceUrl: string;
  fileName: string;
  uploadId: string;
  localPath: string;
  status: "uploaded";
  uploadResponse: {
    id: string;
    slug: string;
    fullUrl: string;
  };
}

export interface OnCityFailedImage {
  sourceUrl: string;
  fileName?: string;
  uploadId?: string;
  localPath?: string;
  status: "failed";
  error: string;
}

export interface ProcessOnCityImagesResponse {
  sku: string;
  channel: SalesChannel.OnCity;
  count: number;
  uploadedCount: number;
  failedCount: number;
  images: Array<OnCityHostedImage | OnCityFailedImage>;
}
