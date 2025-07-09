const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

// Global variables with error-safe initialization
let decorationTypes = new Map();
let timeout = null;
let logger = null;
let errorCount = 0;
const MAX_ERRORS = 10;

// Error-safe logger
function createLogger() {
    try {
        return vscode.window.createOutputChannel('Comment Wizard');
    } catch (error) {
        console.error('Failed to create logger:', error);
        return null;
    }
}

function logError(message, error = null) {
    try {
        if (logger) {
            logger.appendLine(`[ERROR] ${message}`);
            if (error) {
                logger.appendLine(`[ERROR] Details: ${error.message || error.toString()}`);
            }
        }
        console.error(message, error);
        
        // Prevent spam by limiting errors
        errorCount++;
        if (errorCount > MAX_ERRORS) {
            if (logger) {
                logger.appendLine(`[ERROR] Too many errors (${errorCount}), stopping logging`);
            }
            return;
        }
    } catch (logError) {
        console.error('Failed to log error:', logError);
    }
}

function logInfo(message) {
    try {
        if (logger) {
            logger.appendLine(`[INFO] ${message}`);
        }
        console.log(message);
    } catch (error) {
        console.error('Failed to log info:', error);
    }
}

function activate(context) {
    try {
        logger = createLogger();
        logInfo('Comment Wizard Phase 3 initializing...');
        
        // Reset error count
        errorCount = 0;
        
        // Initialize with error handling
        initializeExtension(context);
        
        // Register commands with error handling
        registerCommands(context);
        
        logInfo('Comment Wizard Phase 3 is now active!');
        
    } catch (error) {
        logError('Failed to activate extension', error);
        vscode.window.showErrorMessage('Comment Wizard failed to activate. See output for details.');
    }
}

function initializeExtension(context) {
    try {
        // Initialize decoration types
        updateDecorationTypes();
        
        // Apply decorations to active editor
        if (vscode.window.activeTextEditor) {
            updateDecorations(vscode.window.activeTextEditor);
        }
        
        // Register event listeners with error handling
        registerEventListeners(context);
        
    } catch (error) {
        logError('Failed to initialize extension', error);
        throw error;
    }
}

function registerEventListeners(context) {
    try {
        // Listen for active editor changes
        vscode.window.onDidChangeActiveTextEditor(editor => {
            try {
                if (editor) {
                    updateDecorations(editor);
                }
            } catch (error) {
                logError('Error in active editor change handler', error);
            }
        }, null, context.subscriptions);
        
        // Listen for document changes
        vscode.workspace.onDidChangeTextDocument(event => {
            try {
                if (vscode.window.activeTextEditor && event.document === vscode.window.activeTextEditor.document) {
                    triggerUpdateDecorations(vscode.window.activeTextEditor);
                }
            } catch (error) {
                logError('Error in document change handler', error);
            }
        }, null, context.subscriptions);
        
        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration(event => {
            try {
                if (event.affectsConfiguration('commentWizard')) {
                    updateDecorationTypes();
                    if (vscode.window.activeTextEditor) {
                        updateDecorations(vscode.window.activeTextEditor);
                    }
                }
            } catch (error) {
                logError('Error in configuration change handler', error);
            }
        }, null, context.subscriptions);
        
    } catch (error) {
        logError('Failed to register event listeners', error);
        throw error;
    }
}

