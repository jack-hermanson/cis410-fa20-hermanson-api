const express = require('express');
const bcrypt = require('bcryptjs');
const app = express();
const db = require('./dbConnectExec');

app.use(express.json());

app.get('/hi', (req, res) => {
    res.send("hello world");
});

// create a new customer
app.post('/customers', async (req, res) => {

    // request body
    const firstName = req.body.firstName.replace("'", "''");
    const lastName = req.body.lastName.replace("'", "''");
    const phone = req.body.phone.replace("'", "''");
    const email = req.body.email.replace("'", "''");
    const password = req.body.password;

    // validation
    if (!firstName || !lastName || !phone || !email || !password) {
        return res.status(400).send("Bad request. Are you missing a required paramater?");
    }

    // check if user with that email already exists
    const checkEmailQuery = `SELECT email
    FROM customer
    WHERE email = '${email}'`;
    const existingUser = await db.executeQuery(checkEmailQuery);
    if (existingUser[0]) {
        return res.status(409).send("That email is already taken. Please try again with a different one.");
    }

    // create a new user
    const hashedPassword = bcrypt.hashSync(password)
    const insertQuery = `INSERT INTO Customer(FirstName, LastName, Phone, Email, Password)
    VALUES('${firstName}', '${lastName}', '${phone}', '${email}', '${hashedPassword}');`;
    db.executeQuery(insertQuery)
        .then(() => {
            res.status(201).send();
        })
        .catch(err => {
            console.log("Error in POST /customers", err);
            res.status(500).send();
        });
});

// get purchases made by customers
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

// get a specific purchase
app.get('/purchases/:pk', (req, res) => {
    const pk = req.params.pk;

    const query = `SELECT p.PurchaseId, p.DateOfPurchase, p.Amount, s.Name, c.CustomerId, c.FirstName, c.LastName, c.Phone, c.Email
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