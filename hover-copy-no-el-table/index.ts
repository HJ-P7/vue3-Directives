const message = useMessage()

// 全局状态管理
let globalState = {
  activeElement: null,
  tooltip: null,
  connector: null,
  hideTimeout: null,
  showTimeout: null
}

export const hoverCopy = {
  mounted(el, binding) {
    addGlobalStyles()

    // 存储元素引用
    el._hoverCopy = {
      isHovering: false,
      isHoveringTooltip: false
    }

    // 添加鼠标事件监听
    el.addEventListener('mouseenter', handleMouseEnter)
    el.addEventListener('mouseleave', handleMouseLeave)
    el.addEventListener('click', handleElementClick)

    // 存储引用以便卸载时移除
    el._hoverCopyMouseEnterHandler = handleMouseEnter
    el._hoverCopyMouseLeaveHandler = handleMouseLeave
    el._hoverCopyClickHandler = handleElementClick
  },
  updated(el, binding) {
    // 处理动态内容更新
    if (el._hoverCopy && el._hoverCopy.isHovering) {
      const text = getElementText(el)
      if (text && text !== '--') {
        updateTooltipText(text)
      } else {
        hideTooltip()
      }
    }
  },
  unmounted(el) {
    el.removeEventListener('mouseenter', el._hoverCopyMouseEnterHandler)
    el.removeEventListener('mouseleave', el._hoverCopyMouseLeaveHandler)
    el.removeEventListener('click', el._hoverCopyClickHandler)

    // 如果当前悬停的是这个元素，清除全局状态
    if (globalState.activeElement === el) {
      clearTimeout(globalState.hideTimeout)
      clearTimeout(globalState.showTimeout)
      globalState.activeElement = null
    }

    delete el._hoverCopy
    delete el._hoverCopyMouseEnterHandler
    delete el._hoverCopyMouseLeaveHandler
    delete el._hoverCopyClickHandler
  }
}

// 全局样式
function addGlobalStyles() {
  if (document.getElementById('hover-copy-styles')) return

  const style = document.createElement('style')
  style.id = 'hover-copy-styles'
  style.textContent = `
    .hover-copy-tooltip {
      position: fixed;
      background: white;
      border: .0625rem solid #E4E7ED;
      border-radius: .375rem;
      padding: .5rem;
      box-shadow: 0 .25rem 1rem rgba(0, 0, 0, 0.12);
      z-index: 9999;
      opacity: 0;
      transform: translateY(-0.5rem) scale(0.95);
      transition: all 0.2s ease;
      pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    }
    
    .hover-copy-tooltip.visible {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }
    
    .hover-copy-button {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 2rem;
      border-radius: .25rem;
      cursor: pointer;
      color: #606266;
      transition: all 0.2s ease;
      background: white;
      gap: .25rem;
      font-size: .875rem;
      padding: 0 .5rem;
      border: none;
      outline: none;
    }
    
    .hover-copy-button:hover {
      background: #f0f7ff;
      color: #409EFF;
    }
    
    .hover-copy-button:active {
      transform: scale(0.95);
    }
    
    /* 复制按钮的SVG图标 */
    .hover-copy-icon {
      fill: currentColor;
      flex-shrink: 0;
    }
    
    /* 连接线 */
    .hover-copy-connector {
      position: fixed;
      background: #409EFF;
      height: .125rem;
      z-index: 9998;
      opacity: 0;
      transition: opacity 0.2s ease;
      pointer-events: none;
    }
    
    .hover-copy-connector.visible {
      opacity: 0.4;
    }

    /* 防止按钮区域影响布局 */
    .hover-copy-tooltip {
      margin-left: .25rem;
    }
    
    /* 针对表格的特殊样式 */
    .el-table .cell {
      position: relative;
    }
  `
  document.head.appendChild(style)
}

// 鼠标进入处理
function handleMouseEnter(e) {
  const el = e.currentTarget
  const localState = el._hoverCopy

  // 清除之前的隐藏超时
  if (globalState.hideTimeout) {
    clearTimeout(globalState.hideTimeout)
    globalState.hideTimeout = null
  }

  // 跳过不需要复制的元素
  if (shouldSkipElement(el)) {
    if (globalState.activeElement === el) {
      hideTooltip()
    }
    return
  }

  const text = getElementText(el)
  if (!text || text === '--') return

  localState.isHovering = true
  globalState.activeElement = el

  // 清除之前的显示超时
  if (globalState.showTimeout) {
    clearTimeout(globalState.showTimeout)
  }

  // 延迟显示工具提示，避免快速移动时闪烁
  globalState.showTimeout = setTimeout(() => {
    if (localState.isHovering) {
      showTooltip(el, text)
    }
  }, 150)
}

