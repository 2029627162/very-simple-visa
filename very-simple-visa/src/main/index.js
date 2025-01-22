import { app, shell, BrowserWindow, ipcMain, Tray, Menu, globalShortcut, screen, Notification, dialog } from 'electron'
import path, { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import * as fs from 'fs'
import { writeFile } from 'fs/promises'

const AutoLaunch = require('auto-launch');
const sqlite3 = require('sqlite3').verbose()
let db;
// 创建AutoLaunch对象
const autoLaunch = new AutoLaunch({
  name: '极简便签',
  path: app.getPath('exe'),
});
let tray = null;
let mainWindow = null;
let debounceTimer = null;
let width = null;
let height = null;
let initialX = null;
let initialY = null;

function showWindow(){
  if (!mainWindow.isVisible()) {
    const position = {
      x: width - 340 - 20,
      y: 40
    };
    mainWindow.setPosition(position.x, position.y);
    mainWindow.show();
  }
}

function createWindow() {
  // 获取主显示器的尺寸
  const mainScreen = screen.getPrimaryDisplay();
  // 获取屏幕宽度
  width = mainScreen.size.width;
  height = mainScreen.size.height;

  // 计算初始位置（右上角）
  initialX = width - 340 - 20;
  initialY = 40;

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 340,
    height: 400,
    x: initialX,
    y: initialY,
    show: false,
    title: '极简便签',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    resizable: false,
    transparent: true,
    frame: false,
    backgroundColor: '#00ffffff',
    ...(process.platform === 'linux' ? { icon } : { icon }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: true,
      contextIsolation: true,
      webSecurity: true,
      nodeIntegrationInWorker: true
    }
  })

  // 监听窗口移动
  mainWindow.on('moved', () => {
    if(debounceTimer){
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      if (!mainWindow) return;
      const bounds = mainWindow.getBounds();
      const threshold = 50;
      if(bounds.y + bounds.height > height - threshold){
        mainWindow.hide();
        showNotification();
      }
    }, 100);
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  // 创建数据库表
  createTable();

  // 监听渲染进程对sqlite3的操作
  ipcMain.on('db-insert-item', (event, content) => {
    insertData(content, event);
  });
  ipcMain.on('db-query-item', (event) => {
    queryData(event);
  });
  ipcMain.on('db-query-done-item', (event) => {
    queryDoneData(event);
  });
  ipcMain.on('db-query-all-item', (event) => {
    queryAllData(event);
  });
  ipcMain.on('db-update-item', (event, id, completeTime) => {
    updateData(id, completeTime);
  });
  ipcMain.on('db-complete-item', (event, id) => {
    console.log('Received complete request for id:', id)
    completeItem(id, event);
  });

  ipcMain.on('zhiding', (event, isZhiding) => {
    const webContents = event.sender
    const win = BrowserWindow.fromWebContents(webContents)
    win.setAlwaysOnTop(isZhiding)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // 添加保存对话框处理
  ipcMain.handle('show-save-dialog', async (event, options) => {
    return dialog.showSaveDialog(mainWindow, options);
  });

  // 添加文件保存处理
  ipcMain.handle('save-excel', async (event, { content, filePath }) => {
    try {
      const buffer = Buffer.from(content);
      
      // 使用 promises 版本的 writeFile
      await writeFile(filePath, buffer);
      
      // 验证文件是否写入成功
      try {
        await fs.promises.access(filePath);
        return { success: true, filePath };
      } catch {
        return { success: false, error: '文件写入后无法访问' };
      }
    } catch (error) {
      console.error('保存文件失败:', error);
      return { 
        success: false, 
        error: `保存失败: ${error.message}${error.code ? ` (${error.code})` : ''}`
      };
    }
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // 设置应用ID
  electronApp.setAppUserModelId('com.electron')

  // 初始化数据库
  await initDatabase();

  // 创建窗口
  createWindow();

  // 注册全局快捷键
  globalShortcut.register('CommandOrControl+M', () => {
    mainWindow.hide();
    showNotification();
  });

  // 创建托盘图标
  tray = new Tray(icon)
  tray.setToolTip('极简便签')
  
  // 添加托盘点击事件
  tray.on('click', () => {
    if (!mainWindow.isVisible()) {
      showWindow()
      // mainWindow.show();
    } else {
      mainWindow.hide();
    }
  });

  // 创建上下文菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '开机自启动',
      type: 'checkbox',
      checked: false,
      click: async () => {
        const isEnable = await autoLaunch.isEnabled();
        if (isEnable) {
          await autoLaunch.disable();
        } else {
          await autoLaunch.enable();
        }
        updateTrayMenu();
      }
    },
    {
      label: "显示/隐藏",
      click: () => {
        if (!mainWindow.isVisible()) {
          mainWindow.show();
        } else {
          mainWindow.hide();
        }
      }
    },
    {
      label: '退出',
      click: () => app.quit()
    }
  ])
  
  // 更新托盘菜单
  const updateTrayMenu = async () => {
    const isEnable = await autoLaunch.isEnabled();
    contextMenu.items[0].checked = isEnable;
    tray.setContextMenu(contextMenu);
  }
  
  // 初始化托盘菜单
  updateTrayMenu();

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
// 连接数据库
app.on('ready', () => {
  // 数据库会存储在用户应用数据路径下
  const dbPath = app.getPath('userData') + '/database.db';
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Connected to the SQLite database.');
  });
});

// 在应用退出时关闭数据库连接
app.on('will-quit', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Database connection closed.');
  });
});

