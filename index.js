const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('./dbConnectExec');
const config = require('./config');
const jwt = require('jsonwebtoken');
const auth = require('./middleware/authenticate')
const cors = require('cors');

const app = express();

app.use(express.json());
app.use(cors());

/**
 * ROUTES
 */

// TEST
app.get('/', (req, res) => {
    return res.status(200).send({
        message: "Welcome"
    });
});

app.get('/hi', (req, res) => {
    res.status(200).send("hello world");
});

// CUSTOMERS

// get existing customers
app.get('/customers', async (req, res) => {
    const query = `SELECT c.CustomerId, c.FirstName, c.LastName, c.Email, c.Phone
    FROM CUSTOMER as c;`

    const result = await db.executeQuery(query)
        .catch(err => {
            console.log(err);
            return res.status(500).send();
        });

    return res.status(200).send(result);
});

// account
app.get('/account', auth, async (req, res) => {
    const user = req.customer;
    const result = await db.executeQuery(`
        SELECT p.PurchaseId, p.DateOfPurchase, p.Amount, s.[Name], s.Potency
        FROM Purchase AS p
        INNER JOIN ShelfStrain AS ss
        ON ss.ShelfStrainId = p.ShelfStrainId
        INNER JOIN Strain AS s ON s.StrainId = ss.StrainId
        WHERE p.CustomerId = ${user.CustomerId};`);
    
    return result;
    
});

// get a specific customer
app.get('/customers/:pk', async (req, res) => {
    const pk = req.params.pk;

    const query = `SELECT c.CustomerId, c.FirstName, c.LastName, c.Email, c.Phone
    FROM CUSTOMER as c
    WHERE c.CustomerId = ${pk};`;

    result = await db.executeQuery(query)
        .catch(err => {
            console.log(err);
            return res.status(500).send();
        });

    if (result[0]) {
        return res.status(200).send(result[0]);
    } else {
        return res.status(404).send("Not found")
    }
});

