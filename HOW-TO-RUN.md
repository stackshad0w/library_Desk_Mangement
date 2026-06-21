# How to run the Library system on your laptop

This app runs **entirely on your own laptop**. Your data is saved on the laptop
and never leaves it — no internet account needed.

---

## One-time setup (do this once)

1. **Install Node.js** (the engine that runs the app).
   - Go to **https://nodejs.org** and download the **LTS** version (22.13 or newer).
   - Run the installer and click *Next* until it finishes.

2. **Put the project folder somewhere easy**, like your Desktop.

That's it for setup.

---

## Every day: starting the app

1. Open the project folder.
2. Double-click **`start-library.bat`**.
3. A black window opens and says *"Starting the library system…"*.
   - The **first time only**, it spends a minute installing components — that's normal.
4. Your web browser opens automatically at **http://localhost:3000**.
5. Log in:
   - **Username:** `admin`
   - **Password:** `admin123`

> Keep the black window **open** while you use the app. To **stop** the app,
> just close that black window.

---

## Good to know

- **Your data is saved automatically** on the laptop (in the `data` folder).
  Closing the app does **not** lose anything.
- **Works without internet.** The only feature that uses the internet is sending
  WhatsApp messages (it opens WhatsApp for you to press *Send*).
- **Want it as a desktop app?** In Chrome/Edge, open the menu (⋮) →
  *Install Swami Abhyasika* to get a proper app icon.

---

## Changing the admin password (optional, recommended)

1. In the project folder, open the file named **`.env`** with Notepad.
2. Add a line like this (use your own password):

   ```
   ADMIN_PASSWORD=choose-a-strong-password
   ```

3. **Delete the `data` folder once** so the new password takes effect, then start
   the app again. (Only do this before you've added real students — deleting
   `data` clears existing records.)

---

## If something goes wrong

- **"Node.js is not installed"** in the black window → install Node.js (step 1 above) and try again.
- **Browser didn't open** → open it yourself and go to **http://localhost:3000**.
- **"Port already in use"** → the app is probably already running in another window; close the extra window.

---

### For Mac / Linux users

Open a terminal in the project folder and run:

```bash
npm install   # first time only
npm start
```

Then open **http://localhost:3000** in your browser.
