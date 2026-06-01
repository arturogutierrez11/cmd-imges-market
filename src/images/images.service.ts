import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { BadRequestException, Injectable } from "@nestjs/common";
import { mkdir, writeFile } from "node:fs/promises";
import { join, posix } from "node:path";
import sharp = require("sharp");
import { ProcessImagesDto, SalesChannel } from "./dto/process-images.dto";
import {
  OnCityFailedImage,
  OnCityHostedImage,
  ProcessedImage,
  ProcessImagesResponse,
  ProcessOnCityImagesResponse
} from "./types";

interface ChannelImageRules {
  width: number;
  height: number;
  background: string;
  quality: number;
}

interface DownloadedImage {
  buffer: Buffer;
  contentType: string;
}

const CHANNEL_RULES: Record<SalesChannel, ChannelImageRules> = {
  [SalesChannel.Fravega]: {
    width: 1000,
    height: 1000,
    background: "#ffffff",
    quality: 90
  },
  [SalesChannel.OnCity]: {
    width: 1000,
    height: 1000,
    background: "#ffffff",
    quality: 90
  }
};

@Injectable()
export class ImagesService {
  async process(dto: ProcessImagesDto, baseUrl: string): Promise<ProcessImagesResponse> {
    const sku = this.normalizeSku(dto.sku);
    const images: ProcessedImage[] = [];

    for (const [index, sourceUrl] of dto.imageUrls.entries()) {
      const buffer = await this.downloadImage(sourceUrl);
      const fileName = `${sku}-${dto.channel}-${String(index + 1).padStart(3, "0")}.jpg`;
      const key = posix.join(dto.channel, sku, fileName);
      const resized = await this.resizeForChannel(buffer, dto.channel, sourceUrl);
      const storedImage = await this.storeImage(resized, key, baseUrl);

      images.push({
        sourceUrl,
        fileName,
        key,
        path: storedImage.path,
        publicUrl: storedImage.publicUrl,
        width: CHANNEL_RULES[dto.channel].width,
        height: CHANNEL_RULES[dto.channel].height,
        format: "jpeg"
      });
    }

    return {
      sku,
      channel: dto.channel,
      count: images.length,
      images
    };
  }

