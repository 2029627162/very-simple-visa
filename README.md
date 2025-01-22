# 极简便签
electron + vue + SQlite3 开发的跨平台便签应用程序

## 项目启动

### 安装

```bash
$ npm install
```

### 开发环境

```bash
$ npm run dev
```

### 打包

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

## 技术栈
Electron 
Vue3 
SQlite3

### 数据存储
使用SQlite3嵌入式数据库对便签内容进行本地存储。
使用exceljs将数据导出excel文件持久化存储。
