// ===================== 配置 =====================
const BASE_URL = "https://i.pixiv.re/img-original/img/";
const AUTO_REFRESH_INTERVAL = 15000; // 15秒自动刷新

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
let autoRefreshEnabled = true;

// ===================== 初始化 =====================
document.addEventListener('DOMContentLoaded', function() {
    // 检查是否加载了imageData
    if (typeof imageData === 'undefined' || imageData.length === 0) {
        document.getElementById('pid-display').textContent = '没有可用的图片数据';
        return;
    }
    
    // 检查本地存储的设置
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode !== null) {
        isDarkMode = savedDarkMode === 'true';
    }
    
    const savedAutoRefresh = localStorage.getItem('autoRefresh');
    if (savedAutoRefresh !== null) {
        autoRefreshEnabled = savedAutoRefresh === 'true';
        updateAutoRefreshToggle();
        
        // 初始化时根据设置更新显示
        if (!autoRefreshEnabled) {
            document.getElementById('auto-switch-info').textContent = '自动刷新已关闭';
        }
    }
    
    updateDarkMode();
    setupTouchEvents();
    setupActivityListeners();
    loadRandomImage();
});

// ===================== 设置菜单功能 =====================
function toggleSettingsMenu() {
    const menu = document.getElementById('settings-menu');
    menu.classList.toggle('active');
    
    // 只有自动刷新开启时才重置计时器
    if (autoRefreshEnabled) {
        resetInactivityTimer();
    }
}

function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    localStorage.setItem('darkMode', isDarkMode);
    updateDarkMode();
    
    // 只有自动刷新开启时才重置计时器
    if (autoRefreshEnabled) {
        resetInactivityTimer();
    }
}

function toggleAutoRefresh() {
    autoRefreshEnabled = !autoRefreshEnabled;
    localStorage.setItem('autoRefresh', autoRefreshEnabled);
    updateAutoRefreshToggle();
    
    if (autoRefreshEnabled) {
        // 如果开启自动刷新，立即重置计时器
        resetInactivityTimer();
    } else {
        // 如果关闭自动刷新，清除所有计时器并更新显示
        clearTimeout(inactivityTimer);
        clearInterval(countdownInterval);
        document.getElementById('auto-switch-info').textContent = '自动刷新已关闭';
    }
}

function updateAutoRefreshToggle() {
    const knob = document.getElementById('auto-refresh-knob');
    const switchElement = knob.parentElement;
    
    if (autoRefreshEnabled) {
        switchElement.classList.add('active');
    } else {
        switchElement.classList.remove('active');
    }
}

// ===================== 图片处理 =====================
function parseImageData(imgArray) {
    return {
        pid: imgArray[0],
        url: BASE_URL + imgArray[1]
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
        
        // 只有自动刷新开启时才重置计时器
        if (autoRefreshEnabled) {
            resetInactivityTimer();
        } else {
            document.getElementById('auto-switch-info').textContent = '自动刷新已关闭';
        }
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
    // 清除现有计时器
    clearTimeout(inactivityTimer);
    clearInterval(countdownInterval);
    
    // 如果自动刷新关闭或图片正在加载，直接返回
    if (!autoRefreshEnabled || isImageLoading) {
        return;
    }
    
    // 记录活动时间
    lastActivityTime = Date.now();
    
    // 启动倒计时显示
    startCountdown();
    
    // 设置无操作检测
    inactivityTimer = setTimeout(() => {
        if (nextImage) loadRandomImage();
    }, AUTO_REFRESH_INTERVAL);
}

function startCountdown() {
    clearInterval(countdownInterval);
    const countdownEl = document.getElementById('auto-switch-info');
    
    // 如果自动刷新关闭，显示提示信息
    if (!autoRefreshEnabled) {
        countdownEl.textContent = '自动刷新已关闭';
        return;
    }
    
    // 立即更新显示
    updateDisplay();
    
    // 每秒更新倒计时
    countdownInterval = setInterval(updateDisplay, 1000);
    
    function updateDisplay() {
        // 如果自动刷新关闭或图片正在加载，不更新倒计时
        if (!autoRefreshEnabled || isImageLoading) {
            clearInterval(countdownInterval);
            return;
        }
        
        const remaining = Math.max(0, AUTO_REFRESH_INTERVAL - (Date.now() - lastActivityTime));
        countdownEl.textContent = `${Math.ceil(remaining/1000)}秒后自动切换`;
        
        if (remaining <= 0) {
            clearInterval(countdownInterval);
        }
    }
}

// ===================== 下载功能 =====================
async function downloadFile(url, filename) {
    // 方案A：直接创建 <a> 触发下载（适用于同源或支持 download 的跨域）
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // 方案B：如果方案A失效（跨域问题），改用 fetch + Blob（需CORS支持）
    try {
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) throw new Error('Network response was not ok');
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        // 重新创建链接确保点击有效
        const downloadLink = document.createElement('a');
        downloadLink.href = blobUrl;
        downloadLink.download = filename;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // 释放内存
        setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
        }, 100);
    } catch (error) {
        console.error("下载失败:", error);
        // 降级方案：新标签页打开
        window.open(url, "_blank");
    }
}

