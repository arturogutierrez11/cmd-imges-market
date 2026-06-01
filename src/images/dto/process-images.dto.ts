import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsString, IsUrl, MaxLength } from "class-validator";

export enum SalesChannel {
  Fravega = "fravega",
  OnCity = "oncity"
}

export class ProcessImagesDto {
  @IsString()
  @MaxLength(80)
  sku!: string;

  @IsEnum(SalesChannel)
  channel!: SalesChannel;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsUrl({ require_protocol: true }, { each: true })
  imageUrls!: string[];
}

export class ProcessOnCityImagesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsUrl({ require_protocol: true }, { each: true })
  imageUrls!: string[];
}
