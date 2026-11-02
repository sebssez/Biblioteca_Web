# 📚 Sistema de Gestión de Biblioteca_Web

Sistema web completo para la administración y gestión de una biblioteca digital, con autenticación de usuarios basada en roles (Admin/Usuario), catálogo interactivo de libros y control de préstamos con generación de códigos únicos.

Proyecto desarrollado para el **Producto Académico C2_N.º1 - Desarrollo de Aplicaciones Web**.

## Antes de trabajar con una IA

**Si usas una IA para continuar este proyecto, por favor pídele que lea primero estos dos documentos, en este orden, antes de proponer o modificar código:**

1. [Guía de conexión del backend](docs/BACKEND.md): estado actual, nombres de campos y variables, contratos propuestos y reglas que debe respetar la integración.
2. [Pruebas del frontend](docs/PRUEBAS_FRONTEND.md): flujos comprobados, errores corregidos, casos de prueba y límites de la demostración.

Actualmente solo está implementado el frontend con datos simulados en el navegador. Los endpoints documentados son una propuesta para la siguiente etapa; todavía no están implementados. Conserva el diseño y los flujos existentes al conectar el backend.

---

## 🛠️ Tecnologías Utilizadas

* **Backend:** Node.js, Express.js
* **Base de Datos & ORM:** MySQL, Sequelize ORM
* **Autenticación & Seguridad:** JSON Web Tokens (JWT), Bcrypt, Crypto
* **Frontend:** HTML5, CSS3, JavaScript (Vanilla ES6)
* **Control de Versiones:** Git, GitHub

---

## 📁 Estructura del Proyecto

```text
biblioteca-web/
├── src/
│   ├── config/          # Configuración de conexión a la BD (database.js)
│   ├── controllers/     # Lógica de negocio (auth, libros, prestamos, usuarios)
│   ├── middlewares/     # Middlewares de autenticación y verificación de roles
│   ├── models/          # Modelos Sequelize (Usuario, Libro, Prestamo)
│   ├── routes/          # Definición de rutas de la API RESTful
│   ├── utils/           # Generación de códigos de préstamo únicos (crypto)
│   ├── app.js           # Configuración del servidor Express
│   └── server.js        # Punto de entrada principal e inicio del servidor
├── public/              # Archivos de interfaz web (HTML, CSS, JS frontend)
├── sql/                 # Script SQL para la base de datos MySQL (biblioteca.sql)
├── docs/                # Diagramas ER y colección de endpoints
├── .env.example         # Plantilla de variables de entorno
├── .gitignore           # Archivos ignorados por Git
└── package.json         # Dependencias y scripts del proyecto

<<<<<<< HEAD

## Frontend de demostración

Por ahora los flujos usan datos locales del navegador. Para probarlos sin MySQL:

```sh
npm ci
npm run dev:frontend
```

Abrir `http://127.0.0.1:4173`. Cuentas ficticias: `lector@example.com` y `admin@example.com`, clave `Demo123!`. También se puede crear un lector desde registro. No usar credenciales reales.


## 🔗 Endpoints principales

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| POST | /auth/register | Registrar usuario | Público |
| POST | /auth/login | Iniciar sesión | Público |
| GET | /libros | Ver catálogo | Autenticado |
| POST/PUT/DELETE | /libros | Gestionar libros | Admin |
| POST | /prestamos | Solicitar préstamo | Usuario |
| GET | /prestamos | Ver préstamos | Autenticado |
| PUT | /prestamos/:id/devolver | Registrar devolución | Admin |


## 👥 Integrantes del Equipo

| N.º | Nombre Completo | Rol / Contribución |
| :---: | :--- | :--- |
| 1 | Andre Sebastian Espinoza Zea | Backend / Integración |
| 2 | Jose Enrique Mejia Osis | Backend / Modelos |
| 3 | Daniela Rojas Paucar | Frontend / Rutas |
| 4 | Carlos Enrique Nieblas Tairo | Backend / Base de Datos |
| 5 | José Manuel Tantalla Puma | Módulo de Préstamos |
| 6 | Jessica Alessandra Condemayta Alvarez | Documentación / Pruebas |
