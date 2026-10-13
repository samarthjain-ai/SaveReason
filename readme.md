# SaveReason 🧠

**Save what matters. Remember why.**

SaveReason is a smart memory-saving project designed to help users capture useful information from the web and organize it for future reference. It combines a web dashboard with a browser extension to make saving and revisiting information easier.

## ✨ Features

- **Quick saving:** Save useful web content and URLs for later.
- **Browser extension:** Capture information while browsing.
- **Memory dashboard:** View and manage saved memories in one place.
- **Memory management:** Organize and delete saved items.
- **User-friendly interface:** A clean dashboard with helpful interactions.
- **Backend integration:** Connects the application interface with backend services.

## 🛠️ Tech Stack

Update this list to match the technologies actually used in the project.

- Frontend: Add your frontend framework or technologies
- Backend: Node.js
- API integration: Add the AI provider currently configured
- Browser extension: JavaScript, HTML, CSS
- Version control: Git and GitHub

## 📁 Project Structure

```text
SaveReason/
├── Extension/
│   ├── logo/
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.css
│   ├── popup.js
│   └── service-worker.js
├── memoryEngine.js
├── server.js
├── package.json
├── package-lock.json
├── make-icons.mjs
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js and npm
- Git
- Google Chrome or another compatible Chromium browser

### 1. Clone the repository

```bash
git clone https://github.com/samarthjain-ai/SaveReason.git
cd SaveReason
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file if required by the backend. Add the API credentials and configuration expected by the application.

**Important:** Never commit API keys, passwords, or other secrets to GitHub.

### 4. Start the backend

Check `package.json` for the available scripts, then run the appropriate command. For example, if a `start` script exists:

```bash
npm start
```

### 5. Load the browser extension

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the project's `Extension` folder.

Follow any additional setup instructions required by the backend.

## 👥 Team

Add the names and responsibilities of the actual project contributors here.

| Team member | Responsibility |
|---|---|
| Add name | Project development |
| Add name | Frontend / dashboard |
| Add name | Backend / integration |

## 🔮 Future Improvements

- Enhanced memory search and organization
- More flexible memory customization
- Improved reliability and error handling
- Additional integrations and user experience improvements

## 🤝 Contributing

1. Clone the repository.
2. Create a feature branch.
3. Make and test your changes.
4. Commit and push your branch.
5. Open a pull request for review.

## 📄 License

Add a license before describing this project as open source.

---

Built with ❤️ for a hackathon.