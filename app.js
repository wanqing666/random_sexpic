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
    resetInactivityTimer();
}

function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    localStorage.setItem('darkMode', isDarkMode);
    updateDarkMode();
    resetInactivityTimer();
}

function toggleAutoRefresh() {
    autoRefreshEnabled = !autoRefreshEnabled;
    localStorage.setItem('autoRefresh', autoRefreshEnabled);
    updateAutoRefreshToggle();
    
    if (autoRefreshEnabled) {
        resetInactivityTimer();
    } else {
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
    clearTimeout(inactivityTimer);
    clearInterval(countdownInterval);
    
    const imgEl = document.getElementById('random-image');
    const progressBar = document.getElementById('progress-bar');
    
    imgEl.style.opacity = '0.5';
    progressBar.style.width = '0%';
    isImageLoading = true;
    document.getElementById('auto-switch-info').textContent = '图片加载中...';
    
    currentImage = nextImage || getRandomImage(currentImage?.pid);
    
    if (!currentImage) {
        document.getElementById('pid-display').textContent = '没有可用的图片';
        isImageLoading = false;
        return;
    }
    
    nextImage = getRandomImage(currentImage.pid);
    
    const img = new Image();
    img.onload = function() {
        imgEl.src = this.src;
        imgEl.style.opacity = '1';
        progressBar.style.width = '100%';
        setTimeout(() => progressBar.style.width = '0%', 300);
        document.getElementById('pid-display').textContent = `PID: ${currentImage.pid}`;
        isImageLoading = false;
        
        if (autoRefreshEnabled) {
            resetInactivityTimer();
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
    
    const available = excludePid 
        ? imageData.filter(img => img[0] !== excludePid)
        : imageData;
    
    return available.length > 0 
        ? parseImageData(available[Math.floor(Math.random() * available.length)])
        : null;
}

// ===================== 自动切换系统 =====================
function resetInactivityTimer() {
    if (isImageLoading || !autoRefreshEnabled) return;
    
    lastActivityTime = Date.now();
    startCountdown();
    
    inactivityTimer = setTimeout(() => {
        if (nextImage) loadRandomImage();
    }, AUTO_REFRESH_INTERVAL);
}

function startCountdown() {
    clearInterval(countdownInterval);
    const countdownEl = document.getElementById('auto-switch-info');
    
    if (!autoRefreshEnabled) {
        countdownEl.textContent = '自动刷新已关闭';
        return;
    }
    
    updateDisplay();
    countdownInterval = setInterval(updateDisplay, 1000);
    
    function updateDisplay() {
        if (isImageLoading || !autoRefreshEnabled) return;
        
        const remaining = Math.max(0, AUTO_REFRESH_INTERVAL - (Date.now() - lastActivityTime));
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
        resetInactivityTimer();
        
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
        resetInactivityTimer();
    }, { passive: true });
    
    imgEl.addEventListener('dblclick', function() {
        zoomImage();
    });
}

function showSaveAnimation() {
    const overlay = document.getElementById('save-overlay');
    const progress = document.getElementById('save-progress');
    const success = document.getElementById('save-success');
    const message = document.getElementById('save-message');
    
    overlay.classList.add('active');
    progress.style.display = 'block';
    success.classList.remove('active');
    message.textContent = '下载图片中...';
    
    setTimeout(() => {
        progress.style.display = 'none';
        success.classList.add('active');
        saveCurrentImage();
        message.textContent = '下载成功！';
        
        setTimeout(() => {
            overlay.classList.remove('active');
        }, 2000);
    }, 1000);
}

function saveCurrentImage() {
    if (!currentImage) return;
    
    const link = document.createElement('a');
    link.href = currentImage.url;
    link.download = `Pixiv_${currentImage.pid}.jpg`;
    
    if (/(iPad|iPhone|iPod)/g.test(navigator.userAgent)) {
        window.open(currentImage.url, '_blank');
    } else {
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
    
    zoomContainer.onclick = function(e) {
        if (!e.target.classList.contains('zoom-btn')) {
            document.body.removeChild(zoomContainer);
            currentScale = 1;
        }
    };
    
    zoomedImage = document.createElement('img');
    zoomedImage.src = currentImage.url;
    zoomedImage.style.transform = `scale(${currentScale})`;
    
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
    
    zoomedImage.onclick = function(e) {
        e.stopPropagation();
    };
    
    zoomContainer.appendChild(zoomedImage);
    zoomContainer.appendChild(zoomControls);
    document.body.appendChild(zoomContainer);
    
    resetInactivityTimer();
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
        document.addEventListener(event, resetInactivityTimer, { passive: true });
    });
}