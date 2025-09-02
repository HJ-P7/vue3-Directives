// directives/hover-copy/index.js
const message = useMessage()

export const hoverCopy = {
  mounted(el) {
    if (!el.querySelector('.el-table')) return

    addGlobalStyles()

    // 存储状态
    el._hoverCopyState = {
      currentCell: null,
      tooltip: null,
      hideTimeout: null,
      isHoveringTooltip: false,
      showTimeout: null,
      connector: null
    }

    // 使用事件委托，减少事件监听器数量
    el.addEventListener('mouseover', handleMouseOver, true)
    el.addEventListener('mouseout', handleMouseOut, true)

    // 将点击事件监听器添加到文档级别，确保能捕获到工具提示的点击
    document.addEventListener('click', handleClick)

    // 存储引用以便卸载时移除
    el._hoverCopyClickHandler = handleClick
  },
  unmounted(el) {
    el.removeEventListener('mouseover', handleMouseOver, true)
    el.removeEventListener('mouseout', handleMouseOut, true)

    // 移除文档级别的点击事件监听器
    if (el._hoverCopyClickHandler) {
      document.removeEventListener('click', el._hoverCopyClickHandler)
    }

    const state = el._hoverCopyState
    if (state.hideTimeout) clearTimeout(state.hideTimeout)
    if (state.showTimeout) clearTimeout(state.showTimeout)
    if (state.tooltip) state.tooltip.remove()
    if (state.connector) state.connector.remove()

    delete el._hoverCopyState
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
      border: 1px solid #E4E7ED;
      border-radius: 6px;
      padding: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
      z-index: 9999;
      opacity: 0;
      transform: translateY(-8px) scale(0.95);
      transition: all 0.2s ease;
      pointer-events: none;
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
      height: 32px;
      border-radius: 4px;
      cursor: pointer;
      color: #606266;
      transition: all 0.2s ease;
      background: white;
      gap: 4px;
      font-size: 14px;
    }
    
    .hover-copy-button:hover {
      background: #f0f7ff;
      color: #409EFF;
      transform: scale(1.1);
    }
    
    .hover-copy-button:active {
      transform: scale(0.95);
    }
    
    /* 复制按钮的SVG图标 */
    .hover-copy-icon {
      fill: currentColor;
    }
    
    /* 连接线 */
    .hover-copy-connector {
      position: fixed;
      background: #409EFF;
      height: 2px;
      z-index: 9998;
      opacity: 0;
      transition: opacity 0.2s ease;
      pointer-events: none;
    }
    
    .hover-copy-connector.visible {
      opacity: 0.4;
    }

    /* 防止按钮区域影响表格布局 */
    .hover-copy-tooltip {
      margin-left: 4px;
    }
  `
  document.head.appendChild(style)
}

// 鼠标悬停处理
function handleMouseOver(e) {
  // 判断是否是单元格
  const cell = e.target.closest('.el-table__cell')
  if (!cell) return

  const state = e.currentTarget._hoverCopyState

  // 清除之前的隐藏超时
  if (state.hideTimeout) {
    clearTimeout(state.hideTimeout)
    state.hideTimeout = null
  }

  // 如果是同一个单元格，不再处理
  if (state.currentCell === cell) return

  // 排除表头和不需要复制的单元格
  if (isHeaderCell(cell) || shouldSkipCell(cell)) {
    if (state.tooltip) {
      hideTooltip(state)
    }
    state.currentCell = null
    return
  }

  const content = cell.querySelector('.cell')
  if (!content) return

  const text = getCellText(content)
  if (!text || text === '--') return

  state.currentCell = cell

  // 延迟显示工具提示，避免快速移动时闪烁
  if (state.showTimeout) clearTimeout(state.showTimeout)
  state.showTimeout = setTimeout(() => {
    showTooltip(cell, content, text, state)
  }, 150)
}

// 鼠标移出处理
function handleMouseOut(e) {
  const state = e.currentTarget._hoverCopyState
  if (!state.currentCell) return

  // 检查是否移到了工具提示或连接线上
  const relatedTarget = e.relatedTarget
  const isMovingToTooltip =
    relatedTarget &&
    (relatedTarget.closest('.hover-copy-tooltip') ||
      relatedTarget.closest('.hover-copy-connector') ||
      relatedTarget.closest('.hover-copy-button'))

  if (isMovingToTooltip) {
    state.isHoveringTooltip = true
    return
  }

  // 检查是否还在当前单元格内
  if (state.currentCell.contains(relatedTarget)) {
    return
  }

  // 延迟隐藏，提供更平滑的过渡
  state.hideTimeout = setTimeout(() => {
    if (state.tooltip && !state.isHoveringTooltip) {
      hideTooltip(state)
    }
    state.currentCell = null
    state.isHoveringTooltip = false
  }, 200)
}

// 显示工具提示
function showTooltip(cell, content, text, state) {
  let tooltip = state.tooltip
  let connector = state.connector

  if (!tooltip) {
    tooltip = createTooltip()
    state.tooltip = tooltip
    document.body.appendChild(tooltip)

    // 添加连接线
    connector = document.createElement('div')
    connector.className = 'hover-copy-connector'
    state.connector = connector
    document.body.appendChild(connector)
  }

  // 更新复制文本
  const button = tooltip.querySelector('.hover-copy-button')
  button.setAttribute('data-text', text)

  // 计算位置 - 放在单元格右侧并稍微重叠，减少鼠标移动距离
  const rect = cell.getBoundingClientRect()
  const tooltipRect = tooltip.getBoundingClientRect()
  const tooltipWidth = tooltipRect.width
  const tooltipHeight = tooltipRect.height

  // 位置计算：放在单元格右侧，稍微重叠
  let posX = rect.right - 5 // 减少间距，使按钮更接近单元格
  let posY = rect.top + (rect.height - tooltipHeight) / 2

  // 边界检查
  const viewportPadding = 8
  if (posX + tooltipWidth > window.innerWidth - viewportPadding) {
    posX = rect.left - tooltipWidth + 5 // 如果右侧空间不足，放在左侧
  }

  // 垂直边界检查
  if (posY < viewportPadding) posY = viewportPadding
  if (posY + tooltipHeight > window.innerHeight - viewportPadding) {
    posY = window.innerHeight - tooltipHeight - viewportPadding
  }

  tooltip.style.left = `${posX}px`
  tooltip.style.top = `${posY}px`
  tooltip.classList.add('visible')

  // 显示连接线
  if (connector) {
    const buttonRect = tooltip.getBoundingClientRect()
    const buttonCenterY = buttonRect.top + buttonRect.height / 2
    const cellCenterX = rect.right - 30
    const cellCenterY = rect.top + rect.height / 2

    connector.style.left = `${cellCenterX}px`
    connector.style.top = `${cellCenterY}px`
    connector.style.width = `${Math.max(10, posX - cellCenterX)}px`

    // 控制连接线弧度始终在±30°
    const angleRad = Math.atan2(buttonCenterY - cellCenterY, posX - cellCenterX)
    let angleDeg = (angleRad * 180) / Math.PI
    angleDeg = Math.max(-15, Math.min(15, angleDeg))

    connector.style.transform = `rotate(${angleDeg}deg)`
    connector.style.transformOrigin = '0 0'
    connector.classList.add('visible')
  }
}

// 隐藏工具提示
function hideTooltip(state) {
  if (state.tooltip) {
    state.tooltip.classList.remove('visible')
  }
  if (state.connector) {
    state.connector.classList.remove('visible')
  }
  state.currentCell = null
  state.isHoveringTooltip = false
}

// 点击处理
function handleClick(e) {
  const copyButton = e.target.closest('.hover-copy-button')
  if (!copyButton) return

  e.preventDefault()
  e.stopPropagation()

  const text = copyButton.getAttribute('data-text')
  if (text) {
    try {
      // 使用 Clipboard API
      navigator.clipboard
        .writeText(text)
        .then(() => {
          message.success('复制成功')

          // 点击反馈动画
          copyButton.style.transform = 'scale(0.9)'
          setTimeout(() => {
            copyButton.style.transform = ''
          }, 150)
        })
        .catch((err) => {
          console.error('复制失败:', err)
        })
    } catch (err) {
      console.error('复制失败:', err)
    }
  }
}

// 创建工具提示
function createTooltip() {
  const tooltip = document.createElement('div')
  tooltip.className = 'hover-copy-tooltip'

  const button = document.createElement('div')
  button.className = 'hover-copy-button'
  button.title = '复制内容'
  button.innerHTML = `
    <svg class="hover-copy-icon" viewBox="0 0 1024 1024" width="14" height="14">
      <path d="M832 64H296c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8h496v688c0 4.4 3.6 8 8 8h56c4.4 0 8-3.6 8-8V96c0-17.7-14.3-32-32-32z"/>
      <path d="M704 192H192c-17.7 0-32 14.3-32 32v530.7c0 8.5 3.4 16.6 9.4 22.6l173.3 173.3c2.2 2.2 4.7 4 7.4 5.5v1.9h4.2c3.5 1.3 7.2 2 11 2H704c17.7 0 32-14.3 32-32V224c0-17.7-14.3-32-32-32zM350 856.2L263.9 770H350v86.2zM664 888H414V746c0-22.1-17.9-40-40-40H232V264h432v624z"/>
    </svg> 点击复制
  `
  tooltip.appendChild(button)
  return tooltip
}

// 获取单元格文本 判断内容是不是有效文本
function getCellText(content) {
  // 克隆节点以避免修改原始内容
  const clone = content.cloneNode(true)

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

// 检查是否是表头单元格
function isHeaderCell(cell) {
  return cell.closest('.el-table__header-wrapper') !== null
}

// 检查是否应该跳过该单元格（是不是操作列或包含交互元素）
function shouldSkipCell(cell) {
  // 跳过操作列、选择列等
  if (
    cell.classList.contains('el-table_1_column_operation') ||
    cell.classList.contains('el-table_1_column_selection') ||
    cell.classList.contains('el-table__cell--selection')
  ) {
    return true
  }

  // 跳过包含交互元素的单元格
  const interactiveElements = cell.querySelectorAll(
    'button, .el-button, input, select, textarea, a[href], [onclick]'
  )
  for (let element of interactiveElements) {
    if (element.offsetWidth > 0 && element.offsetHeight > 0) {
      return true
    }
  }

  // 跳过空单元格或占位符
  const content = cell.querySelector('.cell') || cell
  const text = getCellText(content)
  if (!text || text === '--' || text === '-' || text === '暂无数据') {
    return true
  }

  return false
}