// create a new customer
app.post('/customers', async (req, res) => {

    // request body
    let firstName = req.body.firstName;
    let lastName = req.body.lastName;
    let phone = req.body.phone;
    let email = req.body.email;
    const password = req.body.password;

    // validation
    if (!firstName || !lastName || !phone || !email || !password) {
        return res.status(400).send("Bad request. Are you missing a required paramater?");
    }

    firstName = firstName.replace("'", "''");
    lastName = lastName.replace("'", "''");
    phone = phone.replace("'", "''");
    email = email.replace("'", "''");

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
    OUTPUT inserted.CustomerId, inserted.FirstName, inserted.LastName, inserted.Phone, inserted.Email
    VALUES('${firstName}', '${lastName}', '${phone}', '${email}', '${hashedPassword}');`;
    db.executeQuery(insertQuery)
        .then(insertedCustomer => {
            res.status(201).send(insertedCustomer[0]);
        })
        .catch(err => {
            console.log("Error in POST /customers", err);
            res.status(500).send();
        });
});

// login
app.post('/customers/login', async (req, res) => {

    // get form stuff
    let email = req.body.email;
    let password = req.body.password;

    if (!email || !password) {
        return res.status(400).send("Bad request. Did you forget to enter something?");
    }

    email = email.replace("'", "''").replace(";", "");

    // make query
    const query = `SELECT *
    FROM Customer
    WHERE Email = '${email}';`;

    let result;

    try {
        result = await db.executeQuery(query);
    } catch (err) {
        console.log("error in /customers/login", err);
        return res.status(500).send();
    }

    const badCredentials = "Invalid user credentials.";

    if (!result[0]) {
        return res.status(400).send(badCredentials);
    }

    // check password
    const user = result[0];

    if (!bcrypt.compareSync(password, user.Password)) {
        return res.status(400).send(badCredentials);
    }

    // generate a token
    const token = jwt.sign({
            pk: user.CustomerId
        },
        config.JWT, {
            expiresIn: "60 minutes"
        }
    );

    const setTokenQuery = `UPDATE Customer
    SET Token = '${token}'
    WHERE CustomerId = ${user.CustomerId};`;

    try {
        await db.executeQuery(setTokenQuery);
        return res.status(200).send({
            token: token,
            user: {
                FirstName: user.FirstName,
                LastName: user.LastName,
                Email: user.Email,
                CustomerId: user.CustomerId
            }
        });
    } catch (err) {
        console.log("Error setting user token", err)
        return res.status(500).send();
    }

});

// get user's information
app.get('/me', auth, (req, res) => {

    res.send(req.customer);
});

// logout
app.post('/customers/logout', auth, (req, res) => {
    const query = `UPDATE Customer
    SET Token = NULL
    WHERE CustomerId = ${req.customer.CustomerId}`;

    db.executeQuery(query)
        .then(() => res.status(200).send())
        .catch(error => {
            console.log('error in POST /customers/logout', error);
            res.status(500).send();
        });
});

// PURCHASES

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
                res.status(404).send("Not found");
            }
        })
        .catch(err => {
            console.log("Error in /purchases/pk", err);
            res.status(500).send();
        });
});

// get a user's purchases
app.get('/purchases/users/:fk', auth, (req, res) => {
    const fk = req.params.fk;

    const query = `SELECT p.PurchaseId, p.DateOfPurchase, p.Amount, s.Name, s.Potency
    FROM Purchase AS p
    INNER JOIN ShelfStrain AS ss ON ss.ShelfStrainId = p.ShelfStrainId
    INNER JOIN Strain AS s ON s.StrainId = ss.StrainId
    WHERE p.CustomerId = ${fk};`;

    db.executeQuery(query)
        .then(purchases => {
            if (purchases[0]) {
                res.status(200).send(purchases);
            } else {
                res.status(404).send("Not found");
            }
        })
        .catch(err => {
            console.log("Error in /purchases/users/fk", err);
            res.status(500).send();
        })
});

// create a new purchase
app.post('/purchases', auth, (req, res) => {
    try {
        const shelfStrainId = req.body.shelfStrainId;
        const customerId = req.customer.CustomerId;
        const amount = req.body.amount;

        if (!shelfStrainId || !amount) {
            return res.status(400).send("Bad request.");
        }

        const insertQuery = `INSERT INTO Purchase(ShelfStrainId, CustomerId, Amount)
        OUTPUT inserted.PurchaseId, inserted.ShelfStrainId, inserted.CustomerId, inserted.Amount
        VALUES('${shelfStrainId}', '${customerId}', '${amount}');`;

        // let insertedPurchase;

        db.executeQuery(insertQuery)
            .then(p => res.status(201).send(p[0]))
            .catch(err => {
                console.log("Error in post /purchases", err);
                res.status(500).send();
            });



    } catch (err) {
        console.log("Error in /purchases", err)
        res.status(500).send();
    }
});

// STRAINS

// create a new strain
app.post('/strains', auth, async (req, res) => {

    try {
        let name = req.body.name;
        const potency = req.body.potency;
        const ouncePrice = req.body.ouncePrice;
        const halfPrice = req.body.halfPrice;
        const quadPrice = req.body.quadPrice;
        const eighthPrice = req.body.eighthPrice;
        const gramPrice = req.body.gramPrice;

        if (!name || !potency || !ouncePrice || !halfPrice || !quadPrice || !eighthPrice || !gramPrice) {
            return res.status(400).send("Bad request. Did you forget to enter a required parameter?");
        }

        name = name.replace("'", "''");

        const insertQuery = `INSERT INTO Strain(Name, Potency, OuncePrice, HalfPrice, QuadPrice, EighthPrice, GramPrice)
        OUTPUT inserted.StrainId, inserted.Name, inserted.Potency, inserted.HalfPrice, inserted.QuadPrice, inserted.EighthPrice, inserted.GramPrice
        VALUES('${name}', ${potency}, ${ouncePrice}, ${halfPrice}, ${quadPrice}, ${eighthPrice}, ${gramPrice});`;

        console.log(insertQuery);
        let insertedStrain = await db.executeQuery(insertQuery);
        res.status(201).send(insertedStrain[0]);

    } catch (err) {
        console.log("error in POST /strains", err);
        res.status(500).send();
    }
});

// get all strains
app.get('/strains', async (req, res) => {
    const query = `SELECT * FROM Strain;`;

    const result = await db.executeQuery(query)
        .catch(err => {
            console.log(err);
            return res.status(500).send();
        });

    return res.status(200).send(result);
});

// get a specific strain
app.get('/strains/:pk', async (req, res) => {
    const pk = req.params.pk;

    const query = `SELECT * FROM Strain
    WHERE StrainId = ${pk};`;

    const result = await db.executeQuery(query)
        .catch(err => {
            console.log(err);
            return res.status(500).send();
        });

    if (result[0]) {
        return res.status(200).send(result[0]);
    } else {
        return res.status(404).send("Not found");
    }


});

/**
 * RUN APP
 */
const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
    console.log(`App is running on port ${PORT}.`);
});