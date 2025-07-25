// ===================== 配置 =====================
const BASE_URL = "https://i.pixiv.re/img-original/img/"; // 请修改为您的实际基础路径
const INACTIVITY_INTERVAL = 15000; // n(1000=1)秒无操作切换

// ===================== 状态管理 =====================
let currentImage = null;
let nextImage = null;
let startX = 0;
let isSwiping = false;
let isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
let inactivityTimer = null;
let countdownInterval = null;
let lastActivityTime = Date.now();
let longPressTimer = null;
let isLongPress = false;
let isImageLoading = false;
let currentScale = 1;
let zoomedImage = null;

// ===================== 图片处理 =====================
function parseImageData(imgArray) {
    // 将 [pid, filename] 转换为 {pid, url} 对象
    return {
        pid: imgArray[0],
        url: BASE_URL + imgArray[1] // 自动拼接完整URL
    };
}

// ===================== 核心功能 =====================
function loadRandomImage() {
    // 清除现有计时器
    clearTimeout(inactivityTimer);
    clearInterval(countdownInterval);
    
    const imgEl = document.getElementById('random-image');
    const progressBar = document.getElementById('progress-bar');
    
    // 显示加载状态
    imgEl.style.opacity = '0.5';
    progressBar.style.width = '0%';
    isImageLoading = true;
    document.getElementById('auto-switch-info').textContent = '图片加载中...';
    
    // 获取新图片（优先使用预加载的nextImage）
    currentImage = nextImage || getRandomImage(currentImage?.pid);
    
    // 如果没有可用图片
    if (!currentImage) {
        document.getElementById('pid-display').textContent = '没有可用的图片';
        isImageLoading = false;
        return;
    }
    
    // 预加载下一张
    nextImage = getRandomImage(currentImage.pid);
    
    // 加载图片
    const img = new Image();
    img.onload = function() {
        imgEl.src = this.src;
        imgEl.style.opacity = '1';
        progressBar.style.width = '100%';
        setTimeout(() => progressBar.style.width = '0%', 300);
        document.getElementById('pid-display').textContent = `PID: ${currentImage.pid}`;
        isImageLoading = false;
        
        // 重置无操作计时器
        resetInactivityTimer();
    };
    
    img.onerror = function() {
        progressBar.style.width = '0%';
        document.getElementById('pid-display').textContent = '加载失败，点击重试';
        document.getElementById('auto-switch-info').textContent = '加载失败';
        isImageLoading = false;
    };
    
    img.src = currentImage.url;
}

function getRandomImage(excludePid) {
    if (!imageData || imageData.length === 0) return null;
    
    // 过滤可用图片
    const available = excludePid 
        ? imageData.filter(img => img[0] !== excludePid)
        : imageData;
    
    return available.length > 0 
        ? parseImageData(available[Math.floor(Math.random() * available.length)])
        : null;
}

// ===================== 自动切换系统 =====================
function resetInactivityTimer() {
    // 如果图片正在加载，不重置计时器
    if (isImageLoading) return;
    
    // 清除现有计时器
    clearTimeout(inactivityTimer);
    clearInterval(countdownInterval);
    
    // 记录活动时间
    lastActivityTime = Date.now();
    
    // 启动倒计时显示
    startCountdown();
    
    // 设置无操作检测
    inactivityTimer = setTimeout(() => {
        if (nextImage) loadRandomImage();
    }, INACTIVITY_INTERVAL);
}

function startCountdown() {
    clearInterval(countdownInterval);
    const countdownEl = document.getElementById('auto-switch-info');
    
    // 立即更新显示
    updateDisplay();
    
    // 每秒更新倒计时
    countdownInterval = setInterval(updateDisplay, 1000);
    
    function updateDisplay() {
        // 如果图片正在加载，不更新倒计时
        if (isImageLoading) return;
        
        const remaining = Math.max(0, INACTIVITY_INTERVAL - (Date.now() - lastActivityTime));
        countdownEl.textContent = `${Math.ceil(remaining/1000)}秒后自动切换`;
        
        if (remaining <= 0) {
            clearInterval(countdownInterval);
        }
    }
}

