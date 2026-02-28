console.log("ALL SET");

import express, { Express } from "express";
import dotenv from "dotenv";
import identifyRoute from "./routes/identify.route";

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/v1", (req, res) => {
  res.send(
    "Hello!! \n welcome to the biteSpeed identity API server. \n Please use /identify to identify the user.",
  );
});

app.use("/api/v1/identify", identifyRoute);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
