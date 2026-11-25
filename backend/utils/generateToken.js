const jwt = require('jsonwebtoken');

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'supersecretjwtkey_employeetracker_2026', {
    expiresIn: '30d',
  });
};

module.exports = generateToken;
