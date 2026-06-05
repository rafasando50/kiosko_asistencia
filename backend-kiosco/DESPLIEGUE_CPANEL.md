# 🚀 Guía de Despliegue en Banahosting (cPanel)

Esta guía te llevará de la mano, paso a paso, para desplegar tu backend ligero en el panel **Setup Node.js App** de Banahosting y conectar tu frontend de React Web.

---

## 🗄️ Paso 1: Configurar la Base de Datos en cPanel

1. **Ingresa a tu cPanel** de Banahosting.
2. Ve a la sección **Bases de datos** ➔ **Bases de datos MySQL**.
3. **Crear una base de datos:**
   * Escribe un nombre para tu base de datos (ej. `kiosko_facial`) y haz clic en **Crear una base de datos**.
4. **Crear un usuario de base de datos:**
   * En "Usuarios MySQL ➔ Añadir nuevo usuario", introduce un nombre de usuario (ej. `kiosko_user`) y una contraseña segura. Apúntalos, los usaremos más adelante.
5. **Asociar el usuario a la base de datos:**
   * En "Añadir usuario a la base de datos", selecciona el usuario y la base de datos creados, haz clic en **Añadir**.
   * Marca la casilla de **TODOS LOS PRIVILEGIOS** y confirma los cambios.
6. **Ejecutar el script SQL:**
   * Ve al panel de cPanel ➔ **phpMyAdmin**.
   * Selecciona tu base de datos recién creada en la columna izquierda.
   * Haz clic en la pestaña **SQL** en el menú superior.
   * Abre tu archivo [db_setup.sql](file:///c:/Users/LAP011/Documents/backend-kiosco/db_setup.sql) local, copia las consultas de alteración y ejecútalas presionando **Continuar**.

---

## 📦 Paso 2: Preparar los Archivos del Backend para Subir

1. **Generar los descriptores faciales locales:**
   En tu computadora local, abre una terminal en la carpeta del backend y ejecuta el generador:
   ```bash
   node generar-descriptores.js
   ```
   Esto procesará las fotos de `caras_referencia/` y creará la carpeta `caras_referencia_descriptores/` conteniendo archivos `.json` con el vector de 128 flotantes por cada rostro.

2. **Crear el archivo ZIP para subir:**
   En tu computadora local, crea un archivo comprimido `.zip` que contenga únicamente los siguientes elementos de tu carpeta de backend:
   - El archivo `package.json` (Asegúrate de quitar `canvas`, `@vladmandic/face-api` y `@tensorflow/tfjs` de las dependencies, dejando solo `express`, `cors`, `mysql2`).
   - El archivo `server-cpanel.js` (Tu archivo de servidor ligero).
   - La carpeta **`caras_referencia_descriptores/`** recién generada (con los archivos JSON adentro).

*⚠️ Nota: **NO incluyas** la carpeta `node_modules` ni la carpeta original `caras_referencia/` con las fotos pesadas. cPanel se encargará de instalar las dependencias automáticamente y de esta forma evitamos subir fotos reales del personal al hosting compartido por temas de privacidad y rendimiento.*

---

## 🚀 Paso 3: Inicializar la App en "Setup Node.js App" de cPanel

1. En tu cPanel de Banahosting, ve a la sección **Software** ➔ **Setup Node.js App**.
2. Haz clic en el botón **Create Application** (Crear aplicación) en la esquina superior derecha.
3. Rellena los campos del formulario con los siguientes valores:
   * **Node.js version:** Selecciona la versión estable más reciente disponible (ej: `20.x` o `22.x`).
   * **Application mode:** Selecciona **Production** (Producción).
   * **Application root:** Escribe el nombre de la carpeta donde se subirán tus archivos dentro del servidor (ej: `api-kiosco`).
   * **Application URL:** Selecciona el dominio o subdominio y la ruta donde responderá tu API (ej: `midominio.com/api`). Si quieres que responda directamente en la raíz de un subdominio (ej: `api.midominio.com`), déjalo vacío.
   * **Application startup file:** Escribe **`server-cpanel.js`** (nuestro archivo de servidor ligero).
4. Haz clic en **CREATE** (Crear) en la esquina superior derecha.
5. La página se recargará y la aplicación se detendrá temporalmente.

---

## 📁 Paso 4: Subir los Archivos al Servidor

1. Ve a tu cPanel ➔ **Administrador de Archivos** (File Manager).
2. Verás que se ha creado una nueva carpeta llamada `api-kiosco` (o el nombre que hayas puesto en *Application root*).
3. Entra a esa carpeta. Si hay un archivo llamado `app.js`, elimínalo.
4. Sube tu archivo `.zip` que preparaste en el **Paso 2** a esta carpeta y extráelo (Extract).
5. Asegúrate de que `package.json`, `server-cpanel.js` y la carpeta `caras_referencia_descriptores/` queden guardados directamente en la raíz de esa carpeta.

---

## 🛠️ Paso 5: Instalar Dependencias y Configurar Variables de Entorno

1. Regresa a **Setup Node.js App** en cPanel y haz clic en el icono del lápiz para **Editar** tu aplicación.
2. Baja a la sección **Environment variables** (Variables de entorno) y haz clic en **ADD VARIABLE**. Agrega las siguientes variables una por una:
   * `DB_HOST` = `localhost` (en Banahosting la BD corre localmente en el mismo servidor)
   * `DB_USER` = *El usuario MySQL completo de cPanel (ej. `miusuario_kiosko_user`)*
   * `DB_PASSWORD` = *La contraseña del usuario de BD que guardaste en el Paso 1*
   * `DB_NAME` = *El nombre de la BD completa de cPanel (ej. `miusuario_kiosko_facial`)*
   * `PORT` = `3000` (el puerto interno)
3. Presiona **SAVE** (Guardar).
4. Sube a la sección superior y verás un botón que dice **Run NPM Install**. ¡Haz clic en él!
   * cPanel comenzará a leer tu `package.json` e instalará `express`, `cors` y `mysql2` directamente en el servidor. Esto tardará unos 30 segundos.
5. Una vez que termine, haz clic en **START APPLICATION** (o **RESTART** si ya estaba encendida) en la parte superior derecha.
6. ¡Listo! Tu API backend de reconocimiento facial ya está en vivo en producción en tu dominio de Banahosting. Puedes probarla abriendo tu URL en el navegador (ej: `https://midominio.com/api`). Debería mostrar el mensaje:
   > *"Servidor Kiosco Facial (cPanel Light) corriendo perfectamente 🚀"*

---

## 💻 Paso 6: Compilar y Desplegar el Frontend Web (React)

1. En tu computadora local, abre tu proyecto de React Web: [App.jsx](file:///c:/Users/LAP011/Documents/web-kiosco/src/App.jsx).
2. **Prueba local:**
   * Abre una terminal en `c:\Users\LAP011\Documents\web-kiosco` y ejecuta:
     ```bash
     npm run dev
     ```
   * Abre el enlace en tu navegador. Entra a la rueda de **Configuración** arriba a la derecha y coloca la URL de tu API: `http://localhost:3000` para probar localmente con tu servidor.
3. **Despliegue a Producción:**
   * Cuando estés listo para subir la web, cambia la URL del Backend en los ajustes a la de producción de Banahosting (ej. `https://midominio.com/api`).
   * Corre el compilador en tu terminal:
     ```bash
     npm run build
     ```
   * Esto generará una carpeta llamada **`dist`** en tu proyecto de React.
   * Comprime el contenido de la carpeta `dist` en un `.zip`.
   * En tu cPanel ➔ **Administrador de Archivos**, ve a la carpeta de tu dominio principal (usualmente `public_html`) o crea una carpeta específica para el kiosco.
   * Sube el `.zip` de la carpeta `dist` y extráelo ahí.
   * ¡Tu Kiosco Web de Asistencia Facial con detección de vida activa por parpadeo ya estará en vivo y listo para toda tu empresa! 🎯
