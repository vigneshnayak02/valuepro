# ValuePro Web App

## Overview
This repository contains a simple e-commerce web app and a separate admin panel.

## Open the App
1. Open `index.html` from the project root in your web browser.
2. The app supports:
   - Product search
   - Category filtering
   - Wishlist view
   - User login / signup via the authentication modal
   - Profile dropdown and logout
3. Use the top navigation to search products or open the wishlist.
4. Click the user icon to login or sign up.

## Open the Admin Panel
1. Open `admin/login.html` in your browser.
2. Use the hardcoded admin credentials to login:
   - Username: `viddu`
   - Password: `viddu@9951`
3. After login, you will be redirected to `admin/panel.html`.

## Admin Panel Features
- Add or edit products
- Delete selected products
- Upload product images or provide image URLs
- Import products via Excel
- Toggle featured product visibility
- Manage product categories and filters
- Logout using the admin panel button

## Notes
- The admin page uses `localStorage` to keep the admin session active.
- If you open the files directly and experience issues with module loading, use a local HTTP server instead of `file://`.
- The app uses Firebase for product and settings storage through `js/firebase-config.js`.

## File Structure
- `index.html` — main customer-facing app
- `signup.html`, `login.html`, `profile.html`, `wishlist.html` — supporting pages and flows
- `admin/login.html` — admin login page
- `admin/panel.html` — admin management panel
- `admin/js/panel.js` — admin panel logic
- `js/main.js` — app logic
- `js/firebase-config.js` — Firebase connection and config
