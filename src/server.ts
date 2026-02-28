console.log("ALL SET");

import express, { Express } from "express";
import dotenv from "dotenv";
import identifyRoute from "./routes/identify.route";

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.use("/api/v1/identify", identifyRoute);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
