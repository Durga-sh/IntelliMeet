import passport from "passport";
import { Strategy as GoogleStrategy, Profile } from "passport-google-oauth20";
import {
  Strategy as JwtStrategy,
  ExtractJwt,
  StrategyOptions,
} from "passport-jwt";
import User from "../models/User";
import config from "./config";
import { OAuth2Client } from "google-auth-library";
import { Document } from "mongoose";

interface UserDocument extends Document {
  _id: string;
  googleId?: string;
  email: string;
  name: string;
  avatar?: string;
}
const jwtOptions: StrategyOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: config.JWT_SECRET,
};

passport.use(
  new JwtStrategy(jwtOptions, async (payload: any, done: any) => {
    try {
      const user = await User.findById(payload.id);
      if (user) {
        return done(null, user);
      }
      return done(null, false);
    } catch (error) {
      return done(error, false);
    }
  })
);

passport.use(
  new GoogleStrategy(
    {
      clientID: config.GOOGLE_CLIENT_ID,
      clientSecret: config.GOOGLE_CLIENT_SECRET,
      callbackURL: config.GOOGLE_CALLBACK_URL,
    },
    async (
      accessToken: string,
      refreshToken: string,
      profile: Profile,
      done: any
    ) => {
      try {
        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
    
          user = new User({
            googleId: profile.id,
            email: profile.emails?.[0].value,
            name: profile.displayName,
            avatar: profile.photos?.[0].value,
          });
          await user.save();
        }

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

const client = new OAuth2Client(config.GOOGLE_CLIENT_ID);

export { passport, client };
