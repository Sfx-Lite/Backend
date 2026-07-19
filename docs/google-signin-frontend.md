# Google Sign-In — Frontend Workflow (SPA / React)

This app uses the **redirect-free Google sign-in**: the browser gets a Google
**ID token** and POSTs it to our API, which verifies it and returns our own
access + refresh tokens. There is **no OAuth redirect** and **no `redirect_uri`**.

---

## 1. One-time setup


```
# Vite
VITE_GOOGLE_CLIENT_ID=627399728070-xxxxxxxx.apps.googleusercontent.com
VITE_API_URL=http://localhost:4000/api/v1
```

> Use the framework-appropriate prefix: `NEXT_PUBLIC_` (Next.js),
> `REACT_APP_` (CRA), `VITE_` (Vite). The Client ID is the **same** value the
> backend uses; it is safe to ship in the browser bundle.


**Load the Google Identity Services script** once (e.g. in `index.html`):

```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

---

## 2. The endpoints

| Method & path | Purpose | Auth |
|---|---|---|
| `GET  /auth/google/nonce` | (Optional) get a single-use nonce for replay protection | Public |
| `POST /auth/google/verify` | Send the Google ID token, get our tokens back | Public |

All paths are under the API prefix, e.g. `http://localhost:4000/api/v1/auth/...`.

Standard response envelope everywhere:

```json
{ "status": true, "message": "...", "data": { ... } }
```

---

## 3. Flow

```
1. (optional) GET /auth/google/nonce            -> { data: { nonce } }
2. google.accounts.id.initialize({ client_id, nonce?, callback })
3. user picks their Google account
4. Google calls your callback with { credential }   // credential = ID token
5. POST /auth/google/verify  { idToken: credential }
6. <- { data: { accessToken, refreshToken, user } }
7. store tokens; send `Authorization: Bearer <accessToken>` on API calls
```

The **nonce is optional**. Include it for replay protection (recommended for
production); omit it and step 1 disappears entirely.

---

## 4. React example

```tsx
import { useEffect } from 'react';

const API = import.meta.env.VITE_API_URL;
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

declare const google: any;

export function GoogleLoginButton({ onLoggedIn }: { onLoggedIn: (data: any) => void }) {
  useEffect(() => {
    (async () => {
      // 1. (optional) get a single-use nonce for replay protection
      const nonceRes = await fetch(`${API}/auth/google/nonce`);
      const { data: { nonce } } = await nonceRes.json();

      // 2. init Google Identity Services
      google.accounts.id.initialize({
        client_id: CLIENT_ID,
        nonce, // omit this line to skip replay protection
        callback: async ({ credential }: { credential: string }) => {
          // 5. send the ID token to our API
          const res = await fetch(`${API}/auth/google/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: credential }),
          });

          if (!res.ok) {
            // 401 => token invalid/expired/unverified, or nonce already used
            console.error('Google login failed', await res.json());
            return;
          }

          const { data } = await res.json(); // { accessToken, refreshToken, user }
          // 7. persist tokens (in memory / secure storage) and continue
          onLoggedIn(data);
        },
      });

      // render the Google button into <div id="google-btn" />
      google.accounts.id.renderButton(
        document.getElementById('google-btn'),
        { theme: 'outline', size: 'large' },
      );
    })();
  }, []);

  return <div id="google-btn" />;
}
```

---

## 5. Using the tokens

After login you get:

```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<jwt>",
  "user": { "id": "...", "username": "...", "email": "...", "firstName": "...", "lastName": "...", "role": "..." }
}
```


---

## 6. Notes / gotchas

- A nonce is **single-use and expires in 10 minutes** — fetch a fresh one per
  sign-in attempt. Reusing one returns 401.
- New Google users are auto-created on first sign-in; returning users are
  matched by Google ID (or linked by email). No separate signup call needed.
