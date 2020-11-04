const jwt = require('jsonwebtoken');

let myToken = jwt.sign({pk: 1234}, "secretPassword", {expiresIn: "60 minutes"});

console.log(myToken);
