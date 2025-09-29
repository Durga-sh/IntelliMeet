"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAuthenticated = exports.generateToken = exports.authenticate = void 0;
const passport_1 = __importDefault(require("passport"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = __importDefault(require("../config/config"));
// Authentication middleware
exports.authenticate = passport_1.default.authenticate("jwt", { session: false });
// Generate JWT token
const generateToken = (user) => {
    if (!config_1.default.JWT_SECRET) {
        throw new Error("JWT_SECRET is not defined");
    }
    return jsonwebtoken_1.default.sign({ id: user._id, email: user.email, role: user.role }, config_1.default.JWT_SECRET, { expiresIn: "7d" });
};
exports.generateToken = generateToken;
// Check if user is authenticated
const isAuthenticated = (req, res, next) => {
    passport_1.default.authenticate("jwt", { session: false }, (err, user) => {
        if (err) {
            return next(err);
        }
        if (!user) {
            res
                .status(401)
                .json({ message: "Unauthorized access - please log in" });
            return;
        }
        req.user = user;
        next();
    })(req, res, next);
};
exports.isAuthenticated = isAuthenticated;
