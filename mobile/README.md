# Clean Mobile

Clean is an offline-first laundry shop management app — React Native, Expo SDK 54, TypeScript, Expo Go. This is the production mobile client (not a test screen).

Create `mobile/.env` from `.env.example` and set the address of the computer running the backend:

```text
EXPO_PUBLIC_API_BASE_URL=http://PC_LOCAL_IP:3000/api/v1
```

If the backend runs in Termux on the Android phone, use the phone's Wi-Fi IP instead. Do not use `localhost` or `127.0.0.1` when Expo Go runs on a physical phone.

Start the development client with:

```text
npx expo start
```

The public Expo variable is client-visible and must not contain secrets.
