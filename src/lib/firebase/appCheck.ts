// import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
// import { app } from "./clientApp";

// declare global {
//   // This adds the `self._FIREBASE_APPCHECK_DEBUG_TOKEN` property
//   interface Window {
//     FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean;
//   }
// }

// export const initializeAppCheckForEnvironment = () => {
//   if (process.env.NODE_ENV === "development") {
//     // Warning: Do not use debug tokens in production!
//     window.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
//   }

//   // Initialize App Check
//   const appCheck = initializeAppCheck(app, {
//     provider: new ReCaptchaV3Provider(
//       // Replace this with your reCAPTCHA v3 site key
//       process.env.REACT_APP_RECAPTCHA_SITE_KEY!
//     ),
//     isTokenAutoRefreshEnabled: true, // Recommended for production
//   });

//   return appCheck;
// };
