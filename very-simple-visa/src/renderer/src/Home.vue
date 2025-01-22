<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const handleTodo = () => {
  router.push('/todo')
}

const handleDone = () => {
  router.push('/done')
}

// 计算当前激活的路由
const isActive = (path) => {
  return route.path === path
}

// 置顶
const isZhiding = ref(false)
const handleZhiding = () => {
  isZhiding.value = !isZhiding.value
  window.electron.ipcRenderer.send('zhiding', isZhiding.value)
}

// 导出excel
const handleExport = async () => {
  try {
    console.log('开始导出数据...');
    // 等待数据返回
    const data = await new Promise((resolve) => {
      window.electron.ipcRenderer.once('db-query-all-response', (rows) => {
        console.log('收到数据:', rows);
        resolve(rows);
      });
      window.electron.ipcRenderer.send('db-query-all-item');
    });

    // 检查数据是否为空
    if (!data || data.length === 0) {
      alert('没有可导出的数据');
      return;
    }

    // 打开文件保存对话框
    const saveResult = await window.electron.ipcRenderer.invoke('show-save-dialog', {
      title: '导出Excel',
      defaultPath: 'note.xlsx',
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    });

    if (saveResult.filePath) {
      try {
        // 直接导出到Excel
        await window.electron.safeXLSX.exportToExcel(data, saveResult.filePath);
        alert('导出成功！');
      } catch (error) {
        console.error('导出过程出错：', error);
        alert(error.message || '导出过程出错');
      }
    }
  } catch (error) {
    console.error('导出失败：', error);
    alert(error.message || '导出失败');
  }
}
</script>

<template>
  <div class="home">
    <div class="drag"></div>
    <div class="top-container">
      <div class="nav-items">
        <div 
          class="nav-item" 
          :class="{ 'active': isActive('/todo') }"
          @click="handleTodo"
        >
          待完成
        </div>
        <div 
          class="nav-item" 
          :class="{ 'active': isActive('/done') }"
          @click="handleDone"
        >
          已完成
        </div>
      </div>
      <div class="icons">
        <i class="iconfont icon-zhiding" @click="handleZhiding" :class="{ 'active': isZhiding }"></i>
        <i class="iconfont icon-export" @click="handleExport"></i>
      </div>
    </div>
    <div class="content-area">
      <router-view></router-view>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.home {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: rgba(36, 42, 50, 0.8);
}

.drag {
  width: 100%;
  height: 20px;
  -webkit-app-region: drag;
}

.top-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  
  .nav-items {
    display: flex;
    gap: 20px;
    
    .nav-item {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.8);
      cursor: pointer;
      padding: 6px 12px;
      border-radius: 4px;
      transition: all 0.3s ease;
      position: relative;
      
      &:hover {
        background: rgba(255, 255, 255, 0.1);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      }
      
      &.active {
        color: #69d695;
        background: rgba(105, 214, 149, 0.1);
        
        &::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 50%;
          transform: translateX(-50%);
          width: 20px;
          height: 2px;
          background: #69d695;
          border-radius: 1px;
        }
      }
    }
  }
  
  .icons {
    display: flex;
    gap: 15px;
    
    i {
      font-size: 16px;
      color: rgba(255, 255, 255, 0.8);
      cursor: pointer;
      padding: 6px;
      border-radius: 4px;
      transition: all 0.3s ease;
      
      &:hover {
        color: #69d695;
        background: rgba(105, 214, 149, 0.1);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      }

      &.active {
        color: #69d695 !important;
        background: rgba(105, 214, 149, 0.1);
      }
    }
  }
}

.content-area {
  flex: 1;
  overflow: hidden;
}

:global(body) {
  margin: 0;
  padding: 0;
  background: transparent;
}
</style>

