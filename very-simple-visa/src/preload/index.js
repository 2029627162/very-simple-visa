import { contextBridge, ipcRenderer } from 'electron'
import * as XLSX from 'xlsx'
import * as ExcelJS from 'exceljs'

// Custom APIs for renderer
const api = {}

// 创建一个简化的 XLSX API
const safeXLSX = {
  exportToExcel: async (data, filePath) => {
    try {
      // 定义表头映射
      const headers = {
        content: '内容',
        created_time: '创建时间',
        completeTime: '完成时间'
      };

      // 转换数据，添加表头
      const excelData = data.map(row => ({
        [headers.content]: row.content,
        [headers.created_time]: row.created_time,
        [headers.completeTime]: row.completeTime
      }));

      // 创建工作簿和工作表
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sheet1');

      // 设置列
      worksheet.columns = [
        { header: '内容', key: headers.content, width: 30 },
        { header: '创建时间', key: headers.created_time, width: 20 },
        { header: '完成时间', key: headers.completeTime, width: 20 }
      ];

      // 添加数据
      worksheet.addRows(excelData);

      // 保存文件
      await workbook.xlsx.writeFile(filePath);
      
      return true;
    } catch (error) {
      console.error('Export error:', error);
      throw error;
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('electron', {
      ipcRenderer: {
        send: (channel, ...args) => ipcRenderer.send(channel, ...args),
        on: (channel, func) => {
          ipcRenderer.on(channel, (event, ...args) => func(...args))
        },
        once: (channel, func) => {
          ipcRenderer.once(channel, (event, ...args) => func(...args))
        },
        removeListener: (channel, func) => {
          ipcRenderer.removeListener(channel, func)
        },
        invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args)
      },
      safeXLSX
    })
  } catch (error) {
    console.error(error)
  }
} else {
  window.api = api
  window.electron = {
    ipcRenderer: {
      send: (channel, ...args) => ipcRenderer.send(channel, ...args),
      on: (channel, func) => {
        ipcRenderer.on(channel, (event, ...args) => func(...args))
      },
      once: (channel, func) => {
        ipcRenderer.once(channel, (event, ...args) => func(...args))
      },
      removeListener: (channel, func) => {
        ipcRenderer.removeListener(channel, func)
      },
      invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args)
    },
    safeXLSX
  }
}