// 创建数据库表
function createTable(){
  db.run(`
    CREATE TABLE IF NOT EXISTS items(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      created_time TEXT,
      completeTime TEXT
    )
  `, (err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Table created.');
  });
}

// 获取当前时间的格式化字符串
function getCurrentTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// 插入数据
function insertData(content, event){
  const currentTime = getCurrentTime();
  db.run(`
    INSERT INTO items (content, created_time) 
    VALUES (?, ?)
  `, [content, currentTime], function(err) {
    if (err) {
      console.error(err.message);
      event.reply('db-insert-response', { success: false });
    } else {
      console.log('Data inserted with id:', this.lastID);
      event.reply('db-insert-response', { success: true, id: this.lastID });
    }
  });
}

// 查询未完成数据
function queryData(event){
  const today = new Date().toISOString().split('T')[0]; // 获取今天的日期 YYYY-MM-DD
  
  db.all(`
    SELECT * FROM items 
    WHERE created_time LIKE '${today}%'  -- 只查询今天的数据
    AND completeTime IS NULL  -- 只查询未完成的数据
    ORDER BY created_time asc
  `, (err, rows) => {
    if (err) {
      console.error(err.message);
      event.reply('db-query-response', null);
    } else {
      event.reply('db-query-response', rows);
    }
  });
}

// 查询已完成数据
function queryDoneData(event, page = 1, pageSize = 20){
  const offset = (page - 1) * pageSize;
  
  db.all(`
    SELECT * FROM items 
    WHERE completeTime IS NOT NULL
    ORDER BY completeTime DESC
    LIMIT ? OFFSET ?
  `, [pageSize, offset], (err, rows) => {
    if (err) {
      console.error('Error querying done items:', err);
      event.reply('db-query-done-response', { items: [], hasMore: false });
    } else {
      console.log('Done items:', rows); // 添加日志
      event.reply('db-query-done-response', { 
        items: rows,
        hasMore: rows.length === pageSize
      });
    }
  });
}

// 查询所有数据
function queryAllData(event){
  console.log('开始查询所有数据...');
  db.all(`
    SELECT 
      content,
      strftime('%Y-%m-%d %H:%M:%S', created_time) as created_time,
      strftime('%Y-%m-%d %H:%M:%S', completeTime) as completeTime 
    FROM items 
    ORDER BY created_time DESC
  `, [], (err, rows) => {
    if (err) {
      console.error('查询失败:', err);
      event.reply('db-query-all-response', []);
    } else {
      // 处理 null 值和编码
      const processedRows = rows.map(row => ({
        content: row.content || '',
        created_time: row.created_time || '',
        completeTime: row.completeTime || ''
      }));
      console.log('处理后的数据:', JSON.stringify(processedRows, null, 2));
      event.reply('db-query-all-response', processedRows);
    }
  });
}

// 添加更新完成时间的函数
function completeItem(id, event){
  console.log('Updating item:', id);
  const currentTime = getCurrentTime();
  
  // 先检查项目是否存在且未完成
  db.get('SELECT * FROM items WHERE id = ? AND completeTime IS NULL', [id], (err, row) => {
    if (err) {
      console.error('Error checking item:', err);
      event.reply('db-complete-response', { success: false });
      return;
    }
    
    if (!row) {
      console.error('Item not found or already completed');
      event.reply('db-complete-response', { success: false });
      return;
    }
    
    // 更新完成时间
    db.run(`
      UPDATE items 
      SET completeTime = ?
      WHERE id = ? AND completeTime IS NULL
    `, [currentTime, id], function(err) {
      if (err) {
        console.error('Error updating item:', err);
        event.reply('db-complete-response', { success: false });
      } else if (this.changes > 0) {
        console.log('Item completed. Rows affected:', this.changes);
        event.reply('db-complete-response', { success: true });
      } else {
        console.error('No rows updated');
        event.reply('db-complete-response', { success: false });
      }
    });
  });
}

// 显示通知最小化
function showNotification(){
  new Notification({
    title: '极简便签',
    body: '您的窗口已最小化到任务栏',
    icon: icon
  }).show();
}

// 获取数据库文件路径
function getDatabasePath() {
  return join(app.getPath('userData'), 'database.db');
}

// 删除数据库文件
function deleteDatabase() {
  const dbPath = getDatabasePath();
  
  // 先关闭数据库连接
  if (db) {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      } else {
        console.log('Database connection closed');
        // 确保连接关闭后再删除文件
        try {
          if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
            console.log('Database file deleted successfully');
          }
        } catch (error) {
          console.error('Error deleting database file:', error);
        }
      }
    });
    db = null;
  }
}

// 初始化数据库
function initDatabase() {
  const dbPath = getDatabasePath();
  console.log('Database path:', dbPath);
  
  // 删除数据库文件
  /* 
    注意：此api打开将会删除数据库，所有数据将会丢失，请谨慎！！！
    deleteDatabase();
  */
  
  // 等待一小段时间确保文件被删除
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error(err.message);
          reject(err);
        } else {
          console.log('Connected to the SQLite database.');
          createTable();
          resolve();
        }
      });
    }, 1000); // 等待1秒
  });
}

// 添加清空表的函数
function clearTable(event) {
  db.run('DELETE FROM items', [], (err) => {
    if (err) {
      console.error('Error clearing table:', err);
      event.reply('db-clear-response', { success: false });
    } else {
      console.log('Table cleared successfully');
      event.reply('db-clear-response', { success: true });
    }
  });

// 添加 IPC 监听器
ipcMain.on('db-clear-table', (event) => {
  clearTable(event);
});
}
