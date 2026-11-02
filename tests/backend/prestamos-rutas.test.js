'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const routePath = path.resolve(__dirname, '../../src/routes/prestamos.routes.js');

test('rutas de préstamos tienen autenticación y autorización correctas', () => {
  const registradas = [];
  const verificarToken = () => {};
  const esAdmin = () => {};
  const controlador = Object.fromEntries([
    'obtenerPrestamos', 'obtenerMisPrestamos', 'solicitarPrestamo',
    'aprobarPrestamo', 'devolverPrestamo', 'cambiarEstadoPrestamo'
  ].map(n => [n, () => {}]));
  const router = {};
  for (const metodo of ['get', 'post', 'patch', 'put']) {
    router[metodo] = (path, ...handlers) => {
      registradas.push({ metodo, path, handlers });
    };
  }
  const modules = {
    express: { Router: () => router },
    '../controllers/prestamos.controller': controlador,
    '../middlewares/auth.middleware': { verificarToken, esAdmin }
  };
  const originalLoad = Module._load;
  try {
    Module._load = function(request, parent, main) {
      if (parent?.filename === routePath && modules[request]) return modules[request];
      return originalLoad.call(this, request, parent, main);
    };
    delete require.cache[routePath];
    require(routePath);
  } finally {
    Module._load = originalLoad;
  }
  for (const [metodo, route, admin] of [
    ['get', '/', true],
    ['get', '/mis', false],
    ['get', '/mis-prestamos', false],
    ['post', '/', false],
    ['patch', '/:id/aprobar', true],
    ['patch', '/:id/devolver', true],
    ['put', '/:id/devolver', true],
    ['put', '/:id/estado', true]
  ]) {
    const encontrado = registradas.find(r => r.metodo === metodo && r.path === route);
    assert.ok(encontrado, `${metodo.toUpperCase()} ${route} no existe`);
    assert.equal(encontrado.handlers[0], verificarToken, `${route} requiere token`);
    assert.equal(encontrado.handlers.includes(esAdmin), admin, `${route} permiso admin incorrecto`);
  }
});
