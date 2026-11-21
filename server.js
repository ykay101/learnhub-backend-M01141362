var express = require("express");
var cors = require("cors");
var path = require("path");

var lessonsRouter = require("./routes/lessons");
var ordersRouter = require("./routes/orders");
var teachersRouter = require("./routes/teachers");

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

var imagesPath = path.resolve(__dirname, "images");
app.use("/images", express.static(imagesPath));
app.use("/images", function (request, response) {
  response.status(404).send("Image not found!");
});

app.use(lessonsRouter);
app.use(ordersRouter);
app.use(teachersRouter);

app.use(function (request, response) {
  response.status(404).send("Page not found!");
});

var port = process.env.PORT || 3000;
app.listen(port, function () {
  console.log("App started on port " + port);
});