// ===================== 交互功能 =====================
function setupTouchEvents() {
    const container = document.getElementById('image-container');
    const imgEl = document.getElementById('random-image');
    
    container.addEventListener('touchstart', function(e) {
        startX = e.touches[0].clientX;
        isSwiping = true;
        imgEl.style.transition = 'none';
        resetInactivityTimer();
        
        // 设置长按计时器
        isLongPress = false;
        longPressTimer = setTimeout(function() {
            isLongPress = true;
            showSaveAnimation();
        }, 800);
    }, { passive: true });
    
    container.addEventListener('touchmove', function(e) {
        if (!isSwiping) return;
        
        // 如果已经触发了长按，则取消滑动
        if (isLongPress) {
            isSwiping = false;
            return;
        }
        
        const diffX = e.touches[0].clientX - startX;
        imgEl.style.transform = `translateX(${diffX}px)`;
        resetInactivityTimer();
        
        // 如果滑动距离超过一定值，取消长按
        if (Math.abs(diffX) > 30) {
            clearTimeout(longPressTimer);
        }
    }, { passive: true });
    
    container.addEventListener('touchend', function(e) {
        if (!isSwiping) return;
        isSwiping = false;
        imgEl.style.transition = 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)';
        
        // 清除长按计时器
        clearTimeout(longPressTimer);
        
        // 如果已经触发了长按，则不再处理滑动
        if (isLongPress) {
            isLongPress = false;
            imgEl.style.transform = 'translateX(0)';
            return;
        }
        
        const diffX = e.changedTouches[0].clientX - startX;
        if (Math.abs(diffX) > 50) {
            loadRandomImage();
        }
        imgEl.style.transform = 'translateX(0)';
        resetInactivityTimer();
    }, { passive: true });
    
    // 双击放大图片
    imgEl.addEventListener('dblclick', function() {
        zoomImage();
    });
}

function showSaveAnimation() {
    const overlay = document.getElementById('save-overlay');
    const progress = document.getElementById('save-progress');
    const success = document.getElementById('save-success');
    const message = document.getElementById('save-message');
    
    // 显示保存动画
    overlay.classList.add('active');
    progress.style.display = 'block';
    success.classList.remove('active');
    message.textContent = '下载图片中...';
    
    // 模拟保存过程
    setTimeout(() => {
        // 隐藏进度条，显示成功图标
        progress.style.display = 'none';
        success.classList.add('active');
        
        // 实际保存图片
        saveCurrentImage();
        
        message.textContent = '下载成功！';
        
        // 2秒后隐藏覆盖层
        setTimeout(() => {
            overlay.classList.remove('active');
        }, 2000);
    }, 1000);
}

