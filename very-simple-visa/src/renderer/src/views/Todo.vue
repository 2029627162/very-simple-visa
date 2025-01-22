<script setup>
import { ref } from 'vue'

const todoList = ref([])
const inputRef = ref(null)
const dragItem = ref(null)
const dragOverItem = ref(null)

queryData()
// 查询数据
function queryData(){
  window.electron.ipcRenderer.once('db-query-response', (items) => {
    if(items && items.length > 0){
      todoList.value = items.map(item => ({
        ...item,
        isEditing: false
      }));
      // 添加一个新的空输入框
      todoList.value.push({
        id: Date.now(),
        content: '',
        isEditing: true
      });
    }else{
      todoList.value = [{ id: 1, content: '', isEditing: true }];
    }
  });
  window.electron.ipcRenderer.send('db-query-item');
}

const canAddNewTodo = () => {
  // 检查是否所有已有的输入框都有内容
  return todoList.value.every(todo => !todo.isEditing || todo.content.trim() !== '')
}

const addTodo = () => {
  // 只有当所有现有项都有内容时才允许添加新项
  if (!canAddNewTodo()) return

  const lastTodo = todoList.value[todoList.value.length - 1]
  if (lastTodo && lastTodo.isEditing && !lastTodo.content.trim()) {
    return // 如果最后一项是空的输入框，不添加新项
  }

  // 添加新项
  todoList.value.push({
    id: Date.now(),
    content: '',
    isEditing: true
  })

  // 等待 DOM 更新后聚焦新输入框
  setTimeout(() => {
    const inputs = document.querySelectorAll('input')
    inputs[inputs.length - 1]?.focus()
  }, 0)
}

const handleInput = (todo, event) => {
  todo.content = event.target.value
}

const handleKeydown = (todo, event) => {
  if (event.key === 'Enter') {
    event.preventDefault() // 防止触发 blur 事件
    finishEditing(todo)
  }
}

const handleBlur = (todo) => {
  if (todo.content.trim()) {
    finishEditing(todo)
  }
}

const finishEditing = (todo) => {
  // 防止重复保存
  if (!todo.isEditing) return
  
  if (todo.content.trim()) {
    todo.isEditing = false
    // 插入数据库
    window.electron.ipcRenderer.once('db-insert-response', () => {
      // 插入成功后立即刷新数据
      queryData();
    });
    window.electron.ipcRenderer.send('db-insert-item', todo.content);
  }
}

const handleContainerClick = (event) => {
  // 只有当点击的是容器本身且所有现有项都有内容时才添加新项
  if (event.target.classList.contains('todo-scroll') && canAddNewTodo()) {
    addTodo()
  }
}

const handleDragStart = (todo) => {
  if (todo.isEditing) return // 如果正在编辑则不允许拖拽
  dragItem.value = todo
}

const handleDragEnter = (todo) => {
  if (todo.isEditing) return
  dragOverItem.value = todo
}

const handleDragEnd = () => {
  if (!dragItem.value || !dragOverItem.value) return

  // 获取两个项目的索引
  const dragItemIndex = todoList.value.indexOf(dragItem.value)
  const dragOverItemIndex = todoList.value.indexOf(dragOverItem.value)

  // 交换位置
  const newTodoList = [...todoList.value]
  const temp = newTodoList[dragItemIndex]
  newTodoList[dragItemIndex] = newTodoList[dragOverItemIndex]
  newTodoList[dragOverItemIndex] = temp
  todoList.value = newTodoList

  // 重置拖拽状态
  dragItem.value = null
  dragOverItem.value = null
}

const handleDragOver = (e) => {
  e.preventDefault()
}

// 添加点击完成的处理函数
const handleComplete = async (todo) => {
  if (todo.isEditing) return;
  console.log('Completing todo:', todo.id);
  
  try {
    // 发送完成请求并等待响应
    const response = await new Promise((resolve) => {
      window.electron.ipcRenderer.once('db-complete-response', (result) => {
        resolve(result);
      });
      window.electron.ipcRenderer.send('db-complete-item', todo.id);
    });

    if (response.success) {
      console.log('Item completed successfully');
      // 从列表中移除该项
      todoList.value = todoList.value.filter(item => item.id !== todo.id);
      // 触发已完成列表刷新
      window.electron.ipcRenderer.send('db-query-done-item', 1);
    } else {
      console.error('Failed to complete item');
    }
  } catch (error) {
    console.error('Error completing todo:', error);
  }
}

// 修改数据库表结构
function createTable(){
  db.run(`
    CREATE TABLE IF NOT EXISTS items(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      created_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      completeTime DATETIME
    )
  `, (err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Table created.');
  });
}
</script>

<template>
  <div class="todo-content">
    <div class="todo-scroll" @click="handleContainerClick">
      <div 
        v-for="todo in todoList" 
        :key="todo.id"
        class="todo-item"
        :class="{ 
          'dragging': todo === dragItem, 
          'drag-over': todo === dragOverItem 
        }"
        draggable="true"
        @dragstart="handleDragStart(todo)"
        @dragenter="handleDragEnter(todo)"
        @dragend="handleDragEnd"
        @dragover="handleDragOver"
      >
        <input
          v-if="todo.isEditing"
          type="text"
          v-model="todo.content"
          @input="handleInput(todo, $event)"
          @blur="handleBlur(todo)"
          @keydown="handleKeydown(todo, $event)"
          placeholder="请输入内容"
          ref="inputRef"
        >
        <div
          v-else
          class="todo-text"
          @click="handleComplete(todo)"
        >
          {{ todo.content }}
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.todo-content {
  height: 100%;
  padding: 10px;
  box-sizing: border-box;
  
  .todo-scroll {
    height: 100%;
    overflow-y: auto;
    scrollbar-width: none;  // Firefox
    -ms-overflow-style: none;  // IE and Edge
    
    &::-webkit-scrollbar {
      display: none;  // Chrome, Safari, Opera
    }
  }
}

.todo-item {
  cursor: move;
  transition: all 0.2s ease;
  margin-bottom: 8px;
  
  &.dragging {
    opacity: 0.5;
    background: rgba(46, 52, 60, 0.4);
    transform: scale(0.98);
  }
  
  &.drag-over {
    transform: translateY(2px);
    
    &::before {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      height: 2px;
      background: #69d695;
      transform: translateY(-6px);
    }
  }
  
  input {
    width: 100%;
    min-height: 30px;
    padding: 10px;
    background: transparent;
    border: none;
    outline: none;
    color: #fff;
    font-size: 14px;
    line-height: 1.5;
    word-break: break-all;
    box-sizing: border-box;
    cursor: text;
    
    &::placeholder {
      color: rgba(255, 255, 255, 0.5);
    }
  }
  
  .todo-text {
    padding: 10px;
    min-height: 30px;
    color: #fff;
    font-size: 14px;
    line-height: 1.5;
    word-break: break-all;
    white-space: pre-wrap;
    border-radius: 4px;
    
    &:hover {
      background: rgba(56, 62, 70, 0.8);
      cursor: pointer;  // 添加指针样式表示可点击
    }
  }
}
</style>
