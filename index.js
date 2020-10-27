const express = require('express');
const db = require('./dbConnectExec');
const app = express();

app.get('/hi', (req, res) => {
    res.send("hello world");
});

app.get('/purchases', (req, res) => {
    db.executeQuery(`SELECT p.PurchaseId, p.DateOfPurchase, p.Amount, s.Name, c.CustomerId, c.FirstName, c.LastName, c.Phone, c.Email
    FROM "Purchase" AS p
    INNER JOIN "Customer" AS c
    ON c.CustomerId = p.CustomerId
    INNER JOIN "ShelfStrain" AS ss
    ON ss.ShelfStrainId = p.ShelfStrainId
    INNER JOIN "Strain" AS s
    ON s.StrainId = ss.StrainId;`)
        .then(result => {
            res.status(200).send(result);
        })
        .catch(err => {
            console.log(err);
            res.status(500).send();
        });
});

app.get('/purchases/:pk', (req, res) => {
    let pk = req.params.pk;

    let query = `SELECT p.PurchaseId, p.DateOfPurchase, p.Amount, s.Name, c.CustomerId, c.FirstName, c.LastName, c.Phone, c.Email
    FROM "Purchase" AS p
    INNER JOIN "Customer" AS c
    ON c.CustomerId = p.CustomerId
    INNER JOIN "ShelfStrain" AS ss
    ON ss.ShelfStrainId = p.ShelfStrainId
    INNER JOIN "Strain" AS s
    ON s.StrainId = ss.StrainId
    WHERE p.PurchaseId = ${pk}`;

    db.executeQuery(query)
        .then(purchases => {
            if (purchases[0]) {
                res.status(200).send(purchases[0])
            } else {
                res.status(404).send('Bad request');
            }
        })
        .catch(err => {
            console.log("Error in /purchases/pk", err);
            res.status(500).send();
        });
});

app.listen(5000, () => {
    console.log("app is running");
});