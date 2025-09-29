import app from "./app";
import config from "./config/config";
import dotenv from "dotenv";

dotenv.config();
const PORT: string | number = config.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
