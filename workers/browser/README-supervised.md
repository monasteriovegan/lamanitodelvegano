# Synthetiq Browser Worker · modo supervisado

El worker usa un escritorio X11 persistente con Chromium/Playwright y noVNC.

- `/data` conserva perfiles, cookies y screenshots.
- `VNC_PASSWORD` protege el acceso remoto.
- `DISPLAY=:99` y `BROWSER_HEADLESS=false` permiten que el mismo navegador que usa Wonka sea visible durante login/2FA.
- noVNC escucha en `6080`; Railway debe publicar ese puerto.
- CAPTCHA y 2FA siguen siendo intervención humana.
- Las credenciales no se envían a Wonka ni se guardan en los jobs.