// 鼠标移出处理
function handleMouseLeave(e) {
  const el = e.currentTarget
  const localState = el._hoverCopy
  if (!localState.isHovering) return

  // 检查是否移到了工具提示或连接线上
  const relatedTarget = e.relatedTarget
  const isMovingToTooltip =
    relatedTarget &&
    (relatedTarget.closest('.hover-copy-tooltip') ||
      relatedTarget.closest('.hover-copy-connector') ||
      relatedTarget.closest('.hover-copy-button'))

  if (isMovingToTooltip) {
    localState.isHoveringTooltip = true
    return
  }

  // 延迟隐藏，提供更平滑的过渡
  scheduleHideTooltip()
}

// 元素点击处理
function handleElementClick(e) {
  // 防止事件冒泡
  if (e.target.closest('.hover-copy-button')) {
    return
  }

  const el = e.currentTarget
  if (shouldSkipElement(el)) return

  const text = getElementText(el)
  if (!text || text === '--') return
}

// 安排隐藏工具提示
function scheduleHideTooltip() {
  if (globalState.hideTimeout) {
    clearTimeout(globalState.hideTimeout)
  }

  globalState.hideTimeout = setTimeout(() => {
    const activeElement = globalState.activeElement
    if (activeElement && activeElement._hoverCopy) {
      const localState = activeElement._hoverCopy
      if (!localState.isHoveringTooltip) {
        hideTooltip()
      }
    }
  }, 200)
}

// 显示工具提示
function showTooltip(el, text) {
  // 确保只有一个工具提示
  if (!globalState.tooltip) {
    globalState.tooltip = createTooltip()
    document.body.appendChild(globalState.tooltip)

    // 添加连接线
    globalState.connector = document.createElement('div')
    globalState.connector.className = 'hover-copy-connector'
    document.body.appendChild(globalState.connector)

    // 添加工具提示事件监听
    globalState.tooltip.addEventListener('mouseenter', handleTooltipEnter)
    globalState.tooltip.addEventListener('mouseleave', handleTooltipLeave)
    globalState.tooltip.addEventListener('click', handleCopyClick)
  }

  // 更新复制文本
  const button = globalState.tooltip.querySelector('.hover-copy-button')
  button.setAttribute('data-text', text)

  // 计算位置
  const rect = el.getBoundingClientRect()
  const tooltipRect = globalState.tooltip.getBoundingClientRect()
  const tooltipWidth = tooltipRect.width
  const tooltipHeight = tooltipRect.height

  // 位置计算：放在元素右侧，稍微重叠
  let posX = rect.right
  let posY = rect.top + (rect.height - tooltipHeight) / 2

  // 边界检查
  const viewportPadding = 8
  if (posX + tooltipWidth > window.innerWidth - viewportPadding) {
    posX = rect.left - tooltipWidth + 5
  }

  // 垂直边界检查
  if (posY < viewportPadding) posY = viewportPadding
  if (posY + tooltipHeight > window.innerHeight - viewportPadding) {
    posY = window.innerHeight - tooltipHeight - viewportPadding
  }

  globalState.tooltip.style.left = `${posX}px`
  globalState.tooltip.style.top = `${posY}px`
  globalState.tooltip.classList.add('visible')

  // 显示连接线
  if (globalState.connector) {
    const buttonRect = globalState.tooltip.getBoundingClientRect()
    const buttonCenterY = buttonRect.top + buttonRect.height / 2
    const elCenterX = rect.right - 50
    const elCenterY = rect.top + rect.height / 2

    globalState.connector.style.left = `${elCenterX}px`
    globalState.connector.style.top = `${elCenterY}px`
    globalState.connector.style.width = `${Math.max(10, posX - elCenterX)}px`

    // 控制连接线弧度
    const angleRad = Math.atan2(buttonCenterY - elCenterY, posX - elCenterX)
    let angleDeg = (angleRad * 180) / Math.PI
    angleDeg = Math.max(-10, Math.min(10, angleDeg))
    globalState.connector.style.transform = `rotate(${angleDeg}deg)`
    globalState.connector.style.transformOrigin = '0 0'
    globalState.connector.classList.add('visible')
  }
}

// 隐藏工具提示
function hideTooltip() {
  if (globalState.tooltip) {
    globalState.tooltip.classList.remove('visible')
  }
  if (globalState.connector) {
    globalState.connector.classList.remove('visible')
  }

  if (globalState.activeElement && globalState.activeElement._hoverCopy) {
    globalState.activeElement._hoverCopy.isHovering = false
    globalState.activeElement._hoverCopy.isHoveringTooltip = false
  }

  globalState.activeElement = null
}

