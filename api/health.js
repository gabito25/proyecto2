module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  
  res.status(200).json({
    status: 'OK',
    message: '¡API funcionando!',
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    version: '1.0.0'
  });
};