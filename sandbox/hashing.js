const bcrypt = require('bcryptjs');

let hashedPassword = bcrypt.hashSync('asdfasdf');

console.log(hashedPassword);

let hashTest = bcrypt.compareSync('asdfasdf', hashedPassword);
console.log(hashTest);