function saveCurrentImage() {
    if (!currentImage) return;
    
    // 创建下载链接
    const link = document.createElement('a');
    link.href = currentImage.url;
    link.download = `Pixiv_${currentImage.pid}.jpg`;
    
    // 处理iOS设备的特殊情况
    if (/(iPad|iPhone|iPod)/g.test(navigator.userAgent)) {
        // iOS设备需要在新窗口打开
        window.open(currentImage.url, '_blank');
    } else {
        // 其他设备直接触发下载
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    resetInactivityTimer();
}

function zoomImage() {
    if (!currentImage) return;
    
    const zoomContainer = document.createElement('div');
    zoomContainer.className = 'image-zoom';
    
    // 点击任意处关闭
    zoomContainer.onclick = function(e) {
        // 只有当点击的不是缩放按钮时才关闭
        if (!e.target.classList.contains('zoom-btn')) {
            document.body.removeChild(zoomContainer);
            currentScale = 1; // 重置缩放比例
        }
    };
    
    zoomedImage = document.createElement('img');
    zoomedImage.src = currentImage.url;
    zoomedImage.style.transform = `scale(${currentScale})`;
    
    // 添加缩放控制按钮
    const zoomControls = document.createElement('div');
    zoomControls.className = 'zoom-controls';
    
    const zoomInBtn = document.createElement('div');
    zoomInBtn.className = 'zoom-btn';
    zoomInBtn.textContent = '+';
    zoomInBtn.onclick = function(e) {
        e.stopPropagation();
        currentScale += 0.5;
        zoomedImage.style.transform = `scale(${currentScale})`;
    };
    
    const zoomOutBtn = document.createElement('div');
    zoomOutBtn.className = 'zoom-btn';
    zoomOutBtn.textContent = '-';
    zoomOutBtn.onclick = function(e) {
        e.stopPropagation();
        currentScale = Math.max(0.5, currentScale - 0.5);
        zoomedImage.style.transform = `scale(${currentScale})`;
    };
    
    const resetBtn = document.createElement('div');
    resetBtn.className = 'zoom-btn';
    resetBtn.textContent = '↻';
    resetBtn.onclick = function(e) {
        e.stopPropagation();
        currentScale = 1;
        zoomedImage.style.transform = `scale(${currentScale})`;
    };
    
    zoomControls.appendChild(zoomInBtn);
    zoomControls.appendChild(zoomOutBtn);
    zoomControls.appendChild(resetBtn);
    
    // 添加双指缩放支持
    let initialDistance = null;
    zoomedImage.addEventListener('touchstart', function(e) {
        if (e.touches.length === 2) {
            e.preventDefault();
            initialDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
        }
    }, { passive: false });
    
    zoomedImage.addEventListener('touchmove', function(e) {
        if (e.touches.length === 2) {
            e.preventDefault();
            const currentDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            
            if (initialDistance) {
                const scale = currentDistance / initialDistance;
                currentScale = Math.max(0.5, Math.min(3, currentScale * scale));
                zoomedImage.style.transform = `scale(${currentScale})`;
            }
            initialDistance = currentDistance;
        }
    }, { passive: false });
    
    // 防止点击图片本身触发关闭
    zoomedImage.onclick = function(e) {
        e.stopPropagation();
    };
    
    zoomContainer.appendChild(zoomedImage);
    zoomContainer.appendChild(zoomControls);
    document.body.appendChild(zoomContainer);
    
    resetInactivityTimer();
}

// ===================== 辅助功能 =====================
function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    localStorage.setItem('darkMode', isDarkMode);
    updateDarkMode();
    resetInactivityTimer();
}

function updateDarkMode() {
    const toggleBtn = document.querySelector('.dark-mode-toggle');
    if (isDarkMode) {
        document.documentElement.style.setProperty('--bg-color', '#1A1A1A');
        document.documentElement.style.setProperty('--card-color', '#2D2D2D');
        toggleBtn.textContent = '🌙';
    } else {
        document.documentElement.style.setProperty('--bg-color', '#f5f5f5');
        document.documentElement.style.setProperty('--card-color', 'white');
        toggleBtn.textContent = '☀️';
    }
}

function setupActivityListeners() {
    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'touchmove', 'click', 'scroll'];
    events.forEach(event => {
        document.addEventListener(event, resetInactivityTimer, { passive: true });
    });
}

// ===================== 初始化 =====================
document.addEventListener('DOMContentLoaded', function() {
    // 检查是否加载了imageData
    if (typeof imageData === 'undefined' || imageData.length === 0) {
        document.getElementById('pid-display').textContent = '没有可用的图片数据';
        return;
    }
    
    // 检查本地存储的暗黑模式设置
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode !== null) {
        isDarkMode = savedDarkMode === 'true';
    }
    
    updateDarkMode();
    setupTouchEvents();
    setupActivityListeners();
    loadRandomImage();
});