function registerCommands(context) {
    try {
        // Add keyword command
        const addKeywordCommand = vscode.commands.registerCommand('commentWizard.addKeyword', async () => {
            try {
                await addCustomKeyword();
            } catch (error) {
                logError('Error in add keyword command', error);
                vscode.window.showErrorMessage('Failed to add keyword. See output for details.');
            }
        });
        
        // Remove keyword command
        const removeKeywordCommand = vscode.commands.registerCommand('commentWizard.removeKeyword', async () => {
            try {
                await removeKeyword();
            } catch (error) {
                logError('Error in remove keyword command', error);
                vscode.window.showErrorMessage('Failed to remove keyword. See output for details.');
            }
        });
        
        // Export theme command
        const exportThemeCommand = vscode.commands.registerCommand('commentWizard.exportTheme', async () => {
            try {
                await exportTheme();
            } catch (error) {
                logError('Error in export theme command', error);
                vscode.window.showErrorMessage('Failed to export theme. See output for details.');
            }
        });
        
        // Import theme command
        const importThemeCommand = vscode.commands.registerCommand('commentWizard.importTheme', async () => {
            try {
                await importTheme();
            } catch (error) {
                logError('Error in import theme command', error);
                vscode.window.showErrorMessage('Failed to import theme. See output for details.');
            }
        });
        
        // Reset to default command
        const resetCommand = vscode.commands.registerCommand('commentWizard.resetToDefault', async () => {
            try {
                await resetToDefault();
            } catch (error) {
                logError('Error in reset command', error);
                vscode.window.showErrorMessage('Failed to reset to default. See output for details.');
            }
        });
        
        // Add all commands to subscriptions
        context.subscriptions.push(
            addKeywordCommand,
            removeKeywordCommand,
            exportThemeCommand,
            importThemeCommand,
            resetCommand
        );
        
    } catch (error) {
        logError('Failed to register commands', error);
        throw error;
    }
}

function updateDecorationTypes() {
    try {
        // Dispose existing decoration types safely
        if (decorationTypes && decorationTypes.size > 0) {
            decorationTypes.forEach(decorationType => {
                try {
                    if (decorationType && typeof decorationType.dispose === 'function') {
                        decorationType.dispose();
                    }
                } catch (error) {
                    logError('Error disposing decoration type', error);
                }
            });
        }
        decorationTypes.clear();
        
        const config = vscode.workspace.getConfiguration('commentWizard');
        const keywords = safeMergeKeywords(config);
        const highlightStyle = config.get('highlightStyle', 'text');
        const fontWeight = config.get('fontWeight', 'bold');
        const showIcons = config.get('showIcons', false);
        
        // Validate and limit keywords
        const validKeywords = validateKeywords(keywords);
        
        // Create new decoration types
        Object.entries(validKeywords).forEach(([keyword, color]) => {
            try {
                const decorationOptions = createDecorationOptions(keyword, color, highlightStyle, fontWeight, showIcons);
                const decorationType = vscode.window.createTextEditorDecorationType(decorationOptions);
                decorationTypes.set(keyword, decorationType);
            } catch (error) {
                logError(`Error creating decoration for keyword '${keyword}'`, error);
            }
        });
        
    } catch (error) {
        logError('Failed to update decoration types', error);
    }
}

function safeMergeKeywords(config) {
    try {
        const defaultKeywords = config.get('keywords', {});
        const customKeywords = config.get('customKeywords', {});
        
        // Validate that both are objects
        if (typeof defaultKeywords !== 'object' || typeof customKeywords !== 'object') {
            logError('Keywords are not objects, using defaults');
            return getDefaultKeywords();
        }
        
        return { ...defaultKeywords, ...customKeywords };
    } catch (error) {
        logError('Error merging keywords', error);
        return getDefaultKeywords();
    }
}

function validateKeywords(keywords) {
    try {
        const config = vscode.workspace.getConfiguration('commentWizard');
        const minLength = config.get('minKeywordLength', 2);
        const maxKeywords = config.get('maxKeywords', 50);
        
        const validKeywords = {};
        let count = 0;
        
        for (const [keyword, color] of Object.entries(keywords)) {
            if (count >= maxKeywords) {
                logError(`Maximum keywords (${maxKeywords}) exceeded, ignoring '${keyword}'`);
                break;
            }
            
            if (validateKeyword(keyword, color, minLength)) {
                validKeywords[keyword] = color;
                count++;
            }
        }
        
        return validKeywords;
    } catch (error) {
        logError('Error validating keywords', error);
        return getDefaultKeywords();
    }
}

