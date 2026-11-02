'use strict';
// Pruebas unitarias aisladas. NO sustituyen pruebas con MySQL real.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const controllerPath = path.resolve(__dirname, '../../src/controllers/prestamos.controller.js');

function configurar({ cantidad = 5, prestamos = [], libroExiste = true } = {}) {
  const libro = libroExiste ? {
    id: 1, cantidad,
    async update(datos) { Object.assign(this, datos); return this; }
  } : null;
  const items = prestamos.map((x, i) => ({
    id: x.id ?? i + 1,
    codigo: x.codigo || `ABCDEF0${i}`,
    usuario_id: x.usuario_id ?? 10,
    libro_id: x.libro_id ?? 1,
    estado: x.estado ?? 'pendiente',
    fecha_prestamo: x.fecha_prestamo ?? '2026-10-31',
    fecha_devolucion: x.fecha_devolucion ?? null,
    async update(datos) { Object.assign(this, datos); return this; }
  }));
  const modelos = {
    sequelize: {
      async transaction(fn) {
        const estadoAnterior = items.map(o => ({ ...o }));
        const cantAnterior = libro?.cantidad;
        try { return await fn({ LOCK: { UPDATE: 'UPDATE' } }); }
        catch (err) {
          if (libro) libro.cantidad = cantAnterior;
          items.splice(0, items.length, ...estadoAnterior);
          throw err;
        }
      }
    },
    Libro: {
      async findByPk(id) { return libro && Number(id) === 1 ? libro : null; }
    },
    Usuario: {},
    Prestamo: {
      async findByPk(id) { return items.find(p => p.id === Number(id)) || null; },
      async findOne({ where }) {
        return items.find(p => Object.keys(where).every(k =>
          Array.isArray(where[k]) ? where[k].includes(p[k]) : p[k] === where[k])) || null;
      },
      async findAll({ where } = {}) {
        return where ? items.filter(p => Object.keys(where).every(k => p[k] === where[k])) : items;
      },
      async create(campos) {
        const p = { id: items.length + 1, ...campos, async update(v) { Object.assign(this, v); } };
        items.push(p);
        return p;
      }
    }
  };
  const originalLoad = Module._load;
  try {
    Module._load = function(request, parent, isMain) {
      if (request === '../models' && parent?.filename === controllerPath) return modelos;
      return originalLoad.call(this, request, parent, isMain);
    };
    delete require.cache[controllerPath];
    const controlador = require(controllerPath);
    return { controlador, libro, items };
  } finally {
    Module._load = originalLoad;
  }
}

function reqRes({ body = {}, id = '1', usuario = { id: 10, rol: 'usuario' } } = {}) {
  let status = 200;
  const res = {
    status(n) { status = n; return this; },
    json(data) { this.body = data; return data; },
    get statusCode() { return status; }
  };
  return { req: { body, params: { id }, usuario }, res };
}

test('solicitar genera código, estado pendiente y no descuenta stock', async () => {
  const { controlador, libro, items } = configurar();
  const { req, res } = reqRes({ body: { libro_id: 1, usuario_id: 55, estado: 'prestado' } });
  await controlador.solicitarPrestamo(req, res);
  assert.equal(res.statusCode, 201);
  assert.equal(items.length, 1);
  assert.match(items[0].codigo, /^[A-F0-9]{8}$/);
  assert.equal(items[0].usuario_id, 10);
  assert.equal(items[0].estado, 'pendiente');
  assert.equal(libro.cantidad, 5);
  assert.match(items[0].fecha_prestamo, /^\d{4}-\d{2}-\d{2}$/);
});

test('rechaza segunda solicitud pendiente o prestada', async () => {
  const { controlador, items } = configurar({ prestamos: [{ estado: 'pendiente' }] });
  const { req, res } = reqRes({ body: { libro_id: 1 } });
  await controlador.solicitarPrestamo(req, res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error.code, 'SOLICITUD_DUPLICADA');
  assert.equal(items.length, 1);
});

