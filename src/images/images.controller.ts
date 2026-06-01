import { Body, Controller, Param, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { ProcessImagesDto, ProcessOnCityImagesDto } from "./dto/process-images.dto";
import { ImagesService } from "./images.service";
import { ProcessImagesResponse, ProcessOnCityImagesResponse } from "./types";

@Controller("images")
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Post("process")
  async processImages(
    @Body() dto: ProcessImagesDto,
    @Req() request: Request
  ): Promise<ProcessImagesResponse> {
    const baseUrl = process.env.CDN_BASE_URL ?? `${request.protocol}://${request.get("host")}`;
    return this.imagesService.process(dto, baseUrl);
  }

  @Post("oncity/:sku/process")
  async processOnCityImages(
    @Param("sku") sku: string,
    @Body() dto: ProcessOnCityImagesDto
  ): Promise<ProcessOnCityImagesResponse> {
    return this.imagesService.processOnCity({ sku, imageUrls: dto.imageUrls });
  }
}