function validateKeyword(keyword, color, minLength) {
    try {
        // Validate keyword
        if (typeof keyword !== 'string' || keyword.length < minLength) {
            logError(`Invalid keyword: '${keyword}' (too short)`);
            return false;
        }
        
        // Basic regex characters check
        if (!/^[a-zA-Z0-9_-]+$/.test(keyword)) {
            logError(`Invalid keyword: '${keyword}' (contains invalid characters)`);
            return false;
        }
        
        // Validate color
        if (typeof color !== 'string' || !isValidColor(color)) {
            logError(`Invalid color for keyword '${keyword}': ${color}`);
            return false;
        }
        
        return true;
    } catch (error) {
        logError('Error validating keyword', error);
        return false;
    }
}

function isValidColor(color) {
    try {
        // Basic color validation
        return /^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(color);
    } catch (error) {
        return false;
    }
}

function createDecorationOptions(keyword, color, highlightStyle, fontWeight, showIcons) {
    try {
        const decorationOptions = {
            fontWeight: fontWeight || 'bold'
        };
        
        // Add icon if enabled
        if (showIcons) {
            const icon = getIconForKeyword(keyword);
            if (icon) {
                decorationOptions.before = {
                    contentText: icon,
                    margin: '0 4px 0 0'
                };
            }
        }
        
        // Apply style based on highlight style
        switch (highlightStyle) {
            case 'background':
                decorationOptions.backgroundColor = color + '33'; // Add transparency
                decorationOptions.color = color;
                break;
            case 'border':
                decorationOptions.border = `1px solid ${color}`;
                decorationOptions.color = color;
                break;
            case 'underline':
                decorationOptions.textDecoration = `underline ${color}`;
                decorationOptions.color = color;
                break;
            default: // text
                decorationOptions.color = color;
        }
        
        return decorationOptions;
    } catch (error) {
        logError('Error creating decoration options', error);
        return { color: '#ffffff', fontWeight: 'bold' };
    }
}

function getIconForKeyword(keyword) {
    const iconMap = {
        'TODO': '📝',
        'FIXME': '🔧',
        'NOTE': '📝',
        'WARNING': '⚠️',
        'HACK': '🔨',
        'BUG': '🐛',
        'REVIEW': '👀',
        'DEPRECATED': '⚠️'
    };
    
    return iconMap[keyword.toUpperCase()] || '📌';
}

function triggerUpdateDecorations(editor) {
    try {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => {
            try {
                updateDecorations(editor);
            } catch (error) {
                logError('Error in delayed decoration update', error);
            }
        }, 100);
    } catch (error) {
        logError('Error triggering decoration update', error);
    }
}

function updateDecorations(editor) {
    try {
        const config = vscode.workspace.getConfiguration('commentWizard');
        
        if (!config.get('enabled', true)) {
            return;
        }
        
        if (!editor || !editor.document) {
            return;
        }
        
        const document = editor.document;
        const languageId = document.languageId;
        
        // Get comment patterns for this language
        const commentPatterns = getCommentPatterns(languageId);
        if (!commentPatterns || commentPatterns.length === 0) {
            return; // Unsupported language
        }
        
        const keywords = safeMergeKeywords(config);
        const caseSensitive = config.get('caseSensitive', false);
        
        // Clear existing decorations safely
        clearDecorations(editor);
        
        // Find comment matches
        const validKeywords = validateKeywords(keywords);
        Object.keys(validKeywords).forEach(keyword => {
            try {
                const decorationType = decorationTypes.get(keyword);
                if (!decorationType) return;
                
                const ranges = findCommentKeywords(document, keyword, commentPatterns, caseSensitive);
                if (ranges && ranges.length > 0) {
                    editor.setDecorations(decorationType, ranges);
                }
            } catch (error) {
                logError(`Error processing keyword '${keyword}'`, error);
            }
        });
        
    } catch (error) {
        logError('Error updating decorations', error);
    }
}

