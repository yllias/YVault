document.addEventListener('DOMContentLoaded', () => {
    // DOM element selectors
    const importBtn = document.getElementById('import-btn');
    const metadataModal = document.getElementById('metadata-modal');
    const metadataForm = document.getElementById('metadata-form');
    const courseNameInput = document.getElementById('course-name');
    const courseNamesDatalist = document.getElementById('course-names');
    const weekNumberInput = document.getElementById('week-number');
    const startExtractionBtn = document.getElementById('start-extraction-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const courseList = document.getElementById('course-list');
    const exerciseViewer = document.getElementById('exercise-viewer');
    const exerciseImage = document.getElementById('exercise-image');
    const exerciseTitle = document.getElementById('exercise-title');
    const welcomeMessage = document.getElementById('welcome-message');
    const loadingIndicator = document.getElementById('loading-indicator');
    const searchBox = document.getElementById('search-box');
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const settingsForm = document.getElementById('settings-form');
    const keywordsInput = document.getElementById('keywords-input');
    const keywordTagList = document.getElementById('keyword-tag-list');
    const settingsCancelBtn = document.getElementById('settings-cancel-btn');
    const settingsSaveBtn = document.getElementById('settings-save-btn');
    const sidebar = document.getElementById('sidebar');
    const resizeHandle = document.getElementById('resize-handle');
    const tagArea = document.getElementById('tag-area');
    const tagList = document.getElementById('tag-list');
    const sortBy = document.getElementById('sort-by');
    const tagInput = document.getElementById('tag-input');

    // Application state
    let db = {}; // Stores organized exercise data: { "Course Name": { weeks: { "Week 1": [{ path: "path1.png", tags: ["tag1"] }] }, createdAt: timestamp } }
    let filteredDb = {}; // Stores filtered data for search
    let selectedExercise = null;
    let currentExerciseData = null; // Currently selected exercise object
    let isResizing = false;
    let currentKeywords = []; // Stores keywords for settings

    // Initialize app
    // Listen for persisted data from main process
    window.electronAPI.onLoadPersistedData((event, data) => {
        db = migrateDataStructure(data.exercises || {});
        filteredDb = db;
        renderSidebar();
    });

    // Event listeners
    importBtn.addEventListener('click', openMetadataModal);
    cancelBtn.addEventListener('click', closeMetadataModal);
    metadataForm.addEventListener('submit', handleExtractionStart);
    settingsBtn.addEventListener('click', openSettingsModal);
    settingsCancelBtn.addEventListener('click', closeSettingsModal);
    settingsForm.addEventListener('submit', handleSettingsSave);
    searchBox.addEventListener('input', handleSearch);
    tagInput.addEventListener('keydown', handleTagInput);
    sortBy.addEventListener('change', handleSortChange);
    keywordsInput.addEventListener('keydown', handleKeywordInput);

    // Remove any existing context menu when clicking elsewhere
    document.addEventListener('click', removeContextMenu);

    // Resizable sidebar
    resizeHandle.addEventListener('mousedown', startResize);


    // Event listeners
    importBtn.addEventListener('click', openMetadataModal);
    cancelBtn.addEventListener('click', closeMetadataModal);
    metadataForm.addEventListener('submit', handleExtractionStart);
    settingsBtn.addEventListener('click', openSettingsModal);
    settingsCancelBtn.addEventListener('click', closeSettingsModal);
    settingsForm.addEventListener('submit', handleSettingsSave);
    searchBox.addEventListener('input', handleSearch);
    tagInput.addEventListener('keydown', handleTagInput);
    sortBy.addEventListener('change', handleSortChange);

    // Remove any existing context menu when clicking elsewhere
    document.addEventListener('click', removeContextMenu);

    // Resizable sidebar
    resizeHandle.addEventListener('mousedown', startResize);

    function startResize(e) {
        isResizing = true;
        document.addEventListener('mousemove', handleResize);
        document.addEventListener('mouseup', stopResize);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    }

    function handleResize(e) {
        if (!isResizing) return;

        const newWidth = e.clientX;
        if (newWidth >= 200 && newWidth <= 500) {
            sidebar.style.width = newWidth + 'px';
        }
    }

    function stopResize() {
        isResizing = false;
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', stopResize);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }

    // Modal functions
    function openMetadataModal() {
        metadataModal.style.display = 'flex';
        courseNameInput.focus();

        // Populate datalist with existing course names
        courseNamesDatalist.innerHTML = '';
        Object.keys(db).forEach(courseName => {
            const option = document.createElement('option');
            option.value = courseName;
            courseNamesDatalist.appendChild(option);
        });
    }

    function closeMetadataModal() {
        metadataModal.style.display = 'none';
        metadataForm.reset();
    }

    async function openSettingsModal() {
        try {
            const settings = await window.electronAPI.getSettings();
            currentKeywords = settings.keywords ? settings.keywords.split(',').map(k => k.trim()) : [];
            renderKeywords();
            settingsModal.style.display = 'flex';
            keywordsInput.focus();
        } catch (error) {
            console.error('Failed to load settings:', error);
            alert('Failed to load settings');
        }
    }

    function closeSettingsModal() {
        settingsModal.style.display = 'none';
        settingsForm.reset();
    }

    async function handleSettingsSave(event) {
        event.preventDefault();

        const keywords = currentKeywords.join(',');

        try {
            const settings = { keywords };
            window.electronAPI.saveSettings(settings);
            closeSettingsModal();

            // Show success feedback
            const originalText = settingsSaveBtn.textContent;
            settingsSaveBtn.textContent = 'Saved!';
            setTimeout(() => {
                settingsSaveBtn.textContent = originalText;
            }, 1500);
        } catch (error) {
            console.error('Failed to save settings:', error);
            alert('Failed to save settings');
        }
    }

    // Keyword tagging functionality for settings
    function renderKeywords() {
        keywordTagList.innerHTML = '';
        currentKeywords.forEach(keyword => {
            const tagItem = document.createElement('div');
            tagItem.className = 'tag-item'; // Re-use existing tag-item style

            const tagText = document.createElement('span');
            tagText.textContent = keyword;

            const removeBtn = document.createElement('span');
            removeBtn.className = 'tag-remove-btn'; // Re-use existing tag-remove-btn style
            removeBtn.textContent = '×';
            removeBtn.addEventListener('click', () => {
                removeKeyword(keyword);
            });

            tagItem.appendChild(tagText);
            tagItem.appendChild(removeBtn);
            keywordTagList.appendChild(tagItem);
        });
    }

    function handleKeywordInput(event) {
        if (event.key === 'Enter' && keywordsInput.value.trim()) {
            const newKeyword = keywordsInput.value.trim().toLowerCase();
            if (!currentKeywords.includes(newKeyword)) {
                currentKeywords.push(newKeyword);
                renderKeywords();
            }
            keywordsInput.value = '';
        }
    }

    function removeKeyword(keywordToRemove) {
        currentKeywords = currentKeywords.filter(keyword => keyword !== keywordToRemove);
        renderKeywords();
    }

    // Handle extraction process
    async function handleExtractionStart(event) {
        event.preventDefault();

        const courseName = courseNameInput.value.trim();
        const weekNumber = weekNumberInput.value.trim();

        if (!courseName || !weekNumber) {
            alert('Please fill in all fields');
            return;
        }

        try {
            // Show file dialog to select PDF
            const result = await window.electronAPI.showOpenDialog();

            if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
                return; // User canceled file selection
            }

            const pdfPath = result.filePaths[0];

            // Close modal and show loading
            closeMetadataModal();
            showLoading();

            // Run extraction
            const imagePaths = await window.electronAPI.runExtraction({
                pdfPath,
                courseName,
                weekNumber
            });

            // Process results
            await handleExtractionComplete(courseName, weekNumber, imagePaths);

        } catch (error) {
            console.error('Extraction failed:', error);
            alert(`Extraction failed: ${error.message}`);
            hideLoading();
        }
    }

    // Data structure migration
    function migrateDataStructure(oldData) {
        const migratedData = {};

        Object.keys(oldData).forEach(courseName => {
            // If the course object already has a 'weeks' property, it's likely in the new format.
            if (oldData[courseName].weeks) {
                migratedData[courseName] = oldData[courseName];
                // Ensure older data has a createdAt timestamp
                if (!migratedData[courseName].createdAt) {
                    migratedData[courseName].createdAt = Date.now();
                }
                return;
            }

            migratedData[courseName] = {
                weeks: {},
                createdAt: Date.now() // Assign a timestamp for migration
            };

            Object.keys(oldData[courseName]).forEach(weekName => {
                migratedData[courseName].weeks[weekName] = oldData[courseName][weekName].map(exercise => {
                    if (typeof exercise === 'object' && exercise.path) {
                        return exercise;
                    }
                    return {
                        path: exercise,
                        tags: []
                    };
                });
            });
        });

        return migratedData;
    }

    // Handle successful extraction
    async function handleExtractionComplete(courseName, weekNumber, imagePaths) {
        hideLoading();

        if (!imagePaths || imagePaths.length === 0) {
            alert('No exercises found in the PDF');
            return;
        }

        // Store in database with new format
        if (!db[courseName]) {
            db[courseName] = {
                weeks: {},
                createdAt: Date.now()
            };
        }

        const weekKey = `Week ${weekNumber}`;
        db[courseName].weeks[weekKey] = imagePaths.map(path => ({ path, tags: [] }));

        // Save to persistent storage
        window.electronAPI.saveData(db);

        // Update filtered data and sidebar
        applyCurrentFilter();
        renderSidebar();

        // Display first exercise
        if (imagePaths.length > 0) {
            displayExercise(db[courseName].weeks[weekKey][0]);
        }
    }

    // Search and sort functionality
    function handleSearch(event) {
        const searchTerm = event.target.value.toLowerCase().trim();
        applyCurrentFilter(searchTerm);
        renderSidebar();
    }

    function handleSortChange() {
        renderSidebar();
    }

    function applyCurrentFilter(searchTerm = '') {
        if (!searchTerm) {
            filteredDb = db;
            return;
        }

        filteredDb = {};

        Object.keys(db).forEach(courseName => {
            const courseMatches = courseName.toLowerCase().includes(searchTerm);
            let hasMatchingContent = false;

            Object.keys(db[courseName].weeks).forEach(weekName => {
                const weekMatches = weekName.toLowerCase().includes(searchTerm);

                const matchingExercises = db[courseName].weeks[weekName].filter(exercise => {
                    return exercise.tags.some(tag => tag.toLowerCase().includes(searchTerm));
                });

                const hasTagMatches = matchingExercises.length > 0;

                if (courseMatches || weekMatches || hasTagMatches) {
                    if (!filteredDb[courseName]) {
                        filteredDb[courseName] = {
                            weeks: {},
                            createdAt: db[courseName].createdAt
                        };
                    }

                    if (hasTagMatches && !courseMatches && !weekMatches) {
                        filteredDb[courseName].weeks[weekName] = matchingExercises;
                    } else {
                        filteredDb[courseName].weeks[weekName] = db[courseName].weeks[weekName];
                    }

                    hasMatchingContent = true;
                }
            });

            if (courseMatches && !hasMatchingContent) {
                filteredDb[courseName] = { ...db[courseName] };
            }
        });
    }

    function getSortedData(data, sortByValue) {
        const sortedData = {};
        let sortedCourseNames;

        const courseNames = Object.keys(data);

        switch (sortByValue) {
            case 'course-asc':
                sortedCourseNames = courseNames.sort((a, b) => a.localeCompare(b));
                break;
            case 'course-desc':
                sortedCourseNames = courseNames.sort((a, b) => b.localeCompare(a));
                break;
            case 'date-newest':
                sortedCourseNames = courseNames.sort((a, b) => data[b].createdAt - data[a].createdAt);
                break;
            case 'date-oldest':
                sortedCourseNames = courseNames.sort((a, b) => data[a].createdAt - data[b].createdAt);
                break;
            default:
                sortedCourseNames = courseNames;
        }

        sortedCourseNames.forEach(courseName => {
            const course = { ...data[courseName] };

            // Sort weeks within each course
            const sortedWeekNames = Object.keys(course.weeks).sort((a, b) => {
                const numA = parseInt(a.replace('Week ', ''));
                const numB = parseInt(b.replace('Week ', ''));
                return numA - numB;
            });

            const sortedWeeks = {};
            sortedWeekNames.forEach(weekName => {
                const week = [...course.weeks[weekName]];

                // Sort exercises within each week
                week.sort((a, b) => {
                    const extractNumber = (path) => {
                        const match = path.match(/exercise_(\d+)\.png$/);
                        return match ? parseInt(match[1]) : 0;
                    };
                    return extractNumber(a.path) - extractNumber(b.path);
                });
                sortedWeeks[weekName] = week;
            });
            course.weeks = sortedWeeks;
            sortedData[courseName] = course;
        });

        return sortedData;
    }

    // UI state management
    function showLoading() {
        welcomeMessage.style.display = 'none';
        exerciseViewer.style.display = 'none';
        loadingIndicator.style.display = 'block';
    }

    function hideLoading() {
        loadingIndicator.style.display = 'none';
    }

    function displayExercise(exerciseData) {
        // Convert file path to file:// URL for display
        const imageUrl = `file://${exerciseData.path}`;
        exerciseImage.src = imageUrl;

        // Set exercise title
        const fileName = exerciseData.path.split('/').pop().replace('.png', '');
        exerciseTitle.textContent = fileName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

        // Store current exercise data
        currentExerciseData = exerciseData;

        // Render tags
        renderTags(exerciseData);

        welcomeMessage.style.display = 'none';
        exerciseViewer.style.display = 'block';

        // Update selected state
        updateSelectedExercise(exerciseData.path);
    }

    function updateSelectedExercise(imagePath) {
        // Remove previous selection
        const previousSelected = document.querySelector('.exercise-item.active');
        if (previousSelected) {
            previousSelected.classList.remove('active');
        }

        // Add selection to current exercise
        const exerciseItems = document.querySelectorAll('.exercise-item');
        exerciseItems.forEach(item => {
            if (item.dataset.imagePath === imagePath) {
                item.classList.add('active');
            }
        });

        selectedExercise = imagePath;
    }

    // Helper functions for state preservation
    function getOpenIds() {
        const openDetails = document.querySelectorAll('details[open]');
        const openIds = new Set();
        openDetails.forEach(detail => {
            if (detail.id) {
                openIds.add(detail.id);
            }
        });
        return openIds;
    }

    function setOpenStates(openIds) {
        openIds.forEach(id => {
            const element = document.getElementById(id);
            if (element && element.tagName === 'DETAILS') {
                element.open = true;
            }
        });
    }

    function generateUniqueId(type, courseName, weekName = '') {
        // Create safe IDs by removing special characters and spaces
        const safeCourse = courseName.replace(/[^a-zA-Z0-9]/g, '-');
        if (type === 'course') {
            return `course-${safeCourse}`;
        } else if (type === 'week') {
            const safeWeek = weekName.replace(/[^a-zA-Z0-9]/g, '-');
            return `week-${safeCourse}-${safeWeek}`;
        }
        return '';
    }

    // Sidebar rendering with collapsible structure
    function renderSidebar() {
        // Preserve current open state
        const openIds = getOpenIds();

        // Clear existing content
        courseList.innerHTML = '';

        const sortByValue = sortBy.value;
        const dataToRender = getSortedData(
            Object.keys(filteredDb).length > 0 ? filteredDb : db,
            sortByValue
        );

        if (Object.keys(dataToRender).length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-message';
            emptyMessage.style.cssText = 'text-align: center; color: #888888; margin-top: 40px; font-size: 14px;';
            emptyMessage.textContent = searchBox.value ? 'No exercises found' : 'No exercises yet';
            courseList.appendChild(emptyMessage);
            return;
        }

        Object.keys(dataToRender).forEach(courseName => {
            // Create course details element
            const courseDetails = document.createElement('details');
            courseDetails.className = 'course-details';
            courseDetails.id = generateUniqueId('course', courseName);

            // Open courses by default if no previous state exists
            const courseId = generateUniqueId('course', courseName);
            if (!openIds.has(courseId) && Object.keys(openIds).length === 0) {
                courseDetails.open = true;
            }

            // Create course summary
            const courseSummary = document.createElement('summary');
            courseSummary.className = 'course-summary';
            courseSummary.textContent = courseName;

            // Add context menu for course
            courseSummary.addEventListener('contextmenu', (event) => {
                showCourseContextMenu(event, courseName);
            });

            courseDetails.appendChild(courseSummary);

            // Process weeks for this course
            Object.keys(dataToRender[courseName].weeks).forEach(weekName => {
                // Create week details element
                const weekDetails = document.createElement('details');
                weekDetails.className = 'week-details';
                weekDetails.id = generateUniqueId('week', courseName, weekName);

                // Create week summary
                const weekSummary = document.createElement('summary');
                weekSummary.className = 'week-summary';
                weekSummary.textContent = weekName;

                // Add context menu for week
                weekSummary.addEventListener('contextmenu', (event) => {
                    showWeekContextMenu(event, courseName, weekName);
                });

                weekDetails.appendChild(weekSummary);

                // Create exercise list
                const exerciseList = document.createElement('ul');
                exerciseList.className = 'exercise-list';

                // Add exercises to the list
                dataToRender[courseName].weeks[weekName].forEach((exerciseData, index) => {
                    const exerciseItem = document.createElement('li');
                    exerciseItem.className = 'exercise-item';
                    exerciseItem.textContent = `Exercise ${index + 1}`;
                    exerciseItem.dataset.imagePath = exerciseData.path;

                    // Add click handler
                    exerciseItem.addEventListener('click', () => {
                        displayExercise(exerciseData);
                    });

                    // Add context menu handler
                    exerciseItem.addEventListener('contextmenu', (event) => {
                        showContextMenu(event, exerciseData, courseName, weekName, index);
                    });

                    exerciseList.appendChild(exerciseItem);
                });

                // Append exercise list to week details
                weekDetails.appendChild(exerciseList);

                // Append week details to course details
                courseDetails.appendChild(weekDetails);
            });

            // Append course details to the course list
            courseList.appendChild(courseDetails);
        });

        // Restore previously open states
        setOpenStates(openIds);
    }

    // Context menu functionality
    function showCourseContextMenu(event, courseName) {
        event.preventDefault();
        removeContextMenu();

        const contextMenu = document.createElement('div');
        contextMenu.className = 'context-menu';
        contextMenu.style.left = event.clientX + 'px';
        contextMenu.style.top = event.clientY + 'px';

        // Delete course option
        const deleteItem = document.createElement('div');
        deleteItem.className = 'context-menu-item danger';
        deleteItem.textContent = 'Delete Course';
        deleteItem.addEventListener('click', () => {
            handleCourseDelete(courseName);
            removeContextMenu();
        });

        contextMenu.appendChild(deleteItem);
        document.body.appendChild(contextMenu);

        // Position adjustment if menu goes off screen
        const rect = contextMenu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            contextMenu.style.left = (event.clientX - rect.width) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            contextMenu.style.top = (event.clientY - rect.height) + 'px';
        }
    }

    function showWeekContextMenu(event, courseName, weekName) {
        event.preventDefault();
        removeContextMenu();

        const contextMenu = document.createElement('div');
        contextMenu.className = 'context-menu';
        contextMenu.style.left = event.clientX + 'px';
        contextMenu.style.top = event.clientY + 'px';

        // Delete week option
        const deleteItem = document.createElement('div');
        deleteItem.className = 'context-menu-item danger';
        deleteItem.textContent = 'Delete Week';
        deleteItem.addEventListener('click', () => {
            handleWeekDelete(courseName, weekName);
            removeContextMenu();
        });

        contextMenu.appendChild(deleteItem);
        document.body.appendChild(contextMenu);

        // Position adjustment if menu goes off screen
        const rect = contextMenu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            contextMenu.style.left = (event.clientX - rect.width) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            contextMenu.style.top = (event.clientY - rect.height) + 'px';
        }
    }

    function showContextMenu(event, exerciseData, courseName, weekName, exerciseIndex) {
        event.preventDefault();
        removeContextMenu();

        const contextMenu = document.createElement('div');
        contextMenu.className = 'context-menu';
        contextMenu.style.left = event.clientX + 'px';
        contextMenu.style.top = event.clientY + 'px';

        // Rename option
        const renameItem = document.createElement('div');
        renameItem.className = 'context-menu-item';
        renameItem.textContent = 'Rename';
        renameItem.addEventListener('click', () => {
            handleRename(exerciseData, courseName, weekName, exerciseIndex);
            removeContextMenu();
        });

        // Delete option
        const deleteItem = document.createElement('div');
        deleteItem.className = 'context-menu-item danger';
        deleteItem.textContent = 'Delete';
        deleteItem.addEventListener('click', () => {
            handleDelete(exerciseData, courseName, weekName, exerciseIndex);
            removeContextMenu();
        });

        contextMenu.appendChild(renameItem);
        contextMenu.appendChild(deleteItem);
        document.body.appendChild(contextMenu);

        // Position adjustment if menu goes off screen
        const rect = contextMenu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            contextMenu.style.left = (event.clientX - rect.width) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            contextMenu.style.top = (event.clientY - rect.height) + 'px';
        }
    }

    function removeContextMenu() {
        const existingMenu = document.querySelector('.context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
    }

    async function handleRename(exerciseData, courseName, weekName, exerciseIndex) {
        const currentName = exerciseData.path.split('/').pop().replace('.png', '');
        const newName = prompt('Enter new name:', currentName);

        if (!newName || newName === currentName) return;

        const pathParts = exerciseData.path.split('/');
        pathParts[pathParts.length - 1] = newName + '.png';
        const newPath = pathParts.join('/');

        try {
            const result = await window.electronAPI.renameExercise({
                oldPath: exerciseData.path,
                newPath
            });

            if (result.success) {
                // Update the path in the database
                db[courseName].weeks[weekName][exerciseIndex].path = result.newPath;

                // Save to persistent storage
                window.electronAPI.saveData(db);

                // Re-render sidebar and update current view if this exercise is selected
                applyCurrentFilter(searchBox.value);
                renderSidebar();

                if (currentExerciseData && currentExerciseData.path === exerciseData.path) {
                    currentExerciseData.path = result.newPath;
                    displayExercise(currentExerciseData);
                }
            } else {
                alert(`Failed to rename: ${result.error}`);
            }
        } catch (error) {
            alert(`Failed to rename: ${error.message}`);
        }
    }

    async function handleDelete(exerciseData, courseName, weekName, exerciseIndex) {
        try {
            const result = await window.electronAPI.deleteExercise({ path: exerciseData.path });

            if (result.success) {
                // Remove from database
                db[courseName].weeks[weekName].splice(exerciseIndex, 1);

                // If week is now empty, remove it
                if (db[courseName].weeks[weekName].length === 0) {
                    delete db[courseName].weeks[weekName];

                    // If course is now empty, remove it
                    if (Object.keys(db[courseName].weeks).length === 0) {
                        delete db[courseName];
                    }
                }

                // Save to persistent storage
                window.electronAPI.saveData(db);

                // Clear current view if this exercise was selected
                if (currentExerciseData && currentExerciseData.path === exerciseData.path) {
                    welcomeMessage.style.display = 'block';
                    exerciseViewer.style.display = 'none';
                    currentExerciseData = null;
                }

                // Re-render sidebar
                applyCurrentFilter(searchBox.value);
                renderSidebar();
            } else if (!result.cancelled) {
                alert(`Failed to delete: ${result.error}`);
            }
        } catch (error) {
            alert(`Failed to delete: ${error.message}`);
        }
    }

    async function handleWeekDelete(courseName, weekName) {
        try {
            // Get all exercise paths for this week
            const exercisePaths = db[courseName].weeks[weekName].map(exercise => exercise.path);

            const result = await window.electronAPI.deleteWeek({
                courseName,
                weekName,
                exercisePaths
            });

            if (result.success || result.partialSuccess) {
                // Remove week from database
                delete db[courseName].weeks[weekName];

                // If course is now empty, remove it
                if (Object.keys(db[courseName].weeks).length === 0) {
                    delete db[courseName];
                }

                // Save to persistent storage
                window.electronAPI.saveData(db);

                // Clear current view if any exercise from this week was selected
                if (currentExerciseData && result.deletedPaths.includes(currentExerciseData.path)) {
                    welcomeMessage.style.display = 'block';
                    exerciseViewer.style.display = 'none';
                    currentExerciseData = null;
                }

                // Re-render sidebar
                applyCurrentFilter(searchBox.value);
                renderSidebar();

                if (result.partialSuccess) {
                    alert(`Week partially deleted. ${result.failedPaths.length} file(s) could not be deleted.`);
                }
            } else if (!result.cancelled) {
                alert(`Failed to delete week: ${result.error}`);
            }
        } catch (error) {
            alert(`Failed to delete week: ${error.message}`);
        }
    }

    async function handleCourseDelete(courseName) {
        try {
            // Get all exercise paths for this course
            const allExercisePaths = [];
            Object.keys(db[courseName].weeks).forEach(weekName => {
                db[courseName].weeks[weekName].forEach(exercise => {
                    allExercisePaths.push(exercise.path);
                });
            });

            const result = await window.electronAPI.deleteCourse({
                courseName,
                allExercisePaths
            });

            if (result.success || result.partialSuccess) {
                // Remove course from database
                delete db[courseName];

                // Save to persistent storage
                window.electronAPI.saveData(db);

                // Clear current view if any exercise from this course was selected
                if (currentExerciseData && result.deletedPaths.includes(currentExerciseData.path)) {
                    welcomeMessage.style.display = 'block';
                    exerciseViewer.style.display = 'none';
                    currentExerciseData = null;
                }

                // Re-render sidebar
                applyCurrentFilter(searchBox.value);
                renderSidebar();

                if (result.partialSuccess) {
                    alert(`Course partially deleted. ${result.failedPaths.length} file(s) could not be deleted.`);
                }
            } else if (!result.cancelled) {
                alert(`Failed to delete course: ${result.error}`);
            }
        } catch (error) {
            alert(`Failed to delete course: ${error.message}`);
        }
    }

    // Tagging functionality
    function renderTags(exerciseData) {
        tagList.innerHTML = '';

        exerciseData.tags.forEach(tag => {
            const tagItem = document.createElement('div');
            tagItem.className = 'tag-item';

            const tagText = document.createElement('span');
            tagText.textContent = tag;

            const removeBtn = document.createElement('span');
            removeBtn.className = 'tag-remove-btn';
            removeBtn.textContent = '×';
            removeBtn.addEventListener('click', () => {
                removeTag(exerciseData, tag);
            });

            tagItem.appendChild(tagText);
            tagItem.appendChild(removeBtn);
            tagList.appendChild(tagItem);
        });
    }

    function handleTagInput(event) {
        if (event.key === 'Enter' && tagInput.value.trim() && currentExerciseData) {
            const newTag = tagInput.value.trim().toLowerCase();

            // Don't add duplicate tags
            if (!currentExerciseData.tags.includes(newTag)) {
                currentExerciseData.tags.push(newTag);

                // Save to persistent storage
                window.electronAPI.saveData(db);

                // Re-render tags
                renderTags(currentExerciseData);
            }

            tagInput.value = '';
        }
    }

    function removeTag(exerciseData, tagToRemove) {
        exerciseData.tags = exerciseData.tags.filter(tag => tag !== tagToRemove);

        // Save to persistent storage
        window.electronAPI.saveData(db);

        // Re-render tags
        renderTags(exerciseData);
    }

    // Close modals when clicking outside
    metadataModal.addEventListener('click', (event) => {
        if (event.target === metadataModal) {
            closeMetadataModal();
        }
    });

    settingsModal.addEventListener('click', (event) => {
        if (event.target === settingsModal) {
            closeSettingsModal();
        }
    });

    // Handle escape key to close modals
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            if (metadataModal.style.display === 'flex') {
                closeMetadataModal();
            } else if (settingsModal.style.display === 'flex') {
                closeSettingsModal();
            }
        }
    });
});
