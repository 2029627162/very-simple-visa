<script setup>
import { ref, computed, onMounted } from 'vue'

const doneList = ref([])
const page = ref(1)
const loading = ref(false)
const hasMore = ref(true)

// 按时间分组的数据
const groupedData = computed(() => {
  const groups = {}
  doneList.value.forEach(item => {
    const date = item.completeTime.slice(0, 10) // 获取日期部分 YYYY-MM-DD
    const year = date.slice(0, 4)
    const month = date.slice(5, 7)
    const day = date.slice(8, 10)
    
    if (!groups[year]) {
      groups[year] = {}
    }
    if (!groups[year][month]) {
      groups[year][month] = {}
    }
    if (!groups[year][month][day]) {
      groups[year][month][day] = []
    }
    groups[year][month][day].push(item)
  })
  return groups
})

// 监听滚动事件
const handleScroll = (e) => {
  const { scrollTop, scrollHeight, clientHeight } = e.target
  // 当滚动到距离底部100px时且还有更多数据时加载更多
  if (scrollHeight - scrollTop - clientHeight < 100 && !loading.value && hasMore.value) {
    loadMoreData()
  }
}

// 加载更多数据
const loadMoreData = () => {
  if (!hasMore.value || loading.value) return
  
  loading.value = true
  window.electron.ipcRenderer.once('db-query-done-response', (response) => {
    if (response.items && response.items.length > 0) {
      doneList.value = [...doneList.value, ...response.items]
    }
    hasMore.value = response.hasMore
    loading.value = false
  })
  window.electron.ipcRenderer.send('db-query-done-item', page.value)
  page.value++
}

// 初始加载
function queryDoneData() {
  loading.value = true
  doneList.value = [] // 清空现有数据
  page.value = 1 // 重置页码
  
  window.electron.ipcRenderer.once('db-query-done-response', (response) => {
    if (response.items && response.items.length > 0) {
      doneList.value = response.items
    }
    hasMore.value = response.hasMore
    loading.value = false
  })
  window.electron.ipcRenderer.send('db-query-done-item', page.value)
  page.value++
}

// 添加重新加载方法
const reloadData = () => {
  queryDoneData()
}

// 监听路由变化，每次进入页面时重新加载数据
onMounted(() => {
  queryDoneData()
})

defineExpose({
  reloadData
})
</script>

<template>
  <div class="done-content">
    <div class="done-scroll" @scroll="handleScroll">
      <template v-for="(yearData, year) in groupedData" :key="year">
        <div class="year-group">
          <div class="year-title">{{ year }}年</div>
          <template v-for="(monthData, month) in yearData" :key="`${year}-${month}`">
            <div class="month-group">
              <div class="month-title">{{ month }}月</div>
              <template v-for="(dayData, day) in monthData" :key="`${year}-${month}-${day}`">
                <div class="day-group">
                  <div class="day-title">{{ day }}日</div>
                  <div v-for="item in dayData" :key="item.id" class="done-item">
                    <div class="done-time">{{ item.completeTime.slice(11, 19) }}</div>
                    <div class="done-text">{{ item.content }}</div>
                  </div>
                </div>
              </template>
            </div>
          </template>
        </div>
      </template>
      <div v-if="loading" class="loading">加载中...</div>
      <div v-if="!hasMore && doneList.length > 0" class="no-more">没有更多数据了</div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.done-content {
  height: 100%;
  padding: 10px;
  box-sizing: border-box;
  
  .done-scroll {
    height: 100%;
    overflow-y: auto;
    scrollbar-width: none;  // Firefox
    -ms-overflow-style: none;  // IE and Edge
    
    &::-webkit-scrollbar {
      display: none;  // Chrome, Safari, Opera
    }
  }
}

.year-group {
  margin-bottom: 20px;
  
  .year-title {
    font-size: 16px;
    color: #69d695;
    margin-bottom: 12px;
    padding-left: 8px;
    font-weight: 500;
  }
}

.month-group {
  margin-bottom: 16px;
  margin-left: 8px;
  
  .month-title {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.7);
    margin-bottom: 10px;
    padding-left: 8px;
  }
}

.day-group {
  margin-bottom: 12px;
  margin-left: 8px;
  
  .day-title {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    margin-bottom: 8px;
    padding-left: 8px;
  }
}

.done-item {
  margin-bottom: 8px;
  padding: 10px;
  background: rgba(46, 52, 60, 0.4);
  border-radius: 6px;
  transition: all 0.3s ease;
  
  &:hover {
    background: rgba(56, 62, 70, 0.6);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }
  
  .done-time {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    margin-bottom: 4px;
  }
  
  .done-text {
    color: #fff;
    font-size: 14px;
    line-height: 1.5;
    word-break: break-all;
    white-space: pre-wrap;
  }
}

.loading, .no-more {
  text-align: center;
  padding: 10px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
}
</style>
