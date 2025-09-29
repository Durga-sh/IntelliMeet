"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.client = exports.passport = void 0;
const passport_1 = __importDefault(require("passport"));
exports.passport = passport_1.default;
const passport_google_oauth20_1 = require("passport-google-oauth20");
const passport_jwt_1 = require("passport-jwt");
const User_1 = __importDefault(require("../models/User"));
const config_1 = __importDefault(require("./config"));
const google_auth_library_1 = require("google-auth-library");
// JWT Strategy
const jwtOptions = {
    jwtFromRequest: passport_jwt_1.ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: config_1.default.JWT_SECRET,
};
passport_1.default.use(new passport_jwt_1.Strategy(jwtOptions, async (payload, done) => {
    try {
        const user = await User_1.default.findById(payload.id);
        if (user) {
            return done(null, user);
        }
        return done(null, false);
    }
    catch (error) {
        return done(error, false);
    }
}));
// Google Strategy
passport_1.default.use(new passport_google_oauth20_1.Strategy({
    clientID: config_1.default.GOOGLE_CLIENT_ID,
    clientSecret: config_1.default.GOOGLE_CLIENT_SECRET,
    callbackURL: config_1.default.GOOGLE_CALLBACK_URL,
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Check if user exists
        let user = await User_1.default.findOne({ googleId: profile.id });
        if (!user) {
            // Create new user
            user = new User_1.default({
                googleId: profile.id,
                email: profile.emails?.[0].value,
                name: profile.displayName,
                avatar: profile.photos?.[0].value,
            });
            await user.save();
        }
        return done(null, user);
    }
    catch (error) {
        return done(error, null);
    }
}));
const client = new google_auth_library_1.OAuth2Client(config_1.default.GOOGLE_CLIENT_ID);
exports.client = client;
