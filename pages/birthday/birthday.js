const { calculateLifeDays, getTodayString } = require('../../utils/time.js');

const app = getApp();

Page({
    data: {
        birthday: '',
        today: '',
        passedDays: 0,
        remainingDays: 0,
        decorDots: new Array(5).fill(0),
        footerDots: new Array(3).fill(0),
        isLoading: true
    },

    async onLoad() {
        // 设置今天的日期作为选择器的最大值
        this.setData({
            today: getTodayString()
        });

        // 从云端获取生日信息
        await this.loadBirthday();
    },

    // 加载生日信息
    async loadBirthday() {
        try {
            // 优先从云端获取
            const cloudBirthday = await app.fetchBirthdayFromCloud();

            if (cloudBirthday) {
                this.setData({
                    birthday: cloudBirthday,
                    isLoading: false
                });
                this.calculateDays(cloudBirthday);
            } else {
                // 尝试从本地获取
                const localBirthday = app.getBirthday();
                if (localBirthday) {
                    this.setData({ birthday: localBirthday });
                    this.calculateDays(localBirthday);
                }
                this.setData({ isLoading: false });
            }
        } catch (err) {
            console.error('加载生日失败:', err);
            this.setData({ isLoading: false });
        }
    },

    // 生日选择变化
    onBirthdayChange(e) {
        const birthday = e.detail.value;
        this.setData({ birthday });
        this.calculateDays(birthday);

        // 保存到云端和本地
        app.saveBirthdayToCloud(birthday);
    },

    // 计算天数
    calculateDays(birthday) {
        const result = calculateLifeDays(birthday);
        this.setData({
            passedDays: result.passedDays,
            remainingDays: result.remainingDays
        });
    },

    // 点击开始按钮
    onStart() {
        if (!this.data.birthday) {
            wx.showToast({
                title: '请先选择生日',
                icon: 'none'
            });
            return;
        }

        wx.navigateTo({
            url: '/pages/dots/dots'
        });
    }
});
