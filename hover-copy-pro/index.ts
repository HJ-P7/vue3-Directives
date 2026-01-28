/**
 * v-hover-copy 指令
 */
let globalState = {
  tooltip: null,
  hideTimeout: null
}

export const hoverCopy = {
  mounted(el, binding) {
    addGlobalStyles()

    el.addEventListener('mouseenter', () => {
      const text = el.innerText?.trim()
      if (!text || text === '--') return

      clearTimeout(globalState.hideTimeout)
      showTooltip(el, text, binding.value)
    })

    el.addEventListener('mouseleave', (e) => {
      const relatedTarget = e.relatedTarget
      if (relatedTarget?.closest('.hover-copy-box')) return
      scheduleHide()
    })
  },
  unmounted() {
    if (globalState.tooltip) {
      globalState.tooltip.remove()
      globalState.tooltip = null
    }
  }
}

function showTooltip(el, text, bindingValue) {
  // 只有同时存在 callback 和 detail 才认为是“查看详情”模式
  const hasAction = !!(bindingValue?.callback && bindingValue?.detail)

  if (!globalState.tooltip) {
    globalState.tooltip = document.createElement('div')
    globalState.tooltip.className = 'hover-copy-box'
    document.body.appendChild(globalState.tooltip)

    globalState.tooltip.addEventListener('mouseenter', () => clearTimeout(globalState.hideTimeout))
    globalState.tooltip.addEventListener('mouseleave', scheduleHide)
  }

  // 动态渲染结构
  globalState.tooltip.innerHTML = `
    <div class="data-view-area" style="display: none;">
      <div class="label">完整信息内容 (点击复制)</div>
      <div class="detail-content"></div>
    </div>
    <div class="footer-actions">
      ${
        !hasAction
          ? `<div class="action-item copy-btn"><span class="btn-text">复制内容</span></div>`
          : `<div class="action-item view-detail-btn"><span class="btn-text">查看详情</span></div>`
      }
    </div>
  `

  const copyBtn = globalState.tooltip.querySelector('.copy-btn')
  const viewBtn = globalState.tooltip.querySelector('.view-detail-btn')
  const viewArea = globalState.tooltip.querySelector('.data-view-area')
  const detailContent = globalState.tooltip.querySelector('.detail-content')

  // 1. 基础复制逻辑 )
  if (copyBtn) {
    copyBtn.onclick = (e) => {
      e.stopPropagation()
      navigator.clipboard.writeText(text).then(() => {
        copyBtn.querySelector('.btn-text').innerText = '已复制 ✔'
        setTimeout(() => globalState.tooltip?.classList.remove('visible'), 800)
      })
    }
  }

  // 2. 查看详情逻辑
  if (viewBtn) {
    viewBtn.onclick = (e) => {
      e.stopPropagation()

      // 展示脱敏数据
      detailContent.innerText = bindingValue.detail
      viewArea.style.display = 'block'

      // 隐藏底部操作区
      globalState.tooltip.querySelector('.footer-actions').style.display = 'none'

      // 点击详情文字也可以复制并关闭
      detailContent.onclick = () => {
        navigator.clipboard.writeText(bindingValue.detail).then(() => {
          detailContent.style.color = '#409EFF'
          setTimeout(() => globalState.tooltip?.classList.remove('visible'), 500)
        })
      }

      // 触发回调接口
      if (bindingValue.callback) {
        bindingValue.callback(bindingValue.detail, el)
      }

      // 重新计算位置
      updatePosition(el)
    }
  }

  updatePosition(el)
  globalState.tooltip.classList.add('visible')
}

// 提取位置更新逻辑
function updatePosition(el) {
  if (!globalState.tooltip) return
  const rect = el.getBoundingClientRect()
  const tooltipRect = globalState.tooltip.getBoundingClientRect()
  let posX = rect.left + rect.width / 2 - tooltipRect.width / 2
  let posY = rect.top - tooltipRect.height - 12

  // 边界保护
  if (posX < 10) posX = 10

  globalState.tooltip.style.left = `${posX}px`
  globalState.tooltip.style.top = `${posY}px`
}

function scheduleHide() {
  globalState.hideTimeout = setTimeout(() => {
    globalState.tooltip?.classList.remove('visible')
  }, 300)
}

function addGlobalStyles() {
  if (document.getElementById('hover-copy-style')) return
  const style = document.createElement('style')
  style.id = 'hover-copy-style'
  style.textContent = `
    .hover-copy-box {
      position: fixed; display: flex; flex-direction: column;
      background: rgba(32, 33, 36, 0.98); backdrop-filter: blur(15px);
      border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow: 0 15px 35px rgba(0, 0, 0, 0.45); z-index: 10000;
      opacity: 0; pointer-events: none; transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      transform: translateY(10px); min-width: 120px;
    }
    .hover-copy-box.visible { opacity: 1; pointer-events: auto; transform: translateY(0); }
    
    .data-view-area {
      padding: 12px 16px; text-align: center;
      animation: fadeIn 0.3s ease;
    }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
    
    .data-view-area .label { font-size: 11px; color: #909399; margin-bottom: 6px; }
    .data-view-area .detail-content { font-size: 15px; color: #E6A23C; font-weight: bold; font-family: monospace; cursor: pointer; }
    
    .footer-actions { display: flex; padding: 4px; }
    .action-item {
      flex: 1; display: flex; align-items: center; justify-content: center;
      padding: 8px 16px; cursor: pointer; color: #fff; font-size: 13px;
      border-radius: 8px; transition: background 0.2s; white-space: nowrap;
    }
    .action-item:hover { background: rgba(255, 255, 255, 0.1); }
    .view-detail-btn { background: rgba(255, 255, 255, 0.1); }
    .view-detail-btn:hover { background: rgba(255, 255, 255, 0.2); }
    
    .hover-copy-box::after { content: ''; position: absolute; top: 100%; left: 0; width: 100%; height: 12px; }
  `
  document.head.appendChild(style)
}
