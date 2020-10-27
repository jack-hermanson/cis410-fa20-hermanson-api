const express = require('express');

const app = express();

app.get('/hi', (req, res) => {
    res.send("hello world");
});

app.listen(5000, () => {
    console.log("app is running");
});