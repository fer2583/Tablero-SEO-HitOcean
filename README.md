# HitOcean SEO Control Center Automatizado

## Arquitectura

Google Sheets → Apps Script JSON API → Dashboard HTML

## Google Sheet

https://docs.google.com/spreadsheets/d/1RKWE0S9HZPCiMy_ds-5KJEaGqPVslv8C/edit?usp=sharing&ouid=103185604411661124832&rtpof=true&sd=true

## Pasos de instalación

1. Convertir el archivo en Google Sheet real.
2. Abrir **Extensiones → Apps Script**.
3. Pegar `apps-script/Code.gs`.
4. Deploy → New deployment → Web app.
5. Execute as: **Me**.
6. Who has access: **Anyone with the link**.
7. Copiar la URL terminada en `/exec`.
8. Pegar esa URL en `config.js` reemplazando:
   `PEGAR_AQUI_URL_DEL_APPS_SCRIPT_EXEC`
9. Abrir `index.html`.

## Publicación

Podés subir estos archivos a:
- Cloudflare Pages
- Netlify
- Vercel
- hosting propio
- subdominio interno

## Actualización automática

Cuando alguien modifique el Google Sheet, el tablero se actualiza al recargar o tocar **Actualizar datos**.
