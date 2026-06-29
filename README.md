# HitOcean SEO Control Center V7 Client Ready

## Qué trae esta versión

- Logo de HitOcean restaurado en el menú lateral.
- Bloque de fuente de datos: SEMrush, Google Search Console, GA4, Microsoft Clarity, GTM y Google Sheets.
- Componentes independientes por menú.
- Más gráficas por componente: barras, métricas, círculos/donuts y rankings rápidos.
- Modal de edición más controlado con desplegables/opciones.
- Mensajes de guardado dentro del modal y toast visual.
- Actualización inmediata del estado local de la app después de guardar.
- Preparada para guardar en Google Sheets mediante Apps Script `doPost(e)`.

## Archivos principales

- `index.html`
- `styles.css`
- `app.js`
- `config.js`
- `services/`
- `components/`
- `assets/hitocean-logo.jpg`
- `Code.gs`

## Cómo publicar

1. Subir todos los archivos y carpetas al repo de GitHub.
2. Hacer commit.
3. Cloudflare Pages redeploya automáticamente.

## Cómo activar edición real

1. Copiar `Code.gs` en Apps Script.
2. Guardar.
3. Deploy > Manage deployments > Edit > New version.
4. Mantener acceso como Web App.
5. Probar con una URL de test.

## Nota

La lectura funciona con `DATA_URL`. La escritura usa `POST_URL`, que puede ser la misma URL `/exec` si el Apps Script contiene `doPost(e)`.
