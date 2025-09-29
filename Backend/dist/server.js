"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const config_1 = __importDefault(require("./config/config"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const PORT = config_1.default.PORT || 5000;
app_1.default.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
