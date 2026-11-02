const { Libro } = require('../models');

exports.obtenerLibros = async (req, res) => {
  try {
    const libros = await Libro.findAll();
    res.json(libros);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.obtenerLibroPorId = async (req, res) => {
  try {
    const libro = await Libro.findByPk(req.params.id);
    if (!libro) return res.status(404).json({ message: 'Libro no encontrado' });
    res.json(libro);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.crearLibro = async (req, res) => {
  try {
    const nuevoLibro = await Libro.create(req.body);
    res.status(201).json(nuevoLibro);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.actualizarLibro = async (req, res) => {
  try {
    const libro = await Libro.findByPk(req.params.id);
    if (!libro) return res.status(404).json({ message: 'Libro no encontrado' });
    await libro.update(req.body);
    res.json({ message: 'Libro actualizado', libro });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.eliminarLibro = async (req, res) => {
  try {
    const libro = await Libro.findByPk(req.params.id);
    if (!libro) return res.status(404).json({ message: 'Libro no encontrado' });
    await libro.destroy();
    res.json({ message: 'Libro eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
