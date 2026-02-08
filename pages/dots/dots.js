const { getTimeUnits, calculateLifeDays } = require('../../utils/time.js');

const app = getApp();

// 时间单位配置
const UNITS = [
    { key: 'year', label: '年', dotsPerScreen: 82 },
    { key: 'month', label: '月', dotsPerScreen: 120 },
    { key: 'day', label: '天', dotsPerScreen: 200 },
    { key: 'hour', label: '小时', dotsPerScreen: 300 },
    { key: 'minute', label: '分钟', dotsPerScreen: 400 },
    { key: 'second', label: '秒', dotsPerScreen: 500 }
];

Page({
    data: {
        isLoading: true,
        passedDays: 0,
        units: UNITS,
        currentUnit: 'day',
        currentUnitLabel: '天',
        currentUnitIndex: 2,

        // 弹窗相关
        showNoteModal: false,
        currentDotInfo: null,  // { dotIndex, timestamp, timeText }
        currentNote: '',
        isEditingNote: false
    },

    // Canvas 相关
    canvas: null,
    ctx: null,
    canvasWidth: 0,
    canvasHeight: 0,
    dpr: 1,

    // 手势相关
    lastDistance: 0,
    isZooming: false,

    // 时间数据
    birthday: null,
    timeData: null,

    // 定时器
    updateTimer: null,

    // 文字数据缓存
    dotNotes: {},  // { dotIndex: { note, timestamp, ... } }

    // 点阵布局参数（用于点击检测）
    lastRenderParams: null,

    onLoad() {
        this.birthday = app.getBirthday();
        if (!this.birthday) {
            wx.redirectTo({ url: '/pages/birthday/birthday' });
            return;
        }

        const lifeData = calculateLifeDays(this.birthday);
        this.setData({ passedDays: lifeData.passedDays });

        this.initCanvas();
    },

    // 初始化 Canvas
    initCanvas() {
        const query = wx.createSelectorQuery();
        query.select('#dotsCanvas')
            .fields({ node: true, size: true })
            .exec((res) => {
                if (!res[0]) return;

                const canvas = res[0].node;
                const ctx = canvas.getContext('2d');

                this.dpr = wx.getSystemInfoSync().pixelRatio;
                this.canvasWidth = res[0].width;
                this.canvasHeight = res[0].height;

                canvas.width = this.canvasWidth * this.dpr;
                canvas.height = this.canvasHeight * this.dpr;
                ctx.scale(this.dpr, this.dpr);

                this.canvas = canvas;
                this.ctx = ctx;

                // 加载时间数据并渲染
                this.updateTimeData();

                // 加载文字数据
                this.loadDotNotes();

                // 启动定时器（如果当前是秒或分钟单位）
                this.startUpdateTimer();

                setTimeout(() => {
                    this.setData({ isLoading: false });
                }, 500);
            });
    },

    // 更新时间数据
    updateTimeData() {
        this.timeData = getTimeUnits(this.birthday, this.data.currentUnit);
    },

    // 加载当前视图的文字数据
    async loadDotNotes() {
        if (!this.birthday || !wx.cloud) return;

        try {
            const res = await wx.cloud.callFunction({
                name: 'dotNotes',
                data: {
                    action: 'list',
                    data: {
                        birthday: this.birthday,
                        unit: this.data.currentUnit
                    }
                }
            });

            if (res.result && res.result.success) {
                // 转换为 Map 格式方便查找
                this.dotNotes = {};
                res.result.data.forEach(item => {
                    this.dotNotes[item.dotIndex] = item;
                });

                // 重新渲染以显示标记
                this.renderDots();
            }
        } catch (err) {
            console.error('加载文字数据失败:', err);
        }
    },

    // 启动定时器（用于秒和分钟单位）
    startUpdateTimer() {
        // 清除已有的定时器
        this.stopUpdateTimer();

        const unit = this.data.currentUnit;

        // 只对秒和分钟单位启动定时器
        if (unit === 'second') {
            // 秒单位：每秒更新一次
            this.updateTimer = setInterval(() => {
                this.updateTimeData();
                this.renderDots();
            }, 1000);
        } else if (unit === 'minute') {
            // 分钟单位：每分钟更新一次
            this.updateTimer = setInterval(() => {
                this.updateTimeData();
                this.renderDots();
            }, 60000);
        }
    },

    // 停止定时器
    stopUpdateTimer() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
    },

    // 渲染点阵
    renderDots() {
        if (!this.ctx || !this.timeData) return;

        const ctx = this.ctx;
        const width = this.canvasWidth;
        const height = this.canvasHeight;

        // 清空画布
        ctx.clearRect(0, 0, width, height);

        const { passed, total } = this.timeData;
        const currentConfig = UNITS[this.data.currentUnitIndex];

        // 计算点阵布局
        const displayTotal = Math.min(total, currentConfig.dotsPerScreen);
        const dotSize = 4;
        const gap = this.calculateGap(displayTotal, width, height, dotSize);
        const cols = Math.floor((width - 40) / (dotSize + gap));
        const rows = Math.ceil(displayTotal / cols);

        // 居中偏移
        const totalWidth = cols * (dotSize + gap) - gap;
        const totalHeight = rows * (dotSize + gap) - gap;
        const offsetX = (width - totalWidth) / 2;
        const offsetY = (height - totalHeight) / 2;

        // 保存布局参数，用于点击检测
        this.lastRenderParams = {
            displayTotal,
            dotSize,
            gap,
            cols,
            rows,
            offsetX,
            offsetY
        };

        // 计算当前单位下的已过数量
        const passedCount = Math.min(passed, displayTotal);

        // 绘制点阵
        for (let i = 0; i < displayTotal; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = offsetX + col * (dotSize + gap);
            const y = offsetY + row * (dotSize + gap);

            ctx.beginPath();
            ctx.arc(x + dotSize / 2, y + dotSize / 2, dotSize / 2, 0, Math.PI * 2);

            if (i < passedCount) {
                // 已过时间 - 实心黑点
                ctx.fillStyle = '#000000';
                ctx.fill();
            } else {
                // 未来时间 - 空心点
                ctx.strokeStyle = '#CCCCCC';
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }

            // 如果该点有文字，添加彩色标记
            if (this.dotNotes[i]) {
                ctx.beginPath();
                ctx.arc(x + dotSize / 2, y + dotSize / 2, dotSize / 4, 0, Math.PI * 2);
                ctx.fillStyle = '#FF6B6B';  // 红色标记
                ctx.fill();
            }
        }
    },

    // 计算点之间的间距
    calculateGap(totalDots, width, height, dotSize) {
        const availableWidth = width - 40;
        const availableHeight = height - 300; // 留出顶部和底部空间

        // 估算合适的列数
        const aspectRatio = availableWidth / availableHeight;
        const estimatedCols = Math.ceil(Math.sqrt(totalDots * aspectRatio));
        const estimatedRows = Math.ceil(totalDots / estimatedCols);

        const maxGapX = (availableWidth - estimatedCols * dotSize) / (estimatedCols - 1 || 1);
        const maxGapY = (availableHeight - estimatedRows * dotSize) / (estimatedRows - 1 || 1);

        return Math.min(maxGapX, maxGapY, 20);
    },

    // Canvas点击事件
    onCanvasTap(e) {
        if (!this.lastRenderParams || !this.timeData) return;

        const { offsetX, offsetY, dotSize, gap, cols, displayTotal } = this.lastRenderParams;

        // 获取点击坐标
        const touchX = e.detail.x;
        const touchY = e.detail.y;

        // 遍历所有点，找到被点击的点
        for (let i = 0; i < displayTotal; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const dotX = offsetX + col * (dotSize + gap);
            const dotY = offsetY + row * (dotSize + gap);

            // 计算点击位置与点中心的距离
            const centerX = dotX + dotSize / 2;
            const centerY = dotY + dotSize / 2;
            const distance = Math.sqrt(
                Math.pow(touchX - centerX, 2) +
                Math.pow(touchY - centerY, 2)
            );

            // 扩大点击范围（增加可点击区域）
            const clickRadius = Math.max(dotSize * 2, 10);

            if (distance <= clickRadius) {
                // 找到被点击的点
                this.openNoteModal(i);
                return;
            }
        }
    },

    // 打开文字编辑弹窗
    openNoteModal(dotIndex) {
        const { passed, total } = this.timeData;
        const unit = this.data.currentUnit;

        // 计算该点对应的时间戳
        const birthDate = new Date(this.birthday);
        let timestamp = birthDate.getTime();

        // 根据单位计算时间戳
        const unitMs = {
            second: 1000,
            minute: 60 * 1000,
            hour: 60 * 60 * 1000,
            day: 24 * 60 * 60 * 1000,
            month: 30 * 24 * 60 * 60 * 1000,
            year: 365 * 24 * 60 * 60 * 1000
        };

        timestamp += dotIndex * unitMs[unit];

        // 生成时间文本
        const date = new Date(timestamp);
        const timeText = this.formatDateTime(date, unit, dotIndex);

        // 获取已有的文字
        const existingNote = this.dotNotes[dotIndex];

        this.setData({
            showNoteModal: true,
            currentDotInfo: { dotIndex, timestamp, timeText },
            currentNote: existingNote ? existingNote.note : '',
            isEditingNote: !!existingNote
        });
    },

    // 格式化时间显示
    formatDateTime(date, unit, index) {
        const unitNames = {
            second: '秒',
            minute: '分钟',
            hour: '小时',
            day: '天',
            month: '月',
            year: '年'
        };

        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const h = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        const s = String(date.getSeconds()).padStart(2, '0');

        let dateStr = '';
        if (unit === 'year' || unit === 'month' || unit === 'day') {
            dateStr = `${y}-${m}-${d}`;
        } else {
            dateStr = `${y}-${m}-${d} ${h}:${min}:${s}`;
        }

        return `第 ${index + 1} 个${unitNames[unit]}\n${dateStr}`;
    },

    // 文字输入变化
    onNoteInput(e) {
        this.setData({
            currentNote: e.detail.value
        });
    },

    // 保存文字
    async saveNote() {
        const { currentDotInfo, currentNote } = this.data;
        if (!currentDotInfo) return;

        wx.showLoading({ title: '保存中...' });

        try {
            const res = await wx.cloud.callFunction({
                name: 'dotNotes',
                data: {
                    action: 'save',
                    data: {
                        birthday: this.birthday,
                        unit: this.data.currentUnit,
                        dotIndex: currentDotInfo.dotIndex,
                        timestamp: currentDotInfo.timestamp,
                        note: currentNote
                    }
                }
            });

            wx.hideLoading();

            if (res.result && res.result.success) {
                // 更新本地缓存
                if (currentNote.trim() === '') {
                    delete this.dotNotes[currentDotInfo.dotIndex];
                } else {
                    this.dotNotes[currentDotInfo.dotIndex] = {
                        dotIndex: currentDotInfo.dotIndex,
                        note: currentNote,
                        timestamp: currentDotInfo.timestamp
                    };
                }

                // 关闭弹窗并重新渲染
                this.closeNoteModal();
                this.renderDots();

                wx.showToast({
                    title: '保存成功',
                    icon: 'success'
                });
            } else {
                wx.showToast({
                    title: '保存失败',
                    icon: 'none'
                });
            }
        } catch (err) {
            wx.hideLoading();
            console.error('保存文字失败:', err);
            wx.showToast({
                title: '保存失败',
                icon: 'none'
            });
        }
    },

    // 删除文字
    async deleteNote() {
        const { currentDotInfo } = this.data;
        if (!currentDotInfo) return;

        const confirmRes = await new Promise(resolve => {
            wx.showModal({
                title: '确认删除',
                content: '确定要删除这条记录吗？',
                success: res => resolve(res.confirm)
            });
        });

        if (!confirmRes) return;

        wx.showLoading({ title: '删除中...' });

        try {
            const res = await wx.cloud.callFunction({
                name: 'dotNotes',
                data: {
                    action: 'delete',
                    data: {
                        birthday: this.birthday,
                        unit: this.data.currentUnit,
                        dotIndex: currentDotInfo.dotIndex
                    }
                }
            });

            wx.hideLoading();

            if (res.result && res.result.success) {
                // 删除本地缓存
                delete this.dotNotes[currentDotInfo.dotIndex];

                // 关闭弹窗并重新渲染
                this.closeNoteModal();
                this.renderDots();

                wx.showToast({
                    title: '删除成功',
                    icon: 'success'
                });
            }
        } catch (err) {
            wx.hideLoading();
            console.error('删除文字失败:', err);
            wx.showToast({
                title: '删除失败',
                icon: 'none'
            });
        }
    },

    // 关闭弹窗
    closeNoteModal() {
        this.setData({
            showNoteModal: false,
            currentDotInfo: null,
            currentNote: '',
            isEditingNote: false
        });
    },

    // 触摸开始
    onTouchStart(e) {
        if (e.touches.length === 2) {
            this.isZooming = true;
            this.lastDistance = this.getDistance(e.touches[0], e.touches[1]);
        }
    },

    // 触摸移动
    onTouchMove(e) {
        if (!this.isZooming || e.touches.length !== 2) return;

        const currentDistance = this.getDistance(e.touches[0], e.touches[1]);
        const delta = currentDistance - this.lastDistance;

        // 检测缩放方向
        if (Math.abs(delta) > 30) {
            if (delta > 0) {
                // 放大 - 切换到更小的时间单位
                this.switchUnit(1);
            } else {
                // 缩小 - 切换到更大的时间单位
                this.switchUnit(-1);
            }
            this.lastDistance = currentDistance;
        }
    },

    // 触摸结束
    onTouchEnd() {
        this.isZooming = false;
        this.lastDistance = 0;
    },

    // 计算两点距离
    getDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    },

    // 切换时间单位
    switchUnit(direction) {
        const newIndex = this.data.currentUnitIndex + direction;

        if (newIndex < 0 || newIndex >= UNITS.length) return;

        const newUnit = UNITS[newIndex];

        this.setData({
            currentUnitIndex: newIndex,
            currentUnit: newUnit.key,
            currentUnitLabel: newUnit.label
        });

        // 更新数据并重新渲染
        this.updateTimeData();

        // 重新加载该单位的文字数据
        this.loadDotNotes();

        // 启动或停止定时器（根据新的时间单位）
        this.startUpdateTimer();

        // 添加过渡动画效果
        this.animateTransition();
    },

    // 过渡动画
    animateTransition() {
        // 清空后重新渲染
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
        }

        // 使用 requestAnimationFrame 实现平滑过渡
        setTimeout(() => {
            this.renderDots();
        }, 100);
    },

    // 页面卸载时清理定时器
    onUnload() {
        this.stopUpdateTimer();
    },

    // 页面隐藏时暂停定时器
    onHide() {
        this.stopUpdateTimer();
    },

    // 页面显示时重新启动定时器
    onShow() {
        if (this.birthday && (this.data.currentUnit === 'second' || this.data.currentUnit === 'minute')) {
            this.startUpdateTimer();
        }
    },

    // 返回按钮
    onBack() {
        wx.navigateBack();
    }
});
