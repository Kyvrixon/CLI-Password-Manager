# 🔐 Kyvrixon CLI Password Manager

A secure, modern CLI password manager built with TypeScript, featuring strong encryption and an intuitive terminal interface.

## 🚀 Features

- **🔒 Military-grade encryption** - All passwords encrypted with AES-256 using your master code
- **🎨 Beautiful terminal UI** - Clean, colorful interface that's easy on the eyes
- **🔍 Smart search** - Quickly find passwords with intelligent filtering
- **️ Secure by design** - Master code never stored, zero-knowledge architecture
- **⚡ Fast and responsive** - Built with Bun for lightning-fast performance
- **💾 Export/Import** - Backup and restore your vault securely
- **🎲 Password generation** - Generate strong, random passwords

## 🎯 Quick Start

### Prerequisites

- [Bun](https://bun.sh) runtime installed on your system

### Installation & Usage

1. **Clone or download** this repository
2. **Open terminal** and navigate to the project folder
3. **Install dependencies**:

   ```bash
   bun install
   ```

4. **Run the application**:

   ```bash
   bun start
   ```

### Alternative: Compiled Executable

You can also compile the app to a standalone executable:

```bash
# For Windows
bun run compile:win

# For Linux
bun run compile:linux

# For macOS
bun run compile:mac
```

## 🛠️ Development

```bash
# Install dependencies
bun install

# Run in development mode (with hot reload)
bun run dev

# Format code
bun run format

# Build for production
bun run build
```

## 🔐 Security

- **Zero-knowledge architecture**: Your master code is never stored anywhere
- **Strong encryption**: AES-256 encryption with 25,000 iterations
- **Local storage**: All data stays on your machine
- **Memory protection**: Sensitive data cleared from memory after use

## 📖 Usage Guide

1. **First run**: Set up your name and master code
2. **Main menu**: Choose from view, create, edit, delete, or utility options
3. **Master code**: Required for viewing/editing passwords
4. **Search**: Type to filter passwords by nickname

## ⚠️ Important Notes

- **Never share your master code** - It cannot be recovered if lost
- **Backup your vault** - Use the export feature regularly
- **Keep it secure** - Store backups in a safe location
- **Regular updates** - Check for new versions periodically

## 🏗️ Built With

- **TypeScript** - Type-safe development
- **Bun** - Fast JavaScript runtime
- **Inquirer** - Interactive command line interfaces
- **Colorette** - Terminal string styling
- **Ora** - Elegant terminal spinners
- **@kyvrixon/encryptor** - Secure encryption library
- **@kyvrixon/json-db** - Lightweight JSON database

## 📄 License

MIT License - see the LICENSE file for details.

### ⚡ Made with ❤️ by Kyvrixon**