test('permite nueva solicitud después de devolver', async () => {
  const { controlador, items } = configurar({ prestamos: [{ estado: 'devuelto' }] });
  const { req, res } = reqRes({ body: { libro_id: 1 } });
  await controlador.solicitarPrestamo(req, res);
  assert.equal(res.statusCode, 201);
  assert.equal(items.length, 2);
});

test('rechaza solicitud con cero stock, libro inexistente, id inválido y admin', async () => {
  for (const [config, input, code, role] of [
    [{ cantidad: 0 }, 1, 'SIN_STOCK', 'usuario'],
    [{ libroExiste: false }, 1, 'LIBRO_NO_EXISTE', 'usuario'],
    [{}, '0', 'LIBRO_INVALIDO', 'usuario'],
    [{}, 1, 'ROL_NO_PERMITIDO', 'admin']
  ]) {
    const { controlador } = configurar(config);
    const { req, res } = reqRes({ body: { libro_id: input }, usuario: { id: 10, rol: role } });
    await controlador.solicitarPrestamo(req, res);
    assert.equal(res.body.error.code, code);
  }
});

test('aprobar descuenta exactamente un ejemplar', async () => {
  const { controlador, libro, items } = configurar({ prestamos: [{ estado: 'pendiente' }] });
  const { req, res } = reqRes();
  await controlador.aprobarPrestamo(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(items[0].estado, 'prestado');
  assert.equal(libro.cantidad, 4);
  const r2 = reqRes();
  await controlador.aprobarPrestamo(r2.req, r2.res);
  assert.equal(r2.res.statusCode, 409);
  assert.equal(libro.cantidad, 4);
});

test('no aprueba si stock es cero', async () => {
  const { controlador, libro } = configurar({ cantidad: 0, prestamos: [{ estado: 'pendiente' }] });
  const { req, res } = reqRes();
  await controlador.aprobarPrestamo(req, res);
  assert.equal(res.body.error.code, 'SIN_STOCK');
  assert.equal(libro.cantidad, 0);
});

test('devolver repone uno, almacena fecha y bloquea devolución duplicada', async () => {
  const { controlador, libro, items } = configurar({ cantidad: 4, prestamos: [{ estado: 'prestado', fecha_prestamo: '2026-10-31' }] });
  const { req, res } = reqRes({ body: { fecha_devolucion: '2026-11-01' } });
  await controlador.devolverPrestamo(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(libro.cantidad, 5);
  assert.equal(items[0].estado, 'devuelto');
  assert.equal(items[0].fecha_devolucion, '2026-11-01');
  const r2 = reqRes({ body: { fecha_devolucion: '2026-11-01' } });
  await controlador.devolverPrestamo(r2.req, r2.res);
  assert.equal(r2.res.statusCode, 409);
  assert.equal(libro.cantidad, 5);
});

test('no devuelve préstamos pendientes', async () => {
  const { controlador, libro } = configurar({ prestamos: [{ estado: 'pendiente' }] });
  const { req, res } = reqRes();
  await controlador.devolverPrestamo(req, res);
  assert.equal(res.body.error.code, 'ESTADO_INVALIDO');
  assert.equal(libro.cantidad, 5);
});

test('rechaza devolución con fecha inválida o futura', async () => {
  const { controlador } = configurar({ prestamos: [{ estado: 'prestado', fecha_prestamo: '2026-10-31' }] });
  for (const fecha of ['2026-02-30', '2999-01-01', '2026-10-30']) {
    const { req, res } = reqRes({ body: { fecha_devolucion: fecha } });
    await controlador.devolverPrestamo(req, res);
    assert.notEqual(res.statusCode, 200, fecha);
  }
});

test('la ruta de estado anterior no permite saltar a estados arbitrarios', async () => {
  const { controlador } = configurar();
  const { req, res } = reqRes({ body: { estado: 'pendiente' } });
  await controlador.cambiarEstadoPrestamo(req, res);
  assert.equal(res.statusCode, 400);
});

test('consulta solo los préstamos del usuario actual', async () => {
  const { controlador } = configurar({ prestamos: [
    { id: 1, usuario_id: 10 }, { id: 2, usuario_id: 20 }
  ] });
  const { req, res } = reqRes();
  await controlador.obtenerMisPrestamos(req, res);
  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.data[0].usuario_id, 10);
});
