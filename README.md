# Ciclos — Portal de estudiantes

Proyecto académico sencillo, deliberadamente vulnerable, para ejecutar en tu propio equipo. Incluye login, panel de bienvenida y cierre de sesión. No requiere base de datos ni paquetes externos.

## Ejecutar

Requisito: Node.js 18 o superior.

1. Abre una terminal dentro de esta carpeta.
2. Ejecuta `npm start` (también puedes usar `node server.js`).
3. Abre http://127.0.0.1:3000 en el navegador.
4. Para detener el servidor, presiona Ctrl+C en la terminal.

Cuenta ficticia: **estudiante** / **ciclos123**.

## 5. Intercepción en texto claro

El servidor usa HTTP sin TLS. El navegador envía usuario y contraseña en el cuerpo JSON de `POST /api/login`, sin cifrado de transporte. El campo de contraseña oculta los caracteres en pantalla, pero no cifra el tráfico.

Evidencia sencilla: abre las herramientas del navegador (F12), entra en Red/Network y realiza un login. Selecciona `/api/login` y revisa Payload/Carga útil: se leen ambas credenciales. Esto muestra el contenido enviado; una captura de tráfico de la interfaz de loopback permite comprobarlo también en tránsito.

Corrección propuesta: usar HTTPS con un certificado válido y redirigir HTTP a HTTPS.

## 6. Login sin límites

El servidor no cuenta intentos fallidos, no bloquea cuentas y no aplica límites por usuario o cliente. Cada solicitud con contraseña incorrecta recibe HTTP 401 y se puede repetir. El contador de pantalla solo informa y no aplica protección.

Evidencia sencilla: usa `estudiante` con una contraseña incorrecta repetidas veces; después utiliza `ciclos123`. El acceso sigue permitido sin periodo de espera ni bloqueo.

Corrección propuesta: limitar solicitudes, introducir esperas progresivas y bloqueos temporales, con registro y monitoreo de fallos.

## Alcance

Escucha solo en `127.0.0.1`. Usa datos ficticios y mantenlo como práctica local. Las sesiones duran 30 minutos y se eliminan al reiniciar. Las contraseñas se comparan mediante scrypt; la vulnerabilidad de texto claro está en el transporte HTTP.

## Archivos

- `server.js`: servidor HTTP, autenticación y sesiones en memoria. Las dos vulnerabilidades están señaladas en comentarios.
- `index.html`: interfaz en español, sin librerías externas.
- `package.json`: comando de arranque.
