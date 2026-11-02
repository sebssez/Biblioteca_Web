'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/prestamos.controller');
const { verificarToken, esAdmin } = require('../middlewares/auth.middleware');

// El servidor principal monta este router en /api/prestamos.
router.get('/', verificarToken, esAdmin, controller.obtenerPrestamos);
router.get('/mis', verificarToken, controller.obtenerMisPrestamos);
router.get('/mis-prestamos', verificarToken, controller.obtenerMisPrestamos); // alias anterior
router.post('/', verificarToken, controller.solicitarPrestamo);
router.patch('/:id/aprobar', verificarToken, esAdmin, controller.aprobarPrestamo);
router.put('/:id/aprobar', verificarToken, esAdmin, controller.aprobarPrestamo);
router.patch('/:id/devolver', verificarToken, esAdmin, controller.devolverPrestamo);
router.put('/:id/devolver', verificarToken, esAdmin, controller.devolverPrestamo);
router.put('/:id/estado', verificarToken, esAdmin, controller.cambiarEstadoPrestamo); // compatibilidad

module.exports = router;
