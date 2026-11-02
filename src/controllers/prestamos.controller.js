'use strict';

const { sequelize, Prestamo, Libro, Usuario } = require('../models');
const crypto = require('crypto');

// Contrato: /api/prestamos. Usar siempre fecha calendario en Perú.
function fechaPeru() {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const p = Object.fromEntries(partes.map(({ type, value }) => [type, value]));
  return `${p.year}-${p.month}-${p.day}`;
}

function fechaValida(fecha) {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const valor = new Date(`${fecha}T00:00:00.000Z`);
  return !Number.isNaN(valor.getTime()) && valor.toISOString().slice(0, 10) === fecha;
}

function idValido(valor) {
  const id = Number(valor);
  return /^\d+$/.test(String(valor)) && Number.isSafeInteger(id) && id > 0 && id <= 2147483647
    ? id : null;
}

function errorDeNegocio(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function manejarError(res, error) {
  if (error.status && error.code) {
    return res.status(error.status).json({ error: { code: error.code, message: error.message } });
  }
  console.error('[Préstamos]', error);
  return res.status(500).json({
    error: { code: 'ERROR_INTERNO', message: 'No se pudo completar la operación de préstamo.' }
  });
}

async function conManejo(res, operacion) {
  try {
    return await operacion();
  } catch (err) {
    return manejarError(res, err);
  }
}

async function bloquearPrestamoYLibro(id, transaction) {
  // Orden uniforme de bloqueo: libro primero, préstamo después.
  // Leer una primera vez sin bloquear permite conocer libro_id.
  const referencia = await Prestamo.findByPk(id, { transaction });
  if (!referencia) throw errorDeNegocio(404, 'PRESTAMO_NO_EXISTE', 'Préstamo no encontrado.');
  const libro = await Libro.findByPk(referencia.libro_id, {
    transaction, lock: transaction.LOCK.UPDATE
  });
  if (!libro) throw errorDeNegocio(404, 'LIBRO_NO_EXISTE', 'El libro del préstamo no existe.');
  const prestamo = await Prestamo.findByPk(id, {
    transaction, lock: transaction.LOCK.UPDATE
  });
  if (!prestamo) throw errorDeNegocio(404, 'PRESTAMO_NO_EXISTE', 'Préstamo no encontrado.');
  if (Number(prestamo.libro_id) !== Number(libro.id)) {
    throw errorDeNegocio(409, 'PRESTAMO_MODIFICADO', 'El préstamo fue modificado; intenta nuevamente.');
  }
  return { prestamo, libro };
}

// GET /api/prestamos - solo administrador (según middleware de rutas).
exports.obtenerPrestamos = (req, res) => conManejo(res, async () => {
  const prestamos = await Prestamo.findAll({
    include: [
      { model: Libro },
      // No devolver contraseñas ni hashes de los usuarios.
      { model: Usuario, attributes: ['id', 'nombre', 'email', 'rol'] }
    ],
    order: [['id', 'DESC']]
  });
  return res.json({ data: prestamos });
});

// GET /api/prestamos/mis - solo los préstamos del usuario autenticado.
exports.obtenerMisPrestamos = (req, res) => conManejo(res, async () => {
  const prestamos = await Prestamo.findAll({
    where: { usuario_id: req.usuario.id },
    include: [{ model: Libro }],
    order: [['id', 'DESC']]
  });
  return res.json({ data: prestamos });
});

// POST /api/prestamos - {libro_id}. El usuario, fecha, estado y código los fija el servidor.
exports.solicitarPrestamo = (req, res) => conManejo(res, async () => {
  if (req.usuario.rol !== 'usuario') {
    throw errorDeNegocio(403, 'ROL_NO_PERMITIDO', 'Solo los lectores pueden solicitar libros.');
  }
  const libroId = idValido(req.body?.libro_id);
  if (!libroId) {
    throw errorDeNegocio(400, 'LIBRO_INVALIDO', 'Indica un identificador de libro válido.');
  }
  const usuarioId = idValido(req.usuario.id);
  if (!usuarioId) {
    throw errorDeNegocio(401, 'USUARIO_INVALIDO', 'Sesión inválida.');
  }

  const nuevoPrestamo = await sequelize.transaction(async (transaction) => {
    const libro = await Libro.findByPk(libroId, {
      transaction, lock: transaction.LOCK.UPDATE
    });
    if (!libro) throw errorDeNegocio(404, 'LIBRO_NO_EXISTE', 'El libro solicitado no existe.');
    if (!Number.isInteger(libro.cantidad) || libro.cantidad <= 0) {
      throw errorDeNegocio(409, 'SIN_STOCK', 'Este libro no tiene ejemplares disponibles.');
    }
    const existente = await Prestamo.findOne({
      where: {
        usuario_id: usuarioId,
        libro_id: libroId,
        estado: ['pendiente', 'prestado']
      },
      transaction
    });
    if (existente) {
      throw errorDeNegocio(409, 'SOLICITUD_DUPLICADA',
        'Ya tienes un préstamo pendiente o activo de este libro.');
    }

    // Comprobar código en BD y reintentar si existe colisión.
    // Sebastián debe aplicar además UNIQUE(codigo) en MySQL para garantizar unicidad.
    for (let intento = 0; intento < 8; intento++) {
      const codigo = crypto.randomBytes(4).toString('hex').toUpperCase();
      const registrado = await Prestamo.findOne({ where: { codigo }, transaction });
      if (registrado) continue;
      try {
        return await Prestamo.create({
          codigo,
          usuario_id: usuarioId,
          libro_id: libroId,
          fecha_prestamo: fechaPeru(),
          fecha_devolucion: null,
          estado: 'pendiente'
        }, { transaction });
      } catch (err) {
        // Con el índice UNIQUE, una coincidencia de código puede producirse entre transacciones.
        if (err.name === 'SequelizeUniqueConstraintError' &&
            (err.fields?.codigo || err.errors?.some(e => e.path === 'codigo'))) continue;
        throw err;
      }
    }
    throw errorDeNegocio(409, 'CODIGO_NO_DISPONIBLE', 'No fue posible crear un código único.');
  });
  return res.status(201).json({ data: nuevoPrestamo, message: 'Préstamo solicitado con éxito.' });
});

// PATCH /api/prestamos/:id/aprobar - solo administrador.
exports.aprobarPrestamo = (req, res) => conManejo(res, async () => {
  const id = idValido(req.params.id);
  if (!id) throw errorDeNegocio(400, 'ID_INVALIDO', 'Identificador de préstamo inválido.');

  const aprobado = await sequelize.transaction(async transaction => {
    const { prestamo, libro } = await bloquearPrestamoYLibro(id, transaction);
    if (prestamo.estado !== 'pendiente') {
      throw errorDeNegocio(409, 'ESTADO_INVALIDO', 'Solo puede aprobarse un préstamo pendiente.');
    }
    if (!Number.isInteger(libro.cantidad) || libro.cantidad <= 0) {
      throw errorDeNegocio(409, 'SIN_STOCK', 'No hay ejemplares disponibles para aprobar.');
    }
    await libro.update({ cantidad: libro.cantidad - 1 }, { transaction });
    // El esquema actual no incluye fecha_solicitud; fecha_prestamo pasa a indicar aprobación.
    await prestamo.update({ estado: 'prestado', fecha_prestamo: fechaPeru() }, { transaction });
    return prestamo;
  });
  return res.json({ data: aprobado, message: 'Préstamo aprobado.' });
});

// PATCH o PUT /api/prestamos/:id/devolver - solo administrador.
exports.devolverPrestamo = (req, res) => conManejo(res, async () => {
  const id = idValido(req.params.id);
  if (!id) throw errorDeNegocio(400, 'ID_INVALIDO', 'Identificador de préstamo inválido.');
  const fecha = req.body?.fecha_devolucion ?? fechaPeru();
  if (!fechaValida(fecha)) {
    throw errorDeNegocio(400, 'FECHA_INVALIDA', 'Fecha de devolución inválida (AAAA-MM-DD).');
  }

  const devuelto = await sequelize.transaction(async transaction => {
    const { prestamo, libro } = await bloquearPrestamoYLibro(id, transaction);
    if (prestamo.estado !== 'prestado') {
      throw errorDeNegocio(409, 'ESTADO_INVALIDO', 'Solo puede devolverse un préstamo aprobado.');
    }
    if (fecha < prestamo.fecha_prestamo || fecha > fechaPeru()) {
      throw errorDeNegocio(400, 'FECHA_FUERA_DE_RANGO',
        'La devolución debe ser entre la fecha del préstamo y hoy.');
    }
    if (!Number.isInteger(libro.cantidad) || libro.cantidad >= 2147483647) {
      throw errorDeNegocio(409, 'STOCK_INVALIDO', 'No puede incrementarse la cantidad del libro.');
    }
    await libro.update({ cantidad: libro.cantidad + 1 }, { transaction });
    await prestamo.update({ estado: 'devuelto', fecha_devolucion: fecha }, { transaction });
    return prestamo;
  });
  return res.json({ data: devuelto, message: 'Devolución registrada correctamente.' });
});

// Compatibilidad con la ruta anterior PUT /:id/estado. Sin transiciones arbitrarias.
exports.cambiarEstadoPrestamo = (req, res) => {
  if (req.body?.estado === 'prestado') return exports.aprobarPrestamo(req, res);
  if (req.body?.estado === 'devuelto') return exports.devolverPrestamo(req, res);
  return res.status(400).json({
    error: { code: 'ESTADO_INVALIDO', message: 'Solo se permite aprobar o devolver un préstamo.' }
  });
};
