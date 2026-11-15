var express = require("express");
var cors = require("cors");

var app = express();
app.use(cors());
app.use(express.json());

app.use(function (request, response, next) {
  console.log(new Date().toISOString() + " " + request.method + " " + request.url);
  if (request.method == "POST" || request.method == "PUT") {
    console.log("  Body: " + JSON.stringify(request.body));
  }
  next();
});

app.use(function (request, response) {
  response.status(404).send("Page not found!");
});

var port = process.env.PORT || 3000;
app.listen(port, function () {
  console.log("App started on port " + port);
});
