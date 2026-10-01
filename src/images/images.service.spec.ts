import sharp = require("sharp");
import { SalesChannel } from "./dto/process-images.dto";
import { ImagesService } from "./images.service";

/** Una foto cuadrada como las que manda Coresa: 300x300. */
async function fotoDeCoresa(): Promise<Buffer> {
  return sharp({
    create: {
      width: 300,
      height: 300,
      channels: 3,
      background: "#cccccc"
    }
  })
    .jpeg()
    .toBuffer();
}

describe("ImagesService, canal mercadolibre", () => {
  const service = new ImagesService();
  // resizeForChannel es privado y es justo lo que hay que verificar.
  const resize = (buffer: Buffer, channel: SalesChannel): Promise<Buffer> =>
    (service as unknown as {
      resizeForChannel(b: Buffer, c: SalesChannel, url: string): Promise<Buffer>;
    }).resizeForChannel(buffer, channel, "https://s3.coresagroup.com/foto.jpg");

  it("lleva una foto de 300x300 a 1200x1200", async () => {
    // ML pide 500x500 como minimo; las de Coresa vienen en 300 y por eso
    // marco la publicacion en infraccion.
    const salida = await resize(await fotoDeCoresa(), SalesChannel.MercadoLibre);
    const meta = await sharp(salida).metadata();

    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(1200);
    expect(meta.format).toBe("jpeg");
  });

  it("no cambia el tamaño de los otros canales", async () => {
    const salida = await resize(await fotoDeCoresa(), SalesChannel.Fravega);
    const meta = await sharp(salida).metadata();

    expect(meta.width).toBe(1000);
  });
});
