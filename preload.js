const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    runExtraction: (args) => ipcRenderer.invoke('run-extraction', args),
    showOpenDialog: () => ipcRenderer.invoke('show-open-dialog'),
    saveData: (data) => ipcRenderer.send('save-data', data),
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.send('save-settings', settings),
    onLoadPersistedData: (callback) => ipcRenderer.on('load-persisted-data', callback),
    renameExercise: (payload) => ipcRenderer.invoke('rename-exercise', payload),
    deleteExercise: (payload) => ipcRenderer.invoke('delete-exercise', payload),
    deleteWeek: (payload) => ipcRenderer.invoke('delete-week', payload),
    deleteCourse: (payload) => ipcRenderer.invoke('delete-course', payload)
});