// 更新工具提示文本
function updateTooltipText(text) {
  if (globalState.tooltip) {
    const button = globalState.tooltip.querySelector('.hover-copy-button')
    button.setAttribute('data-text', text)
  }
}

// 工具提示鼠标进入
function handleTooltipEnter() {
  if (globalState.activeElement && globalState.activeElement._hoverCopy) {
    globalState.activeElement._hoverCopy.isHoveringTooltip = true
  }

  // 清除隐藏超时
  if (globalState.hideTimeout) {
    clearTimeout(globalState.hideTimeout)
    globalState.hideTimeout = null
  }
}

// 工具提示鼠标离开
function handleTooltipLeave() {
  if (globalState.activeElement && globalState.activeElement._hoverCopy) {
    globalState.activeElement._hoverCopy.isHoveringTooltip = false
  }

  scheduleHideTooltip()
}

// 复制点击处理
function handleCopyClick(e) {
  const copyButton = e.target.closest('.hover-copy-button')
  if (!copyButton) return

  e.preventDefault()
  e.stopPropagation()

  const text = copyButton.getAttribute('data-text')
  if (text) {
    copyText(text)

    // 点击反馈动画
    copyButton.style.transform = 'scale(0.9)'
    setTimeout(() => {
      copyButton.style.transform = ''
    }, 150)
  }
}

// 复制文本
function copyText(text) {
  try {
    // 使用 Clipboard API
    navigator.clipboard
      .writeText(text)
      .then(() => {
        showSuccessMessage('复制成功')
      })
      .catch((err) => {
        message.error('复制失败')
      })
  } catch (err) {
    // 降级复制用传统的document.execCommand('copy')进行复制
    const textArea = document.createElement('textarea')
    textArea.value = text
    document.body.appendChild(textArea)
    textArea.select()

    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)

    if (successful) {
      showSuccessMessage('复制成功')
    } else {
      message.error('向下兼容复制失败')
    }
  }
}

// 显示成功消息
function showSuccessMessage(msg) {
  if (typeof message !== 'undefined' && message.success) {
    message.success(msg)
  } else {
    console.log(msg)
  }
}

// 创建工具提示
function createTooltip() {
  const tooltip = document.createElement('div')
  tooltip.className = 'hover-copy-tooltip'

  const button = document.createElement('button')
  button.className = 'hover-copy-button'
  button.title = '复制内容'
  button.innerHTML = `
    <svg class="hover-copy-icon" viewBox="0 0 1024 1024" width="14" height="14">
      <path d="M832 64H296c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8h496v688c0 4.4 3.6 8 8 8h56c4.4 0 8-3.6 8-8V96c0-17.7-14.3-32-32-32z"/>
      <path d="M704 192H192c-17.7 0-32 14.3-32 32v530.7c0 8.5 3.4 16.6 9.4 22.6l173.3 173.3c2.2 2.2 4.7 4 7.4 5.5v1.9h4.2c3.5 1.3 7.2 2 11 2H704c17.7 0 32-14.3 32-32V224c0-17.7-14.3-32-32-32zM350 856.2L263.9 770H350v86.2zM664 888H414V746c0-22.1-17.9-40-40-40H232V264h432v624z"/>
    </svg>
    <span>点击复制</span>
  `
  tooltip.appendChild(button)
  return tooltip
}

// 获取元素文本
function getElementText(el) {
  // 对于表格单元格，使用特定的选择器
  if (el.classList.contains('el-table__cell')) {
    const cellContent = el.querySelector('.cell')
    if (cellContent) {
      return getTextFromElement(cellContent)
    }
  }

  return getTextFromElement(el)
}

// 从元素获取文本
function getTextFromElement(el) {
  // 克隆节点以避免修改原始内容
  const clone = el.cloneNode(true)

  // 移除不需要的元素
  const elementsToRemove = clone.querySelectorAll(
    'button, .el-icon, .el-button, [role="button"], .hover-copy-button, .el-tag, .el-link, .el-image, img, input, select, textarea, a'
  )
  elementsToRemove.forEach((el) => el.remove())

  // 获取纯文本内容
  let text = clone.textContent || clone.innerText || ''

  // 清理文本 - 移除多余空格和换行
  text = text.replace(/\s+/g, ' ').trim()

  return text
}

// 检查是否应该跳过该元素
function shouldSkipElement(el) {
  // 跳过包含交互元素的元素
  const interactiveElements = el.querySelectorAll(
    'button, .el-button, input, select, textarea, a[href], [onclick]'
  )
  for (let element of interactiveElements) {
    if (element.offsetWidth > 0 && element.offsetHeight > 0) {
      return true
    }
  }

  // 跳过空元素或占位符
  const text = getElementText(el)
  if (!text || text === '--' || text === '-' || text === '暂无数据') {
    return true
  }

  return false
}
