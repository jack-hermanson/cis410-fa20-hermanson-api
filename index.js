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
    return res.status(200).send({name: "Jack"});
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

// get a specific customer
app.get('/customers/:pk', async (req, res) => {
    const pk = req.params.pk.replace("'", "").replace(";", "");

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

// login
app.post('/customers/login', async (req, res) => {

    // get form stuff
    const email = req.body.email.replace("'", "''").replace(";", "");
    const password = req.body.password;

    if (!email || !password) {
        return res.status(400).send("Bad request. Did you forget to enter something?");
    }

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
    const pk = req.params.pk.replace("'", "").replace(";", "");

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

// STRAINS

// create a new strain
app.post('/strains', auth, async (req, res) => {

    try {
        let name = req.body.name.replace("'", "''");
        let potency = req.body.potency;
        let ouncePrice = req.body.ouncePrice;
        let halfPrice = req.body.halfPrice;
        let quadPrice = req.body.quadPrice;
        let eighthPrice = req.body.eighthPrice;
        let gramPrice = req.body.gramPrice;

        if (!name || !potency || !ouncePrice || !halfPrice || !quadPrice || !eighthPrice || !gramPrice) {
            return res.status(400).send("Bad request. Did you forget to enter a required parameter?");
        }

        const insertQuery = `INSERT INTO Strain(Name, Potency, OuncePrice, HalfPrice, QuadPrice, EighthPrice, GramPrice)
        VALUES('${name}', ${potency}, ${ouncePrice}, ${halfPrice}, ${quadPrice}, ${eighthPrice}, ${gramPrice});`;

        const insertedStrain = await db.executeQuery(insertQuery);
        res.status(201).send(insertedStrain[0]);

    } catch (err) {
        console.log("error in POST /review", error);
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
    const pk = req.params.pk.replace("'", "").replace(";", "");

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