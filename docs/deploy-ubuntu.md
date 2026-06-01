# Deploy Ubuntu / DigitalOcean Droplet

Dominio:

```text
cmd-images-market.loquieroaca.com
```

IP:

```text
138.197.96.108
```

El dominio ya debe resolver a la IP antes de pedir el certificado SSL.

## 1. Entrar al droplet

```bash
ssh root@138.197.96.108
```

## 2. Instalar paquetes base

```bash
apt update
apt upgrade -y
apt install -y git nginx certbot python3-certbot-nginx curl build-essential
```

## 3. Instalar Node.js 22 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node -v
npm -v
```

## 4. Instalar PM2

```bash
npm install -g pm2
```

## 5. Clonar el repo

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/arturogutierrez11/cmd-imges-market.git cmd-images-market
cd /var/www/cmd-images-market
```

## 6. Configurar variables de entorno

```bash
cp .env.example .env
nano .env
```

Ejemplo productivo:

```env
PORT=3000
STORAGE_DRIVER=digitalocean

DO_SPACES_REGION=nyc3
DO_SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
DO_SPACES_BUCKET=marketplace-product-images
DO_SPACES_KEY=tu-access-key
DO_SPACES_SECRET=tu-secret-key
DO_SPACES_CDN_URL=https://marketplace-product-images.nyc3.cdn.digitaloceanspaces.com

ONCITY_DOWNLOAD_DIR=storage/oncity-images
ONCITY_UPLOAD_BASE_URL=https://marketplace.api.solediluminacion.com
```

## 7. Instalar dependencias y compilar

```bash
npm ci
npm run build
```

## 8. Levantar con PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd
```

El comando `pm2 startup systemd` imprime otro comando con `sudo env ...`; copiarlo y ejecutarlo.

Ver logs:

```bash
pm2 logs cmd-images-market
```

## 9. Configurar Nginx

Crear el archivo:

```bash
nano /etc/nginx/sites-available/cmd-images-market
```

Contenido:

```nginx
server {
    listen 80;
    server_name cmd-images-market.loquieroaca.com;

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Activar:

```bash
ln -s /etc/nginx/sites-available/cmd-images-market /etc/nginx/sites-enabled/cmd-images-market
nginx -t
systemctl reload nginx
```

## 10. Certificado SSL

```bash
certbot --nginx -d cmd-images-market.loquieroaca.com
```

Verificar renovacion:

```bash
certbot renew --dry-run
```

## 11. Probar API

Health check basico:

```bash
curl -I https://cmd-images-market.loquieroaca.com/images/process
```

OnCity:

```bash
curl -X POST 'https://cmd-images-market.loquieroaca.com/images/oncity/JDCDS520/process' \
  -H 'Content-Type: application/json' \
  -d '{
    "imageUrls": [
      "https://http2.mlstatic.com/D_873636-MLA111403569072_052026-O.jpg"
    ]
  }'
```

Fravega:

```bash
curl -X POST 'https://cmd-images-market.loquieroaca.com/images/process' \
  -H 'Content-Type: application/json' \
  -d '{
    "sku": "JDCDS520",
    "channel": "fravega",
    "imageUrls": [
      "https://http2.mlstatic.com/D_616453-MLA99475100230_112025-O.webp"
    ]
  }'
```

## Actualizar deploy

```bash
cd /var/www/cmd-images-market
git pull
npm ci
npm run build
pm2 restart cmd-images-market
```
