# 📡 Optibit – Bluetooth & WiFi Messenger

> Real Bluetooth Chat · WiFi Direct · Image/Video/Voice Sharing · No Internet Required · PWA Technology

## 🎯 Project Overview

Optibit is a real Bluetooth and WiFi Direct messaging web application. It uses the **Web Bluetooth API** for device discovery and connection, and **WebRTC DataChannels** for WiFi Direct peer-to-peer communication. Users can send text messages, images, videos, voice notes, and files — all without needing an internet connection.

**Created by:** Cozytustudios  
**Founded by:** Sajid Hossain

---

## ✅ Completed Features

### Landing Page (`index.html`)
- **Hero Section** with animated gradient text and branding
- **Animated particle background** with interactive mouse tracking
- **Loading screen** with branded animation
- **Trust bar** showcasing key differentiators
- **Features section** (6 feature cards with hover effects)
- **Security section** with animated visuals
- **Comparison table** (Optibit vs competitors)
- **Team section** and download CTA
- **Fully responsive** for all screen sizes

### Messenger App (`app.html`)
- **Splash Screen** with animated branding
- **Onboarding Flow** (3 slides explaining Bluetooth, WiFi, Media features)
- **Profile Setup** with avatar color picker and display name
- **Desktop + Mobile Responsive Layout**
  - Desktop: Sidebar (380-420px) + Content area with chat view
  - Mobile: Full-screen tabs with slide-over chat view
- **Tab Navigation**: Chats, Nearby, Settings
- **Real Bluetooth Integration**
  - Turn Bluetooth On/Off toggle
  - Web Bluetooth API device scanning (browser device picker)
  - GATT server connection
  - Characteristic-based data transfer
  - Device disconnection detection
- **WiFi Direct Mode (WebRTC)**
  - Room code generation and sharing
  - WebRTC DataChannel for peer communication
  - STUN server ICE candidate exchange
- **Chat System**
  - Real-time messaging with message bubbles
  - Message status indicators (sent/delivered/read)
  - Chat list with unread badges
  - Search conversations
  - Connection type display (Bluetooth/WiFi)
  - Online/offline status
- **Rich Media Sharing**
  - 📷 Image sending with preview
  - 🎥 Video sending with inline player
  - 🎤 Voice recording with waveform visualization
  - 📄 File/document sharing
  - Full-screen media viewer
- **Voice Recording**
  - MediaRecorder API integration
  - Real-time timer display
  - Waveform animation
  - Cancel or send controls
- **Settings**
  - Profile editing
  - Bluetooth & WiFi status display
  - Theme selection (Deep Blue, Midnight, Neon, Sunset)
  - Notification toggle
  - Local storage usage display
  - Clear all data option
- **PWA Support**
  - Service worker with offline caching
  - Installable as standalone app
  - Web manifest with app icons

---

## 📁 File Structure

```
optibit/
├── index.html          → Landing page
├── app.html            → Messenger application
├── style.css           → Landing page styles
├── app.css             → App styles (desktop + mobile)
├── animations.css      → CSS animations
├── main.js             → Landing page JavaScript
├── app.js              → App JavaScript (Bluetooth, WebRTC, Chat)
├── particles.js        → Particle background animation
├── sw.js               → Service Worker
├── manifest.json       → PWA manifest
├── icon.png            → App icon
├── images/
└── README.md           → This file
```

---

## 🔗 Functional Entry URIs

| Path | Description |
|------|-------------|
| `/` or `/index.html` | Landing page with feature overview |
| `/app.html` | Full messenger application |

---

## 🛠 Technology Stack

- **Web Bluetooth API** – Device discovery and BLE communication
- **WebRTC DataChannels** – WiFi Direct peer-to-peer messaging
- **MediaRecorder API** – Voice note recording
- **localStorage** – Chat persistence and settings storage
- **Service Worker** – Offline caching (PWA)
- **CSS Custom Properties** – Theme system
- **Font Awesome 6** – Icons
- **Google Fonts (Inter)** – Typography

---

## ⚠️ Browser Compatibility

| Feature | Chrome | Edge | Opera | Firefox | Safari |
|---------|--------|------|-------|---------|--------|
| Web Bluetooth | ✅ | ✅ | ✅ | ❌ | ❌ |
| WebRTC | ✅ | ✅ | ✅ | ✅ | ✅ |
| MediaRecorder | ✅ | ✅ | ✅ | ✅ | ✅ |
| Service Worker | ✅ | ✅ | ✅ | ✅ | ✅ |

> **Note:** Web Bluetooth requires Chrome, Edge, or Opera. WiFi Direct mode (WebRTC) works in all modern browsers.

---

## 🚀 Recommended Next Steps

1. **Signaling Server** – Add a lightweight WebSocket signaling server for WebRTC peer discovery
2. **QR Code Pairing** – Generate QR codes containing SDP offers for easy WiFi Direct pairing
3. **End-to-End Encryption** – Implement AES-256 encryption using Web Crypto API
4. **File Chunking** – Improve large file transfer with chunked DataChannel sends
5. **Group Chat** – Re-implement group chat with multi-peer WebRTC mesh
6. **Push Notifications** – Add web push for background message alerts
7. **IndexedDB** – Migrate from localStorage to IndexedDB for larger storage capacity
8. **BLE Mesh Networking** – Implement BLE mesh for multi-hop communication

---

## 📝 Notes

- Bluetooth scanning uses the browser's native device picker (user must click "Scan" to trigger)
- WiFi Direct uses room codes for manual peer exchange (no signaling server required)
- All chat data is stored locally in the browser's localStorage
- Media files (images, videos, voice notes) use blob URLs which expire on page reload
- The app works offline once cached by the service worker

---

© 2026 Optibit by **Cozytustudios**. Founded by **Sajid Hossain**. All rights reserved.
