const express = require("express");
const app = express();
require("dotenv").config();
const cookieParser = require("cookie-parser");
const cors = require('cors');
const port = process.env.X_ZOHO_CATALYST_LISTEN_PORT || 8000;

// const recordController = require("./router/recordController/router");

app.use(cookieParser());
app.use(express.json());
app.use(cors({
    origin: ["http://localhost:3001", "http://localhost:5173"],
    credentials: true,
}));
app.use(express.urlencoded({ extended: true }));

// const userRouter = require("./router/users/router");
// app.use("/api/v1/users", userRouter);
// app.use('/api/v1/records', recordController);

app.listen(port, () => {
    console.log(`Server listening at ${port}`);
});

module.exports = app;
