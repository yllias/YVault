const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const Store = require('electron-store');
const store = new Store();

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, 'assets', 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    mainWindow.loadFile('index.html');

    // Send persisted data to renderer after content is loaded
    mainWindow.webContents.once('did-finish-load', () => {
        const persistedData = store.get('exercises', {});
        const settings = store.get('settings', { keywords: 'Tutoraufgabe,Exercise,Hausaufgabe' });
        mainWindow.webContents.send('load-persisted-data', { exercises: persistedData, settings });
    });

    // Open DevTools in development
    // mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// IPC handler for running PDF extraction
ipcMain.handle('run-extraction', async (event, args) => {
    const { pdfPath, courseName, weekNumber } = args;

    try {
        // Create unique output directory
        const userDataPath = app.getPath('userData');
        const outputDir = path.join(userDataPath, 'extractions', courseName, `week-${weekNumber}`);

        // Ensure output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Get custom keywords from store
        const settings = store.get('settings', { keywords: 'Tutoraufgabe,Exercise,Hausaufgabe' });

        // Execute bundled Python executable
        return new Promise((resolve, reject) => {
            const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
            const extractorPath = isDev
                ? path.join(__dirname, 'build', 'extractor')
                : path.join(process.resourcesPath, 'extractor');

            const pythonProcess = spawn(extractorPath, [
                '--pdf_path', pdfPath,
                '--output_dir', outputDir,
                '--keywords', settings.keywords
            ]);

            let output = '';
            let errorOutput = '';

            pythonProcess.stdout.on('data', (data) => {
                output += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            pythonProcess.on('close', (code) => {
                if (code === 0) {
                    // Parse the comma-separated file paths from output
                    const filePaths = output.trim().split(',').filter(path => path.length > 0);
                    resolve(filePaths);
                } else {
                    reject(new Error(`Python script failed with code ${code}: ${errorOutput}`));
                }
            });

            pythonProcess.on('error', (error) => {
                reject(new Error(`Failed to start Python script: ${error.message}`));
            });
        });

    } catch (error) {
        throw new Error(`Extraction failed: ${error.message}`);
    }
});

// IPC handler for opening file dialog
ipcMain.handle('show-open-dialog', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
            { name: 'PDF Files', extensions: ['pdf'] }
        ]
    });

    return result;
});

// IPC handler for saving exercise data
ipcMain.on('save-data', (event, data) => {
    store.set('exercises', data);
});

// IPC handler for getting settings
ipcMain.handle('get-settings', () => {
    return store.get('settings', { keywords: 'Tutoraufgabe,Exercise,Hausaufgabe' });
});

// IPC handler for saving settings
ipcMain.on('save-settings', (event, settings) => {
    store.set('settings', settings);
});

// IPC handler for renaming exercise files
ipcMain.handle('rename-exercise', async (event, { oldPath, newPath }) => {
    try {
        fs.renameSync(oldPath, newPath);
        return { success: true, newPath };
    } catch (error) {
        console.error('Failed to rename:', error);
        return { success: false, error: error.message };
    }
});

// IPC handler for deleting exercise files
ipcMain.handle('delete-exercise', async (event, { path }) => {
    try {
        // First show a native confirmation dialog
        const choice = dialog.showMessageBoxSync({
            type: 'warning',
            buttons: ['Cancel', 'Delete'],
            defaultId: 1,
            title: 'Confirm Deletion',
            message: 'Are you sure you want to delete this exercise?',
            detail: `You are about to permanently delete:\n${path}`
        });

        if (choice === 1) { // If 'Delete' was clicked
            fs.unlinkSync(path);
            return { success: true };
        }
        return { success: false, cancelled: true };
    } catch (error) {
        console.error('Failed to delete:', error);
        return { success: false, error: error.message };
    }
});

// IPC handler for deleting entire weeks (all exercises in a week)
ipcMain.handle('delete-week', async (event, { courseName, weekName, exercisePaths }) => {
    try {
        const choice = dialog.showMessageBoxSync({
            type: 'warning',
            buttons: ['Cancel', 'Delete'],
            defaultId: 1,
            title: 'Confirm Week Deletion',
            message: `Are you sure you want to delete "${weekName}" from "${courseName}"?`,
            detail: `This will permanently delete ${exercisePaths.length} exercise(s).`
        });

        if (choice === 1) { // If 'Delete' was clicked
            // Delete all exercise files in the week
            const deletedPaths = [];
            const failedPaths = [];

            exercisePaths.forEach(exercisePath => {
                try {
                    fs.unlinkSync(exercisePath);
                    deletedPaths.push(exercisePath);
                } catch (error) {
                    console.error(`Failed to delete ${exercisePath}:`, error);
                    failedPaths.push(exercisePath);
                }
            });

            return {
                success: failedPaths.length === 0,
                deletedPaths,
                failedPaths,
                partialSuccess: deletedPaths.length > 0 && failedPaths.length > 0
            };
        }
        return { success: false, cancelled: true };
    } catch (error) {
        console.error('Failed to delete week:', error);
        return { success: false, error: error.message };
    }
});

// IPC handler for deleting entire courses (all weeks and exercises in a course)
ipcMain.handle('delete-course', async (event, { courseName, allExercisePaths }) => {
    try {
        const choice = dialog.showMessageBoxSync({
            type: 'warning',
            buttons: ['Cancel', 'Delete'],
            defaultId: 1,
            title: 'Confirm Course Deletion',
            message: `Are you sure you want to delete the entire course "${courseName}"?`,
            detail: `This will permanently delete ${allExercisePaths.length} exercise(s) across all weeks.`
        });

        if (choice === 1) { // If 'Delete' was clicked
            // Delete all exercise files in the course
            const deletedPaths = [];
            const failedPaths = [];

            allExercisePaths.forEach(exercisePath => {
                try {
                    fs.unlinkSync(exercisePath);
                    deletedPaths.push(exercisePath);
                } catch (error) {
                    console.error(`Failed to delete ${exercisePath}:`, error);
                    failedPaths.push(exercisePath);
                }
            });

            // Try to remove empty directories
            try {
                const courseDir = path.dirname(allExercisePaths[0]);
                if (fs.existsSync(courseDir)) {
                    const files = fs.readdirSync(courseDir);
                    if (files.length === 0) {
                        fs.rmdirSync(courseDir);
                    }
                }
            } catch (error) {
                console.log('Could not remove course directory:', error.message);
            }

            return {
                success: failedPaths.length === 0,
                deletedPaths,
                failedPaths,
                partialSuccess: deletedPaths.length > 0 && failedPaths.length > 0
            };
        }
        return { success: false, cancelled: true };
    } catch (error) {
        console.error('Failed to delete course:', error);
        return { success: false, error: error.message };
    }
});