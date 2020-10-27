const sql = require('mssql');
const appConfig = require('./config');

const config = {
    user: appConfig.DB.user,
    password: appConfig.DB.password,
    server: appConfig.DB.server,
    database: appConfig.DB.database
};

async function executeQuery(aQuery) {
    let connection = await sql.connect(config);
    let result = await connection.query(aQuery);

    return result.recordset;
}

module.exports = {
    executeQuery
};

/*
executeQuery(`SELECT p.PurchaseId, p.DateOfPurchase, p.Amount, s.Name, c.CustomerId, c.FirstName, c.LastName, c.Phone, c.Email
FROM "Purchase" AS p
INNER JOIN "Customer" AS c
ON c.CustomerId = p.CustomerId
INNER JOIN "ShelfStrain" AS ss
ON ss.ShelfStrainId = p.ShelfStrainId
INNER JOIN "Strain" AS s
ON s.StrainId = ss.StrainId; `);
*/