function clearDecorations(editor) {
    try {
        if (decorationTypes && decorationTypes.size > 0) {
            decorationTypes.forEach(decorationType => {
                try {
                    if (decorationType && typeof decorationType.setDecorations === 'function') {
                        editor.setDecorations(decorationType, []);
                    }
                } catch (error) {
                    logError('Error clearing decoration', error);
                }
            });
        }
    } catch (error) {
        logError('Error clearing decorations', error);
    }
}

function getCommentPatterns(languageId) {
    try {
        const patterns = {
            javascript: [
                { type: 'single', pattern: /\/\/.*$/gm },
                { type: 'multi', pattern: /\/\*[\s\S]*?\*\//gm }
            ],
            typescript: [
                { type: 'single', pattern: /\/\/.*$/gm },
                { type: 'multi', pattern: /\/\*[\s\S]*?\*\//gm }
            ],
            python: [
                { type: 'single', pattern: /#.*$/gm },
                { type: 'multi', pattern: /"""[\s\S]*?"""/gm },
                { type: 'multi', pattern: /'''[\s\S]*?'''/gm }
            ],
            java: [
                { type: 'single', pattern: /\/\/.*$/gm },
                { type: 'multi', pattern: /\/\*[\s\S]*?\*\//gm }
            ],
            c: [
                { type: 'single', pattern: /\/\/.*$/gm },
                { type: 'multi', pattern: /\/\*[\s\S]*?\*\//gm }
            ],
            cpp: [
                { type: 'single', pattern: /\/\/.*$/gm },
                { type: 'multi', pattern: /\/\*[\s\S]*?\*\//gm }
            ],
            csharp: [
                { type: 'single', pattern: /\/\/.*$/gm },
                { type: 'multi', pattern: /\/\*[\s\S]*?\*\//gm }
            ],
            html: [
                { type: 'multi', pattern: /<!--[\s\S]*?-->/gm }
            ],
            css: [
                { type: 'multi', pattern: /\/\*[\s\S]*?\*\//gm }
            ],
            sql: [
                { type: 'single', pattern: /--.*$/gm },
                { type: 'multi', pattern: /\/\*[\s\S]*?\*\//gm }
            ],
            php: [
                { type: 'single', pattern: /\/\/.*$/gm },
                { type: 'single', pattern: /#.*$/gm },
                { type: 'multi', pattern: /\/\*[\s\S]*?\*\//gm }
            ],
            ruby: [
                { type: 'single', pattern: /#.*$/gm },
                { type: 'multi', pattern: /=begin[\s\S]*?=end/gm }
            ],
            go: [
                { type: 'single', pattern: /\/\/.*$/gm },
                { type: 'multi', pattern: /\/\*[\s\S]*?\*\//gm }
            ],
            rust: [
                { type: 'single', pattern: /\/\/.*$/gm },
                { type: 'multi', pattern: /\/\*[\s\S]*?\*\//gm }
            ],
            kotlin: [
                { type: 'single', pattern: /\/\/.*$/gm },
                { type: 'multi', pattern: /\/\*[\s\S]*?\*\//gm }
            ],
            swift: [
                { type: 'single', pattern: /\/\/.*$/gm },
                { type: 'multi', pattern: /\/\*[\s\S]*?\*\//gm }
            ],
            xml: [
                { type: 'multi', pattern: /<!--[\s\S]*?-->/gm }
            ],
			yaml: [
                { type: 'single', pattern: /#.*$/gm }
            ],
            shell: [
                { type: 'single', pattern: /#.*$/gm }
            ],
            bash: [
                { type: 'single', pattern: /#.*$/gm }
            ],
            dockerfile: [
                { type: 'single', pattern: /#.*$/gm }
            ],
            powershell: [
                { type: 'single', pattern: /#.*$/gm }
            ],
            r: [
                { type: 'single', pattern: /#.*$/gm }
            ],
            lua: [
                { type: 'single', pattern: /--.*$/gm },
                { type: 'multi', pattern: /--\[\[[\s\S]*?\]\]/gm }
            ],
            perl: [
                { type: 'single', pattern: /#.*$/gm }
            ],
            dart: [
                { type: 'single', pattern: /\/\/.*$/gm },
                { type: 'multi', pattern: /\/\*[\s\S]*?\*\//gm }
            ],
            scala: [
                { type: 'single', pattern: /\/\/.*$/gm },
                { type: 'multi', pattern: /\/\*[\s\S]*?\*\//gm }
            ]
        };
        
        return patterns[languageId] || [];
    } catch (error) {
        logError('Error getting comment patterns', error);
        return [];
    }
}

function findCommentKeywords(document, keyword, commentPatterns, caseSensitive) {
    try {
        const ranges = [];
        const text = document.getText();
        const config = vscode.workspace.getConfiguration('commentWizard');
        const enableRegex = config.get('enableRegexKeywords', false);
        
        // Handle regex keywords if enabled
        if (enableRegex && isRegexKeyword(keyword)) {
            return findRegexKeywords(document, keyword, commentPatterns, caseSensitive);
        }
        
        commentPatterns.forEach(pattern => {
            try {
                let match;
                
                while ((match = pattern.pattern.exec(text)) !== null) {
                    const commentText = match[0];
                    const commentStart = match.index;
                    
                    // Look for keyword in this comment
                    const flags = caseSensitive ? 'g' : 'gi';
                    const keywordRegex = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, flags);
                    let keywordMatch;
                    
                    while ((keywordMatch = keywordRegex.exec(commentText)) !== null) {
                        const startPos = document.positionAt(commentStart + keywordMatch.index);
                        const endPos = document.positionAt(commentStart + keywordMatch.index + keyword.length);
                        
                        ranges.push(new vscode.Range(startPos, endPos));
                    }
                }
                
                // Reset regex lastIndex for global patterns
                pattern.pattern.lastIndex = 0;
            } catch (error) {
                logError(`Error processing pattern for keyword '${keyword}'`, error);
            }
        });
        
        return ranges;
    } catch (error) {
        logError('Error finding comment keywords', error);
        return [];
    }
}

function isRegexKeyword(keyword) {
    try {
        // Check if keyword starts and ends with / indicating regex
        return keyword.startsWith('/') && keyword.endsWith('/') && keyword.length > 2;
    } catch (error) {
        return false;
    }
}

function findRegexKeywords(document, regexKeyword, commentPatterns, caseSensitive) {
    try {
        const ranges = [];
        const text = document.getText();
        
        // Extract regex pattern from /pattern/ format
        const regexPattern = regexKeyword.slice(1, -1);
        const flags = caseSensitive ? 'g' : 'gi';
        
        commentPatterns.forEach(pattern => {
            try {
                let match;
                
                while ((match = pattern.pattern.exec(text)) !== null) {
                    const commentText = match[0];
                    const commentStart = match.index;
                    
                    // Apply user regex pattern
                    const userRegex = new RegExp(regexPattern, flags);
                    let regexMatch;
                    
                    while ((regexMatch = userRegex.exec(commentText)) !== null) {
                        const startPos = document.positionAt(commentStart + regexMatch.index);
                        const endPos = document.positionAt(commentStart + regexMatch.index + regexMatch[0].length);
                        
                        ranges.push(new vscode.Range(startPos, endPos));
                    }
                }
                
                pattern.pattern.lastIndex = 0;
            } catch (error) {
                logError(`Error processing regex pattern '${regexKeyword}'`, error);
            }
        });
        
        return ranges;
    } catch (error) {
        logError('Error finding regex keywords', error);
        return [];
    }
}

function escapeRegExp(string) {
    try {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    } catch (error) {
        logError('Error escaping regex', error);
        return string;
    }
}

function getDefaultKeywords() {
    return {
        "TODO": "#00BFFF",
        "FIXME": "#FF4500",
        "NOTE": "#32CD32",
        "WARNING": "#FFD700",
        "HACK": "#9932CC",
        "BUG": "#FF0000",
        "REVIEW": "#FF69B4",
        "DEPRECATED": "#808080"
    };
}

// Command implementations
async function addCustomKeyword() {
    try {
        const keyword = await vscode.window.showInputBox({
            prompt: 'Enter keyword (e.g., TODO, URGENT, or /regex/)',
            placeHolder: 'Keyword or /regex pattern/',
            validateInput: (value) => {
                if (!value || value.trim().length < 2) {
                    return 'Keyword must be at least 2 characters long';
                }
                if (!/^[a-zA-Z0-9_/-]+$/.test(value)) {
                    return 'Keyword contains invalid characters';
                }
                return null;
            }
        });
        
        if (!keyword) return;
        
        const color = await vscode.window.showInputBox({
            prompt: 'Enter color (hex format)',
            placeHolder: '#FF0000',
            value: '#FF0000',
            validateInput: (value) => {
                if (!isValidColor(value)) {
                    return 'Please enter a valid hex color (e.g., #FF0000)';
                }
                return null;
            }
        });
        
        if (!color) return;
        
        const config = vscode.workspace.getConfiguration('commentWizard');
        const customKeywords = config.get('customKeywords', {});
        
        customKeywords[keyword.trim()] = color.trim();
        
        await config.update('customKeywords', customKeywords, vscode.ConfigurationTarget.Global);
        
        vscode.window.showInformationMessage(`Added keyword: ${keyword} with color ${color}`);
        
    } catch (error) {
        logError('Error adding custom keyword', error);
        throw error;
    }
}

async function removeKeyword() {
    try {
        const config = vscode.workspace.getConfiguration('commentWizard');
        const keywords = config.get('keywords', {});
        const customKeywords = config.get('customKeywords', {});
        
        const allKeywords = { ...keywords, ...customKeywords };
        const keywordList = Object.keys(allKeywords);
        
        if (keywordList.length === 0) {
            vscode.window.showInformationMessage('No keywords to remove');
            return;
        }
        
        const selectedKeyword = await vscode.window.showQuickPick(keywordList, {
            placeHolder: 'Select keyword to remove'
        });
        
        if (!selectedKeyword) return;
        
        // Remove from custom keywords if it exists there
        if (customKeywords[selectedKeyword]) {
            delete customKeywords[selectedKeyword];
            await config.update('customKeywords', customKeywords, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Removed keyword: ${selectedKeyword}`);
        } else {
            vscode.window.showWarningMessage(`Cannot remove built-in keyword: ${selectedKeyword}. You can override it by adding a custom keyword with the same name.`);
        }
        
    } catch (error) {
        logError('Error removing keyword', error);
        throw error;
    }
}

async function exportTheme() {
    try {
        const config = vscode.workspace.getConfiguration('commentWizard');
        
        const theme = {
            name: `Comment Wizard Theme - ${new Date().toISOString().split('T')[0]}`,
            version: "1.0.0",
            keywords: config.get('keywords', {}),
            customKeywords: config.get('customKeywords', {}),
            settings: {
                caseSensitive: config.get('caseSensitive', false),
                highlightStyle: config.get('highlightStyle', 'text'),
                fontWeight: config.get('fontWeight', 'bold'),
                showIcons: config.get('showIcons', false),
                enableRegexKeywords: config.get('enableRegexKeywords', false)
            }
        };
        
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file('comment-wizard-theme.json'),
            filters: {
                'JSON files': ['json']
            }
        });
        
        if (uri) {
            await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(theme, null, 2)));
            vscode.window.showInformationMessage(`Theme exported to: ${uri.fsPath}`);
        }
        
    } catch (error) {
        logError('Error exporting theme', error);
        throw error;
    }
}

async function importTheme() {
    try {
        const uri = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'JSON files': ['json']
            }
        });
        
        if (!uri || uri.length === 0) return;
        
        const fileContent = await vscode.workspace.fs.readFile(uri[0]);
        const theme = JSON.parse(fileContent.toString());
        
        // Validate theme structure
        if (!theme.keywords && !theme.customKeywords) {
            vscode.window.showErrorMessage('Invalid theme file: missing keywords');
            return;
        }
        
        const config = vscode.workspace.getConfiguration('commentWizard');
        
        // Import keywords
        if (theme.keywords) {
            await config.update('keywords', theme.keywords, vscode.ConfigurationTarget.Global);
        }
        
        if (theme.customKeywords) {
            await config.update('customKeywords', theme.customKeywords, vscode.ConfigurationTarget.Global);
        }
        
        // Import settings if available
        if (theme.settings) {
            const settings = theme.settings;
            if (settings.caseSensitive !== undefined) {
                await config.update('caseSensitive', settings.caseSensitive, vscode.ConfigurationTarget.Global);
            }
            if (settings.highlightStyle !== undefined) {
                await config.update('highlightStyle', settings.highlightStyle, vscode.ConfigurationTarget.Global);
            }
            if (settings.fontWeight !== undefined) {
                await config.update('fontWeight', settings.fontWeight, vscode.ConfigurationTarget.Global);
            }
            if (settings.showIcons !== undefined) {
                await config.update('showIcons', settings.showIcons, vscode.ConfigurationTarget.Global);
            }
            if (settings.enableRegexKeywords !== undefined) {
                await config.update('enableRegexKeywords', settings.enableRegexKeywords, vscode.ConfigurationTarget.Global);
            }
        }
        
        vscode.window.showInformationMessage(`Theme imported successfully: ${theme.name || 'Unnamed theme'}`);
        
    } catch (error) {
        logError('Error importing theme', error);
        vscode.window.showErrorMessage('Failed to import theme. Please check the file format.');
        throw error;
    }
}

async function resetToDefault() {
    try {
        const result = await vscode.window.showWarningMessage(
            'This will reset all Comment Wizard settings to default values. Continue?',
            'Yes',
            'No'
        );
        
        if (result !== 'Yes') return;
        
        const config = vscode.workspace.getConfiguration('commentWizard');
        
        // Reset all settings to default
        await config.update('keywords', getDefaultKeywords(), vscode.ConfigurationTarget.Global);
        await config.update('customKeywords', {}, vscode.ConfigurationTarget.Global);
        await config.update('caseSensitive', false, vscode.ConfigurationTarget.Global);
        await config.update('highlightStyle', 'text', vscode.ConfigurationTarget.Global);
        await config.update('fontWeight', 'bold', vscode.ConfigurationTarget.Global);
        await config.update('showIcons', false, vscode.ConfigurationTarget.Global);
        await config.update('enableRegexKeywords', false, vscode.ConfigurationTarget.Global);
        
        vscode.window.showInformationMessage('Comment Wizard settings reset to default values');
        
    } catch (error) {
        logError('Error resetting to default', error);
        throw error;
    }
}

function deactivate() {
    try {
        logInfo('Comment Wizard is deactivating...');
        
        // Clear timeout
        if (timeout) {
            clearTimeout(timeout);
            timeout = null;
        }
        
        // Dispose decoration types
        if (decorationTypes && decorationTypes.size > 0) {
            decorationTypes.forEach(decorationType => {
                try {
                    if (decorationType && typeof decorationType.dispose === 'function') {
                        decorationType.dispose();
                    }
                } catch (error) {
                    logError('Error disposing decoration type during deactivation', error);
                }
            });
            decorationTypes.clear();
        }
        
        // Close logger
        if (logger) {
            logger.dispose();
            logger = null;
        }
        
        logInfo('Comment Wizard deactivated successfully');
        
    } catch (error) {
        console.error('Error during deactivation:', error);
    }
}

module.exports = {
    activate,
    deactivate
};