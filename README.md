# Skybound Realms ☁️🏝️

A 3D multiplayer voxel sandbox game built with **Three.js**, **Node.js**, and **WebSockets**. Explore floating islands, chop trees, collect wood logs, craft wooden boxes, build structures, and interact with other players in real-time.

## 🌟 Features
- **3D Floating World**: Procedurally generated floating island aesthetic built with custom Low-Poly Three.js shaders & meshes.
- **Real-Time Multiplayer**: WebSockets-powered player sync (movement, physics, avatar customization).
- **Accounts & Authentication**: Persistent player accounts (Register & Login) with deterministic avatar colors generated from email.
- **Inventory & Crafting**: Craftable wooden storage boxes, stackable inventory slots, item drops, and block placement.
- **Server Persistence**: World state, tree health, placed blocks, player inventories, and user credentials saved automatically to disk (`data/`).

## 🚀 Running Locally

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start Game Server (WebSockets)**:
   ```bash
   node server.js
   ```

3. **Start Frontend Dev Server**:
   ```bash
   npm run dev
   ```

4. Open your browser at `http://localhost:5173`.
