# Ciclos — Portal de estudiantes

La rama `semgrep` contiene la resolucion de las vulnerabilidades: transmision de credenciales sin cifrado y login sin limite de intentos. La version vulnerable inicial se conserva en `main` y `nuclei`.

## Ejecutar la version corregida

Requisitos: Node.js 18 o superior y OpenSSL (incluido con Git para Windows).

```text
npm run certs
npm start
```

Abrir https://127.0.0.1:3000. Cuenta ficticia: **estudiante** / **ciclos123**.

El certificado es autofirmado y el navegador no lo considera confiable automaticamente. Solo sirve para el laboratorio; no se instala ninguna autoridad de confianza en el equipo. Para un despliegue real se necesita un certificado de una autoridad confiable. La clave y el certificado se generan en `certs/`, excluido de Git.

Detener con Ctrl+C. El protocolo anterior `http://` ya no funciona en este puerto.

## Correccion 1: HTTPS

`https.createServer` carga el certificado y la clave y exige TLS 1.2 o superior. Las cookies incluyen `Secure`, `HttpOnly` y `SameSite=Strict`.

Las herramientas del propio navegador siguen mostrando las credenciales de la solicitud. Esto no significa que viajen sin cifrar por la red.

## Correccion 2: limite de login

Se permiten cinco solicitudes de login por IP en una ventana de un minuto. Despues de cinco fallos, las siguientes solicitudes, incluso con la clave correcta, reciben HTTP 429 y `Retry-After` hasta terminar la ventana. Un login correcto reinicia el contador.

La IP se obtiene del socket, sin confiar en `X-Forwarded-For`. El estado se mantiene en memoria y se pierde al reiniciar. Es una implementacion sencilla para un proceso local; varios servidores requieren almacenamiento compartido y una politica de proxy adecuada.

## Pruebas y analisis

```text
npm test
npm run semgrep:test
npm run semgrep
```

Semgrep requiere Docker Desktop iniciado. Usa una imagen fijada por digest y las dos reglas del ejercicio. Genera `reports/semgrep.json` y `reports/semgrep.sarif`, excluidos de Git.

Las pruebas comprueban TLS con validacion del certificado, rechazo de HTTP, cinco fallos, bloqueo del sexto intento, resistencia al cambio de `X-Forwarded-For`, recuperacion al terminar el minuto, cookies seguras y cierre de sesion. El reloj del test se adelanta controladamente; la aplicacion utiliza tiempo real.

Resultado esperado: desaparece `ciclos-http-sin-tls`. La alerta `ciclos-login-revisar-limites` permanece porque identifica una ruta de auditoria, aunque exista proteccion. No se suprime ni se modifica la regla para ocultarla: la resolucion se acredita con las pruebas funcionales.

## Evidencias del informe

Comparar el analisis original (dos hallazgos) con el posterior (un punto de revision), mostrar las correcciones y adjuntar las pruebas y el commit en `semgrep`. Que un analisis termine correctamente no implica ausencia de vulnerabilidades.
