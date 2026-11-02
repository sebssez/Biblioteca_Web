const express = require('express');
const cors = require('cors');
const path = require('path');

// Importar rutas
const authRoutes = require('./routes/auth.routes');
const librosRoutes = require('./routes/libros.routes');
const prestamosRoutes = require('./routes/prestamos.routes');
const usuariosRoutes = require('./routes/usuarios.routes');

// Middleware de errores
const errorMiddleware = require('./middlewares/error.middleware');

const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del frontend (public)
app.use(express.static(path.join(__dirname, '../public')));

// Rutas de la API (sin prefijo /api, como pide el enunciado)
app.use('/auth', authRoutes);
app.use('/libros', librosRoutes);
app.use('/prestamos', prestamosRoutes);
app.use('/usuarios', usuariosRoutes);

// Ruta principal: si el navegador pide HTML, devolver index.html;
// si no, responder 404 en JSON
app.get('*', (req, res) => {
  if (req.accepts('html')) {
    return res.sendFile(path.join(__dirname, '../public/index.html'));
  }
  res.status(404).json({ mensaje: 'Ruta no encontrada' });
});

// Middleware de errores (siempre al final)
app.use(errorMiddleware);

module.exports = app;
