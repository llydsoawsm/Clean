# Phase 1 Foundation

The mobile application uses React Native, Expo, TypeScript, and Expo Go. Start it with `npx expo start`.

The Expo application reads `EXPO_PUBLIC_API_BASE_URL` from `mobile/.env`. The backend reads its configuration from `server/.env`.

For a phone-hosted development server, set the mobile URL to:

```text
EXPO_PUBLIC_API_BASE_URL=http://PHONE_LOCAL_IP:3000/api/v1
```

The phone and the development device must be connected to the same Wi-Fi network. The backend is intentionally configured for local development and should not be exposed publicly.
