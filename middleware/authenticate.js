const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../dbConnectExec');

const authFailed = "Authentication failed.";

const auth = async(req, res, next) => {
    try {
        // decode token
        const token = req.header("Authorization").replace("Bearer ", "");
        
        // compare with db token
        const decodedToken = jwt.verify(token, config.JWT);

        const customerId = decodedToken.pk;

        const query = `SELECT c.CustomerId, c.FirstName, c.LastName, c.Email, c.Phone
        FROM Customer AS c
        WHERE c.CustomerId = ${customerId} and c.Token = '${token}';`;

        const returnedUser = await db.executeQuery(query);

        if (returnedUser[0]) {
            req.customer = returnedUser[0];
            next();
        } else {
            res.status(401).send(authFailed);
        }

    } catch (error) {
        console.log(error);
        res.status(401).send(authFailed);
    }
}

module.exports = auth;
