const express = require('express');
const router = express.Router();
const librosController = require('../controllers/libros.controller');
const { verificarToken, esAdmin } = require('../middlewares/auth.middleware');

// Rutas para Libros
router.get('/', librosController.obtenerLibros);
router.get('/:id', librosController.obtenerLibroPorId);
router.post('/', [verificarToken, esAdmin], librosController.crearLibro);
router.put('/:id', [verificarToken, esAdmin], librosController.actualizarLibro);
router.delete('/:id', [verificarToken, esAdmin], librosController.eliminarLibro);

module.exports = router;
