<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Descripción



Social Media API - NestJS

Este proyecto es una API robusta para una Red Social construida con el framework [Nest](https://github.com/nestjs/nest), diseñada bajo una arquitectura modular y escalable que integra servicios líderes en la nube para ofrecer una experiencia de usuario completa y segura.

## 🚀 Características Principales

* **Autenticación Multimodal:**
    * **Tradicional:** Registro y acceso seguro con correo electrónico y contraseña utilizando JWT.
    * **OAuth2 / Social Login:** Integración  con **Google** y **Apple ID** para un inicio de sesión rápido y seguro.
* **Gestión de Contenido Multimedia:**
    * Integración con **AWS S3 (Simple Storage Service)** para el almacenamiento persistente y eficiente de imágenes, videos y archivos de perfil.
* **Sistema de Notificaciones Dual:**
    * **Notificaciones Push:** Comunicación en tiempo real con dispositivos móviles a través de **Firebase Cloud Messaging (FCM)**.
    * **Email Marketing/Transaccional:** Envío de correos automáticos (verificación, bienvenida, recuperación) mediante protocolo **SMTP**.
* **Arquitectura de Datos:**
    * Implementación de **Prisma ORM** para una gestión de base de datos eficiente, segura y altamente tipada.

## 🛠️ Stack Tecnológico

| Tecnología | Propósito |
| :--- | :--- |
| **NestJS** | Framework principal (Node.js) para una arquitectura escalable. |
| **Prisma** | ORM para el modelado y manejo de la base de datos SQL. |
| **AWS S3** | Almacenamiento de objetos y archivos multimedia. |
| **Firebase** | Gestión de Notificaciones Push (FCM). |
| **Nodemailer** | Gestión de envíos de correo electrónico vía SMTP. |
| **Passport.js** | Estrategias de autenticación (JWT, Google, Apple).


## 🚀 Características Principales

### 👤 Interacción Social y Comunidad
* **Gestión de Perfiles:** Sistema completo de **Seguidores (Followers)** y **Seguidos (Following)**.
* **Publicaciones:** Creación y edición de posts con soporte multimedia.
* **Sistema de Feedback:** * **Reacciones:** Soporte para múltiples tipos de reacciones en posts.
    * **Comentarios y Respuestas:** Hilos de conversación con soporte para respuestas a comentarios específicos (nested comments).

### 📈 Algoritmo de Feed Dinámico
La API no solo entrega contenido cronológico, sino que implementa una lógica de descubrimiento dinámica basada en:
* **Feed de Seguidos:** Priorización de contenido de usuarios que sigues.
* **Tendencias (Engagement):** Listado de posts basados en los **más comentados** y **más reaccionados**.
* **Personalización:** Sección de posts basados en los intereses y "likes" previos del usuario.




## Configuración
El sistema maneja las credenciales de integración de forma híbrida para mayor flexibilidad:

1.  **Configuración en Base de Datos (Tabla `generales_app`):** Para facilitar la administración y cambios en caliente, las credenciales de **AWS S3**, **Servicio SMTP** y los IDs de **OAuth (Google y Apple)** se gestionan directamente desde la tabla de configuración global de la base de datos.
2.  **Configuración vía Entorno (Firebase):**
    Las credenciales y certificados de **Firebase Cloud Messaging** se gestionan de forma independiente para cumplir con los requisitos de seguridad del SDK de Firebase.


## Instalación

```bash
$ npm install
```

## Compilar y ejecutar el proyecto

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## 🔐 Configuración de Seguridad (JWT)

Este proyecto utiliza el algoritmo **RS256** para firmar los tokens de autenticación, lo que requiere un par de llaves asimétricas (pública y privada).

### Generación de Llaves
Ejecuta los siguientes comandos desde la raíz del proyecto para generar la carpeta y las llaves necesarias:

```bash
# 1. Crear directorio (si no existe) y acceder
mkdir -p keys
cd keys

# 2. Generar llave Privada (PKCS#1)
openssl genrsa -out private.pem 2048

# 3. Generar llave Pública a partir de la privada
openssl rsa -in private.pem -pubout -out public.pem


## Despliegue

Cuando estés listo para desplegar tu aplicación NestJS en producción, hay algunos pasos clave que puedes seguir para asegurar que se ejecute de la manera más eficiente posible. Consulta la [documentación de despliegue](https://docs.nestjs.com/deployment) para obtener más información.

Si estás buscando una plataforma en la nube para desplegar tu aplicación NestJS, échale un vistazo a [Mau](https://mau.nestjs.com), nuestra plataforma oficial para desplegar aplicaciones NestJS en AWS. Mau hace que el despliegue sea directo y rápido, requiriendo solo unos pocos y sencillos pasos.

Con Mau, puedes desplegar tu aplicación con solo unos pocos clics, permitiéndote concentrarte en desarrollar funcionalidades en lugar de administrar la infraestructura.

## Requisitos

- Node.js 24.14 (LTS)
- MySQL 8.4 (LTS)
- Prisma ORM 7

## Acceso a documentación Swwager
user: social
password: @piDoc2026

## 📦 Comandos NCU (Dependencias)
Ejecuta estos comandos según el nivel de actualización que necesites aplicar al `package.json`. No olvides ejecutar `npm install` al finalizar.

```bash
# 🟢 SEGURO: Solo parches y correcciones (Para producción)
ncu -u --target patch

# 🟡 RECOMENDADO: Nuevas funciones sin romper compatibilidad
ncu -u --target minor

# 🟡 MANUAL: Selecciona los paquetes interactuando en la terminal
ncu -i

# 🔴 PELIGRO: Actualiza todo, incluyendo Major releases que rompen código
ncu -u

## Soporte

Nest es un proyecto de código abierto con licencia MIT. Puede crecer gracias a los patrocinadores y el apoyo de increíbles colaboradores. Si deseas unirte a ellos, por favor [lee más aquí](https://docs.nestjs.com/support).

## Contacto

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## Licencia

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

