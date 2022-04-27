const fs = require("fs");
const https = require("https");
const express = require("express");

// Instância express
const app = express();
app.get("/", (req, res) => {
  res.send("Hello world using HTTPS!");
});

// Carrega o certificado e a key necessários para a configuração.
const options = {
  key: fs.readFileSync("key.pem"),
  cert: fs.readFileSync("cert.pem")
};

// Cria a instância do server e escuta na porta 3000
https.createServer(options, app).listen(3000);
