const express = require("express");
const ErrorHandler = require("./middleware/error");
const app = express();
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const cors = require("cors");

// app.use(
//   cors(
//   )
// );

// app.use(
//   cors({
//     origin: "https://administrasi-kec-katapang.vercel.app", // Ganti dengan domain front-end Anda
//     methods: ["GET", "POST", "PUT", "DELETE"], // Metode HTTP yang diizinkan
//     credentials: true, // Mengizinkan cookie dikirim dalam permintaan lintas domain
//   })
// );


app.use(
  cors({
    origin: "*", // Mengizinkan semua origin
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Mengizinkan semua metode
    credentials: true, // Jika Anda menggunakan cookie
  })
);


app.use(express.json());
app.use(cookieParser());

app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

// config
if (process.env.NODE_ENV !== "PRODUCTION") {
  require("dotenv").config({
    path: "config/.env",
  });
}

// import routes
const user = require("./controller/userController");
const saldo = require("./controller/saldoController");
const transaction = require("./controller/transactionController");
const categoryRoutes = require("./controller/categoryController");
const dashboardRoutes = require("./controller/dashboardController");
const accountingRoutes = require("./controller/accountingController");
const reportRoutes = require("./controller/reportController");
// const welcome = require("./controller/welcomeController");


// define routes
app.use("/category", categoryRoutes);
app.use("/users", user);
app.use("/dashboard", dashboardRoutes);
app.use("/saldo", saldo);
app.use("/transaction", transaction);
app.use("/accounting", accountingRoutes);
app.use("/report", reportRoutes);


// app.use("", welcome);

// it's for ErrorHandling
app.use(ErrorHandler);

module.exports = app;
