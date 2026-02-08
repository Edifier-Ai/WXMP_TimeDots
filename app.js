App({
  globalData: {
    birthday: null,
    totalLifeDays: 30000,
    cloudReady: false
  },

  onLaunch() {
    // 初始化云开发环境
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'cloud1-9gslbcdv1b96fc5f',
        traceUser: true
      });
      this.globalData.cloudReady = true;
    }
  },

  // 从云端获取生日信息
  async fetchBirthdayFromCloud() {
    if (!this.globalData.cloudReady) return null;

    try {
      const db = wx.cloud.database();
      const res = await db.collection('user_birthday').where({
        _openid: '{openid}' // 会自动替换为当前用户的 openid
      }).get();

      if (res.data && res.data.length > 0) {
        this.globalData.birthday = res.data[0].birthday;
        return res.data[0].birthday;
      }
      return null;
    } catch (err) {
      console.error('获取生日失败:', err);
      // 降级到本地存储
      const localBirthday = wx.getStorageSync('birthday');
      if (localBirthday) {
        this.globalData.birthday = localBirthday;
        return localBirthday;
      }
      return null;
    }
  },

  // 保存生日信息到云端
  async saveBirthdayToCloud(birthday) {
    this.globalData.birthday = birthday;

    // 同时保存到本地（作为备份）
    wx.setStorageSync('birthday', birthday);

    if (!this.globalData.cloudReady) return;

    try {
      const db = wx.cloud.database();
      const collection = db.collection('user_birthday');

      // 检查是否已有记录
      const existing = await collection.where({
        _openid: '{openid}'
      }).get();

      if (existing.data && existing.data.length > 0) {
        // 更新现有记录
        await collection.doc(existing.data[0]._id).update({
          data: {
            birthday: birthday,
            updatedAt: db.serverDate()
          }
        });
      } else {
        // 新增记录
        await collection.add({
          data: {
            birthday: birthday,
            createdAt: db.serverDate()
          }
        });
      }
      console.log('生日已保存到云端');
    } catch (err) {
      console.error('保存生日到云端失败:', err);
    }
  },

  // 获取生日信息（优先从内存，否则从云端）
  getBirthday() {
    return this.globalData.birthday;
  },

  // 兼容旧方法
  setBirthday(birthday) {
    this.saveBirthdayToCloud(birthday);
  }
});
