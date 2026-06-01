# CDN Images Marketplaces

API NestJS para recibir imagenes de producto por URL, redimensionarlas para marketplaces y publicarlas en un CDN.

## Endpoint

`POST /images/process`

```json
{
  "sku": "asdasd0001",
  "channel": "fravega",
  "imageUrls": [
    "https://example.com/image-1.jpg",
    "https://example.com/image-2.png"
  ]
}
```

## Endpoint OnCity

`POST /images/oncity/:sku/process`

Este flujo descarga cada imagen en el droplet dentro de `storage/oncity-images/{sku}/` y luego la sube al endpoint de OnCity/VTEX:

`POST https://marketplace.api.solediluminacion.com/oncity/images/{sku}`

Request:

```json
{
  "imageUrls": [
    "https://http2.mlstatic.com/D_616453-MLA99475100230_112025-O.webp",
    "https://http2.mlstatic.com/D_948411-MLA92559709640_092025-O.webp"
  ]
}
```

Ejemplo:

```bash
curl -X POST http://localhost:3000/images/oncity/JDCDS520/process \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrls": [
      "https://http2.mlstatic.com/D_616453-MLA99475100230_112025-O.webp",
      "https://http2.mlstatic.com/D_948411-MLA92559709640_092025-O.webp"
    ]
  }'
```

Respuesta:

```json
{
  "sku": "JDCDS520",
  "channel": "oncity",
  "count": 2,
  "images": [
    {
      "sourceUrl": "https://http2.mlstatic.com/D_616453-MLA99475100230_112025-O.webp",
      "fileName": "JDCDS520-001.webp",
      "uploadId": "JDCDS520-001",
      "localPath": "/app/storage/oncity-images/JDCDS520/JDCDS520-001.webp",
      "status": "uploaded",
      "uploadResponse": {
        "id": "JDCDS520-001.webp",
        "slug": "/assets/vtex.catalog-images/products/JDCDS520-001___hash.webp",
        "fullUrl": "https://solediluminacionyhogar602.vtexassets.com/assets/vtex.catalog-images/products/JDCDS520-001___hash.webp"
      }
    }
  ]
}
```

Respuesta:

```json
{
  "sku": "asdasd0001",
  "channel": "fravega",
  "count": 2,
  "images": [
    {
      "sourceUrl": "https://example.com/image-1.jpg",
      "fileName": "asdasd0001-fravega-001.jpg",
      "key": "fravega/asdasd0001/asdasd0001-fravega-001.jpg",
      "path": "/fravega/asdasd0001/asdasd0001-fravega-001.jpg",
      "publicUrl": "https://cdn.tudominio.com/fravega/asdasd0001/asdasd0001-fravega-001.jpg",
      "width": 1000,
      "height": 1000,
      "format": "jpeg"
    }
  ]
}
```

## Reglas Fravega / CDN

- Salida: JPG 1000x1000 px, fondo blanco, `fit: contain`.
- Nombres: `{sku}-{channel}-{numero}.jpg`.
- Key en storage/CDN: `{channel}/{sku}/{sku}-{channel}-{numero}.jpg`.

`1000x1000` cumple el minimo de Fravega y evita pasar el maximo `3000x3000`.

## Reglas OnCity / VTEX

- Descarga las imagenes originales en `storage/oncity-images/{sku}/`.
- Nombra los archivos como `{sku}-{numero}.{extension}`.
- Usa `{sku}-{numero}` como identificador al pegarle a la API de OnCity para evitar choques `409` entre varias imagenes del mismo SKU.
- Sube cada archivo como `multipart/form-data` al endpoint de OnCity/VTEX.
- Devuelve la respuesta de VTEX, incluyendo `fullUrl`.
- Si una imagen falla, no corta todo el lote: devuelve esa imagen con `status: "failed"` y sigue con las demas.

## Variables de entorno

- `PORT`: puerto HTTP. Default: `3000`.
- `STORAGE_DRIVER`: `local` o `digitalocean`. Default: `local`.
- `CDN_BASE_URL`: solo para modo local. Default: host de la request.
- `DO_SPACES_REGION`: region del Space. Ejemplo: `nyc3`.
- `DO_SPACES_ENDPOINT`: endpoint S3 compatible. Ejemplo: `https://nyc3.digitaloceanspaces.com`.
- `DO_SPACES_BUCKET`: nombre del Space.
- `DO_SPACES_KEY`: access key de DigitalOcean Spaces.
- `DO_SPACES_SECRET`: secret key de DigitalOcean Spaces.
- `DO_SPACES_CDN_URL`: URL publica del CDN. Ejemplo: `https://tu-space.nyc3.cdn.digitaloceanspaces.com` o un dominio propio.
- `ONCITY_DOWNLOAD_DIR`: carpeta local donde guardar descargas de OnCity. Default: `storage/oncity-images`.
- `ONCITY_UPLOAD_BASE_URL`: host de la API que sube a VTEX. Default: `https://marketplace.api.solediluminacion.com`.

Copiar `.env.example` a `.env` y completar credenciales:

```bash
cp .env.example .env
```

Para trabajar local, dejar:

```bash
STORAGE_DRIVER=local
```

Para subir a DigitalOcean Spaces:

```bash
STORAGE_DRIVER=digitalocean
DO_SPACES_REGION=nyc3
DO_SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
DO_SPACES_BUCKET=tu-space
DO_SPACES_KEY=tu-access-key
DO_SPACES_SECRET=tu-secret-key
DO_SPACES_CDN_URL=https://tu-space.nyc3.cdn.digitaloceanspaces.com
```

## Comandos

```bash
npm install
npm run start:dev
```

## Deploy

Ver guia para Ubuntu/DigitalOcean en `docs/deploy-ubuntu.md`.
# cmd-imges-market
