# Portal Web - U.E.N. Ivonne González Marcano

Un portal web institucional responsivo diseñado para la Unidad Educativa Nacional Ivonne González Marcano. Este sistema proporciona un entorno digital para la comunidad educativa, contando con una vista pública informativa y un panel de administración seguro para la gestión interna.

🌍 **Sitio web en vivo:** [https://uenivonnegm.vercel.app](https://uenivonnegm.vercel.app)

## 🛠️ Tecnologías Utilizadas

* **Frontend:** HTML5, Tailwind CSS y JavaScript Vanilla.
* **Backend y Base de Datos:** [Supabase](https://supabase.com/) (Gestión de base de datos y autenticación de usuarios).
* **Despliegue:** [Vercel](https://supabase.com)

## 📂 Estructura Principal del Proyecto

El proyecto sigue una arquitectura sencilla basada en archivos estáticos, dividida en la vista pública y el módulo administrativo:

* `/index.html` - Página de inicio pública.
* `/bitacora.html` - Sección pública de bitácora/noticias de la institución.
* `/admin/` - Directorio exclusivo para administradores:
  * `login.html`: Interfaz de inicio de sesión.
  * `dashboard.html`: Panel de control para la gestión de contenido.
  * `recuperar.html`: Flujo para la recuperación de contraseñas.
* `/js/` - Lógica principal de la aplicación:
  * `app.js` & `bitacora.js`: Controladores de la interfaz pública.
  * `auth.js` & `admin.js`: Manejo de sesiones, protección de rutas y panel de administración.
  * `config.js`: Credenciales y conexión directa con el cliente de Supabase.
* `/assets/` - Recursos multimedia (imágenes, escudo de la institución, íconos).

## ✨ Características Principales

* **Sistema de Autenticación:** Acceso protegido al panel de administración gestionado mediante Supabase Auth.
* **Gestión Dinámica:** El contenido (como la bitácora) se lee y administra directamente desde la base de datos de Supabase.
* **Diseño Responsivo:** Interfaz adaptable a dispositivos móviles y computadoras de escritorio.

## 🚀 Notas de Despliegue

Este proyecto no requiere de un entorno de ejecución ni de procesos de compilación (build scripts). Al estar construido con archivos estáticos (HTML, CSS, JS), basta con alojar el código fuente en cualquier servidor web o plataforma de hosting (como Vercel, Netlify o GitHub Pages) para que funcione en producción.