function saveCurrentImage() {
    if (!currentImage) return;
    
    const filename = `Pixiv_${currentImage.pid}.jpg`;
    downloadFile(currentImage.url, filename);
    
    // 只有自动刷新开启时才重置计时器
    if (autoRefreshEnabled) {
        resetInactivityTimer();
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
        
        // 只有自动刷新开启时才重置计时器
        if (autoRefreshEnabled) {
            resetInactivityTimer();
        }
        
        isLongPress = false;
        longPressTimer = setTimeout(function() {
            isLongPress = true;
            showSaveAnimation();
        }, 800);
    }, { passive: true });
    
    container.addEventListener('touchmove', function(e) {
        if (!isSwiping) return;
        
        if (isLongPress) {
            isSwiping = false;
            return;
        }
        
        const diffX = e.touches[0].clientX - startX;
        imgEl.style.transform = `translateX(${diffX}px)`;
        
        // 只有自动刷新开启时才重置计时器
        if (autoRefreshEnabled) {
            resetInactivityTimer();
        }
        
        if (Math.abs(diffX) > 30) {
            clearTimeout(longPressTimer);
        }
    }, { passive: true });
    
    container.addEventListener('touchend', function(e) {
        if (!isSwiping) return;
        isSwiping = false;
        imgEl.style.transition = 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)';
        
        clearTimeout(longPressTimer);
        
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
        
        // 只有自动刷新开启时才重置计时器
        if (autoRefreshEnabled) {
            resetInactivityTimer();
        }
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
    
    // 只有自动刷新开启时才重置计时器
    if (autoRefreshEnabled) {
        resetInactivityTimer();
    }
}

// ===================== 辅助功能 =====================
function updateDarkMode() {
    const darkModeText = document.getElementById('dark-mode-text');
    const darkModeSwitch = document.querySelector('.menu-item:first-child .toggle-switch');
    
    if (isDarkMode) {
        document.documentElement.style.setProperty('--bg-color', '#1A1A1A');
        document.documentElement.style.setProperty('--card-color', '#2D2D2D');
        document.documentElement.style.setProperty('--text-color', '#EEE');
        document.documentElement.style.setProperty('--menu-bg-color', '#2D2D2D');
        darkModeText.textContent = '明亮模式';
        darkModeSwitch.classList.add('active');
    } else {
        document.documentElement.style.setProperty('--bg-color', '#f5f5f5');
        document.documentElement.style.setProperty('--card-color', 'white');
        document.documentElement.style.setProperty('--text-color', '#333');
        document.documentElement.style.setProperty('--menu-bg-color', 'white');
        darkModeText.textContent = '暗黑模式';
        darkModeSwitch.classList.remove('active');
    }
}

function setupActivityListeners() {
    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'touchmove', 'click', 'scroll'];
    events.forEach(event => {
        document.addEventListener(event, function() {
            // 只有自动刷新开启时才重置计时器
            if (autoRefreshEnabled) {
                resetInactivityTimer();
            }
        }, { passive: true });
    });
}