  async processOnCity(input: { sku: string; imageUrls: string[] }): Promise<ProcessOnCityImagesResponse> {
    const sku = this.normalizeSku(input.sku);
    const outputDir = join(process.cwd(), process.env.ONCITY_DOWNLOAD_DIR ?? "storage/oncity-images", sku);
    await mkdir(outputDir, { recursive: true });

    const images: Array<OnCityHostedImage | OnCityFailedImage> = [];

    for (const [index, sourceUrl] of input.imageUrls.entries()) {
      try {
        const downloadedImage = await this.downloadImageWithContentType(sourceUrl);
        const extension = this.extensionForContentType(downloadedImage.contentType, sourceUrl);
        const sequence = String(index + 1).padStart(3, "0");
        const uploadId = `${sku}-${sequence}`;
        const fileName = `${uploadId}.${extension}`;
        const localPath = join(outputDir, fileName);

        await writeFile(localPath, downloadedImage.buffer);

        const uploadResponse = await this.uploadToOnCityVtex({
          uploadId,
          fileName,
          buffer: downloadedImage.buffer,
          contentType: downloadedImage.contentType
        });

        images.push({
          sourceUrl,
          fileName,
          uploadId,
          localPath,
          status: "uploaded",
          uploadResponse
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "error desconocido";
        images.push({
          sourceUrl,
          status: "failed",
          error: message
        });
      }
    }

    const uploadedCount = images.filter((image) => image.status === "uploaded").length;

    return {
      sku,
      channel: SalesChannel.OnCity,
      count: images.length,
      uploadedCount,
      failedCount: images.length - uploadedCount,
      images
    };
  }

  private async storeImage(buffer: Buffer, key: string, baseUrl: string): Promise<{ path: string; publicUrl: string }> {
    const driver = process.env.STORAGE_DRIVER ?? "local";

    if (driver === "digitalocean") {
      return this.uploadToDigitalOcean(buffer, key);
    }

    if (driver !== "local") {
      throw new BadRequestException(`Storage driver no soportado: ${driver}`);
    }

    return this.storeLocally(buffer, key, baseUrl);
  }

  private async storeLocally(buffer: Buffer, key: string, baseUrl: string): Promise<{ path: string; publicUrl: string }> {
    const outputPath = join(process.cwd(), "public", "cdn", ...key.split("/"));
    await mkdir(join(outputPath, ".."), { recursive: true });
    await writeFile(outputPath, buffer);

    const publicPath = posix.join("cdn", key);
    return {
      path: `/${publicPath}`,
      publicUrl: `${baseUrl.replace(/\/$/, "")}/${publicPath}`
    };
  }

  private async uploadToDigitalOcean(buffer: Buffer, key: string): Promise<{ path: string; publicUrl: string }> {
    const bucket = this.requiredEnv("DO_SPACES_BUCKET");
    const region = this.requiredEnv("DO_SPACES_REGION");
    const endpoint = process.env.DO_SPACES_ENDPOINT ?? `https://${region}.digitaloceanspaces.com`;
    const accessKeyId = this.requiredEnv("DO_SPACES_KEY");
    const secretAccessKey = this.requiredEnv("DO_SPACES_SECRET");
    const cdnBaseUrl = this.requiredEnv("DO_SPACES_CDN_URL").replace(/\/$/, "");

    const client = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    });

    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ACL: "public-read",
          ContentType: "image/jpeg",
          CacheControl: "public, max-age=31536000, immutable"
        })
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "error desconocido";
      throw new BadRequestException(`No se pudo subir la imagen a DigitalOcean Spaces: ${message}`);
    }

    return {
      path: `/${key}`,
      publicUrl: `${cdnBaseUrl}/${key}`
    };
  }

  private async downloadImage(url: string): Promise<Buffer> {
    const downloadedImage = await this.downloadImageWithContentType(url);
    return downloadedImage.buffer;
  }

  private async downloadImageWithContentType(url: string): Promise<DownloadedImage> {
    let response: Response;

    try {
      response = await fetch(url, {
        headers: {
          accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          "user-agent": "cdn-images-marketplaces/0.1"
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "error desconocido";
      throw new BadRequestException(`No se pudo descargar la imagen ${url}: ${message}`);
    }

    if (!response.ok) {
      throw new BadRequestException(`No se pudo descargar la imagen: ${url}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      throw new BadRequestException(`La URL no devolvio una imagen valida: ${url}`);
    }

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      contentType
    };
  }

  private async uploadToOnCityVtex(input: {
    uploadId: string;
    fileName: string;
    buffer: Buffer;
    contentType: string;
  }): Promise<{ id: string; slug: string; fullUrl: string }> {
    const uploadBaseUrl = (process.env.ONCITY_UPLOAD_BASE_URL ?? "https://marketplace.api.solediluminacion.com").replace(
      /\/$/,
      ""
    );
    const uploadUrl = `${uploadBaseUrl}/oncity/images/${input.uploadId}`;
    const formData = new FormData();
    const arrayBuffer = new ArrayBuffer(input.buffer.length);
    new Uint8Array(arrayBuffer).set(input.buffer);
    const blob = new Blob([arrayBuffer], { type: input.contentType });

    formData.append("file", blob, input.fileName);

    let response: Response;

    try {
      response = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          accept: "*/*"
        },
        body: formData
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "error desconocido";
      throw new BadRequestException(`No se pudo subir la imagen a OnCity/VTEX: ${message}`);
    }

    const responseText = await response.text();

    if (!response.ok) {
      throw new BadRequestException(`OnCity/VTEX rechazo la imagen ${input.fileName}: ${responseText}`);
    }

    try {
      return JSON.parse(responseText) as { id: string; slug: string; fullUrl: string };
    } catch {
      throw new BadRequestException(`OnCity/VTEX devolvio una respuesta invalida: ${responseText}`);
    }
  }

  private extensionForContentType(contentType: string, sourceUrl: string): string {
    if (contentType.includes("webp")) {
      return "webp";
    }

    if (contentType.includes("jpeg") || contentType.includes("jpg")) {
      return "jpg";
    }

    if (contentType.includes("png")) {
      return "png";
    }

    const extension = new URL(sourceUrl).pathname.split(".").pop()?.toLowerCase();
    return extension && /^[a-z0-9]+$/.test(extension) ? extension : "img";
  }

  private async resizeForChannel(buffer: Buffer, channel: SalesChannel, sourceUrl: string): Promise<Buffer> {
    const rules = CHANNEL_RULES[channel];

    try {
      return await sharp(buffer, { failOn: "none" })
        .rotate()
        .resize(rules.width, rules.height, {
          fit: "contain",
          background: rules.background,
          withoutEnlargement: false
        })
        .jpeg({
          quality: rules.quality,
          mozjpeg: true
        })
        .toBuffer();
    } catch (error) {
      const message = error instanceof Error ? error.message : "error desconocido";
      throw new BadRequestException(`No se pudo procesar la imagen ${sourceUrl}: ${message}`);
    }
  }

  private normalizeSku(sku: string): string {
    const normalized = sku
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .slice(0, 80);

    if (!normalized) {
      throw new BadRequestException("El SKU no contiene caracteres validos.");
    }

    return normalized;
  }

  private requiredEnv(name: string): string {
    const value = process.env[name];

    if (!value) {
      throw new BadRequestException(`Falta configurar la variable de entorno ${name}.`);
    }

    return value;
  }
}
