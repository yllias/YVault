# YVault

YVault is a cross-platform desktop application designed to help students and educators efficiently manage course exercise sheets. It allows users to upload PDF exercise sheets, automatically extract individual exercises based on keywords, and group them for better organization and study.

Built with Electron (frontend) and Python (backend) for robust PDF processing and data extraction.

## Setup

To get started with YVault, follow these steps:

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/yllias/YVault.git
    cd YVault
    ```

2.  **Install Node.js dependencies**:
    ```bash
    npm install
    ```

3.  **Install Python dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

## Usage

To run the application in development mode:

```bash
npm start
```

For production builds, refer to the `package.json` scripts for `electron-builder` commands.