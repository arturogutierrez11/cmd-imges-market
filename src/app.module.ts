import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ImagesModule } from "./images/images.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    ImagesModule
  ]
})
export class AppModule {}
